-- Beat Rarity · Phase B1: real crowd, server-checked runs, weekly league, events, Crate Club memberships.
-- Safe to run more than once. Players write only their own profile name/streak and events; runs and memberships are
-- written by the server (Edge Functions with the secret key), so nobody can fake a score or a membership.

-- ---------- helpers ----------
create or replace function public.br_today() returns int language sql stable as $$
  select (now() at time zone 'utc')::date - date '2026-11-18' + 1;            -- puzzle No. 1 = 18 Nov 2026 (UTC)
$$;
create or replace function public.br_week(p_day int) returns int language sql immutable as $$
  select p_day - ((extract(isodow from date '2026-11-18' + (p_day - 1))::int) - 1);    -- Monday's puzzle number
$$;

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_.-]{3,20}$'),
  streak jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  day int not null,
  game text not null check (game in ('day', 'mode')),
  beat jsonb not null,
  total numeric(7,1) not null,
  tier text not null,
  created_at timestamptz not null default now(),
  unique (user_id, day, game)
);
create index if not exists runs_day_game on public.runs (day, game);
create table if not exists public.league_members (
  week int not null,
  user_id uuid not null references auth.users on delete cascade,
  tier int not null check (tier between 0 and 4),
  grp int not null,
  joined_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists league_week_tier_grp on public.league_members (week, tier, grp);
create table if not exists public.memberships (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null default 'none',            -- active | trialing | past_due | canceled | none
  plan text,                                      -- month | year
  current_period_end timestamptz,
  stripe_customer text,
  stripe_subscription text,
  updated_at timestamptz not null default now()
);
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  e text not null check (e ~ '^[a-z0-9_]{1,40}$'),
  d int,
  extra jsonb check (extra is null or pg_column_size(extra) < 1000),
  created_at timestamptz not null default now()
);
create index if not exists events_e_created on public.events (e, created_at);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.league_members enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (handle, streak) on public.profiles to authenticated;     -- players can change their name and streak only

drop policy if exists "own runs read" on public.runs;
create policy "own runs read" on public.runs for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.runs from anon, authenticated;

revoke all on public.league_members from anon, authenticated;          -- read through league_table() only

drop policy if exists "own membership read" on public.memberships;
create policy "own membership read" on public.memberships for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.memberships from anon, authenticated;

drop policy if exists "own events insert" on public.events;
create policy "own events insert" on public.events for insert to authenticated with check (user_id = auth.uid());
revoke select, update, delete on public.events from anon, authenticated;

-- ---------- the crowd: every scored run of a day, as note counts (no names, no ids) ----------
create or replace function public.day_pool(p_day int, p_game text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', (select count(*) from runs where day = p_day and game = p_game),
    'weights', coalesce((select jsonb_agg(total) from runs where day = p_day and game = p_game), '[]'::jsonb),
    'counts', coalesce((
      select jsonb_object_agg(t, c) from (
        select l.lane || ':' || (n->>'step') || ':' || (n->>'row') as t, count(*) as c
        from runs r, jsonb_each(r.beat) as l(lane, notes), jsonb_array_elements(l.notes) as n
        where r.day = p_day and r.game = p_game and jsonb_typeof(l.notes) = 'array'
        group by 1) x), '{}'::jsonb));
$$;
revoke all on function public.day_pool(int, text) from public;
grant execute on function public.day_pool(int, text) to anon, authenticated, service_role;

-- ---------- weekly league ----------
-- Points = the week's crate weights. Promotion: the top 7 (or the top third in a small group); drop: the bottom 5 in a
-- group of 15+, or anyone who scored nothing. Groups hold 30.
create or replace function public.league_rank(p_week int, p_user uuid) returns table (rnk int, size int, pts numeric, tier int)
language sql stable security definer set search_path = public as $$
  with me as (select tier, grp from league_members where week = p_week and user_id = p_user),
  g as (
    select m.user_id, coalesce(sum(r.total), 0) as pts
    from league_members m join me on m.tier = me.tier and m.grp = me.grp
    left join runs r on r.user_id = m.user_id and r.day between p_week and p_week + 6
    where m.week = p_week group by m.user_id),
  ranked as (select user_id, pts, rank() over (order by pts desc)::int as rnk, count(*) over ()::int as size from g)
  select rnk, size, pts, (select tier from me) from ranked where user_id = p_user;
$$;
revoke all on function public.league_rank(int, uuid) from public;
grant execute on function public.league_rank(int, uuid) to service_role;

create or replace function public.join_league(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w int := br_week(br_today());
  pw int; ptier int; lrnk int; lsize int; lpts numeric; t int := 0; moved text := null; g int; last_rank int;
begin
  if exists (select 1 from league_members where week = w and user_id = p_user) then
    return (select jsonb_build_object('week', w, 'tier', tier, 'grp', grp) from league_members where week = w and user_id = p_user);
  end if;
  select m.week, m.tier into pw, ptier from league_members m where m.user_id = p_user and m.week < w order by m.week desc limit 1;
  if pw is not null then
    t := ptier;
    if pw = w - 7 then
      select r.rnk, r.size, r.pts into lrnk, lsize, lpts from league_rank(pw, p_user) r;
      last_rank := lrnk;
      if lpts > 0 and lsize >= 3 and lrnk <= greatest(1, least(7, lsize / 3)) and t < 4 then t := t + 1; moved := 'up';
      elsif (coalesce(lpts, 0) = 0 or (lsize >= 15 and lrnk > lsize - 5)) and t > 0 then t := t - 1; moved := 'down';
      else moved := 'stayed'; end if;
    elsif t > 0 then t := t - 1; moved := 'down';                                   -- missed a whole week
    end if;
  end if;
  perform pg_advisory_xact_lock(w * 10 + t);                                         -- one join per tier at a time
  select m.grp into g from league_members m where m.week = w and m.tier = t group by m.grp having count(*) < 30 order by m.grp limit 1;
  if g is null then select coalesce(max(m.grp), 0) + 1 into g from league_members m where m.week = w and m.tier = t; end if;
  insert into league_members (week, user_id, tier, grp) values (w, p_user, t, g) on conflict do nothing;
  return jsonb_build_object('week', w, 'tier', t, 'grp', g, 'moved', moved, 'last_rank', last_rank);
end $$;
revoke all on function public.join_league(uuid) from public;
grant execute on function public.join_league(uuid) to service_role;

-- my group's table this week (names only, no ids)
create or replace function public.league_table() returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (select br_week(br_today()) as week),
  me as (select m.tier, m.grp from league_members m, w where m.week = w.week and m.user_id = auth.uid()),
  rows as (
    select coalesce(p.handle, 'digger') as handle, m.user_id = auth.uid() as me, coalesce(sum(r.total), 0) as pts,
           exists (select 1 from memberships s where s.user_id = m.user_id and s.status in ('active', 'trialing')) as club
    from w cross join me
    join league_members m on m.week = w.week and m.tier = me.tier and m.grp = me.grp
    left join profiles p on p.id = m.user_id
    left join runs r on r.user_id = m.user_id and r.day between w.week and w.week + 6
    group by p.handle, m.user_id)
  select case when exists (select 1 from me) then jsonb_build_object(
    'week', (select week from w), 'tier', (select tier from me),
    'rows', (select jsonb_agg(jsonb_build_object('handle', handle, 'me', me, 'pts', pts, 'club', club) order by pts desc, me desc) from rows))
  else null end;
$$;
revoke all on function public.league_table() from public;
grant execute on function public.league_table() to authenticated;

-- ---------- admin view for growth metrics (dashboard / SQL editor only) ----------
create or replace view public.daily_metrics with (security_invoker = true) as
  select d.day,
    (select count(distinct user_id) from runs r where r.day = d.day) as players,
    (select count(*) from runs r where r.day = d.day and r.game = 'mode') as mode_runs,
    (select count(distinct r.user_id) from runs r where r.day = d.day and exists (select 1 from runs q where q.user_id = r.user_id and q.day = d.day + 1)) as back_next_day,
    (select count(*) from events e where e.d = d.day and e.e in ('share', 'clip')) as shares,
    (select count(*) from events e where e.d = d.day and e.e = 'club_view') as club_views
  from (select distinct day from runs) d order by d.day desc;
revoke all on public.daily_metrics from anon, authenticated;
