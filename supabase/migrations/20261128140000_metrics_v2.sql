-- Beat Rarity · daily_metrics v2: one row per puzzle day (No. 1 = 18 Nov 2026, UTC), newest first.
-- Read it in Supabase → SQL editor:  select * from daily_metrics;
-- Safe to run more than once.
drop view if exists public.daily_metrics;
create view public.daily_metrics with (security_invoker = true) as
with days as (select g as day, date '2026-11-18' + g - 1 as date from generate_series(1, public.br_today()) g)
select d.day, d.date,
  -- people
  (select count(distinct e.user_id) from events e where e.d = d.day and e.e = 'visit')                          as visitors,
  (select count(*) from profiles p where (p.created_at at time zone 'utc')::date = d.date)                     as new_players,
  (select count(*) from auth.users u where (u.email_confirmed_at at time zone 'utc')::date = d.date)          as emails_saved,
  -- playing
  (select count(*) from events e where e.d = d.day and e.e = 'start')                                         as starts,
  (select count(*) from events e where e.d = d.day and e.e = 'finish')                                        as finishes,
  (select count(distinct r.user_id) from runs r where r.day = d.day)                                          as scored_players,
  (select count(*) from runs r where r.day = d.day and r.game = 'mode')                                       as mode_runs,
  -- coming back: of the players who scored on this day, how many scored the next day
  (select count(distinct r.user_id) from runs r where r.day = d.day
     and exists (select 1 from runs q where q.user_id = r.user_id and q.day = d.day + 1))                     as back_next_day,
  (select round(100.0 * count(distinct r.user_id) filter (where exists (select 1 from runs q where q.user_id = r.user_id and q.day = d.day + 1))
          / nullif(count(distinct r.user_id), 0)) from runs r where r.day = d.day)                             as back_next_day_pct,
  -- spreading
  (select count(*) from events e where e.d = d.day and e.e in ('share', 'clip'))                              as shares,
  (select count(*) from events e where e.d = d.day and e.e = 'export')                                        as exports,
  -- Crate Club
  (select count(*) from events e where e.d = d.day and e.e = 'club_view')                                     as club_views,
  (select count(*) from events e where e.d = d.day and e.e = 'checkout_start')                                as checkouts_started,
  (select count(distinct e.user_id) from events e where e.d = d.day and e.e = 'club_join')                    as new_members,
  (select count(*) from memberships m where m.status in ('active', 'trialing', 'past_due'))                    as members_now
from days d
order by d.day desc;
revoke all on public.daily_metrics from anon, authenticated;
create index if not exists events_d_e on public.events (d, e);
