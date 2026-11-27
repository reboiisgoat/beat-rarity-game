-- Beat Rarity · explicit table permissions.
-- Newer Supabase projects don't always give new tables to the API roles automatically, which leaves every insert and
-- select failing with "permission denied" even though row level security is set up. Grant exactly what each role needs.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

-- the server (Edge Functions) can read and write everything; it bypasses row level security
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- players: only what the policies allow
grant select, insert on public.profiles to authenticated;
grant update (handle, streak) on public.profiles to authenticated;
grant select on public.runs to authenticated;
grant select on public.memberships to authenticated;
grant insert on public.events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- functions the game calls
grant execute on function public.day_pool(int, text) to anon, authenticated;
grant execute on function public.league_table() to authenticated;
grant execute on function public.br_today() to anon, authenticated;
grant execute on function public.br_week(int) to anon, authenticated;
