-- Beat Rarity · hardening: limits that the database enforces itself, so a modified game can't get around them.
-- Safe to run more than once.

-- league names: allowed characters (already), a word filter, and no impersonating the game
create or replace function public.br_handle_ok(h text) returns boolean language sql immutable as $$
  select h ~ '^[a-z0-9_.-]{3,20}$'
     and regexp_replace(h, '[_.0-9-]', '', 'g') !~ '(fuck|shit|cunt|nigg|fag|rape|nazi|hitler|porn|sex|cock|dick|pussy|slut|whore|retard|kys)'
     and h !~ '^(admin|beatrarity|beat\.rarity|support|moderator|official|staff)';
$$;
alter table public.profiles drop constraint if exists profiles_handle_ok;
alter table public.profiles add constraint profiles_handle_ok check (handle is null or public.br_handle_ok(handle)) not valid;

-- the synced streak is a small object, never a dumping ground
alter table public.profiles drop constraint if exists profiles_streak_small;
alter table public.profiles add constraint profiles_streak_small check (jsonb_typeof(streak) = 'object' and pg_column_size(streak) < 2000) not valid;

-- usage events: at most 400 per player per day (a normal day is under 50)
create index if not exists events_user_created on public.events (user_id, created_at);
create or replace function public.br_events_cap() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from events where user_id = new.user_id and created_at > now() - interval '1 day') >= 400 then
    return null;                                     -- quietly drop the extra event
  end if;
  return new;
end $$;
drop trigger if exists events_cap on public.events;
create trigger events_cap before insert on public.events for each row execute function public.br_events_cap();

-- runs: a beat is small; refuse anything huge even from the server
alter table public.runs drop constraint if exists runs_beat_small;
alter table public.runs add constraint runs_beat_small check (pg_column_size(beat) < 8000) not valid;

-- events older than 13 months aren't needed for growth numbers
create or replace function public.br_prune_events() returns void language sql security definer set search_path = public as $$
  delete from events where created_at < now() - interval '13 months';
$$;
revoke all on function public.br_prune_events() from public, anon, authenticated;
revoke all on function public.br_handle_ok(text) from public;
grant execute on function public.br_handle_ok(text) to anon, authenticated, service_role;
revoke all on function public.br_events_cap() from public, anon, authenticated;
