-- Beat Rarity · anti-cheat: per-connection limit on scored runs, and Club-only streak freezes enforced by the database.
-- Safe to run more than once. Run this BEFORE deploying the new submit-run.

-- a scrambled per-day code of the player's connection (written only by submit-run; cleared after 2 days)
alter table public.runs add column if not exists ip_hash text;
create index if not exists runs_day_game_ip on public.runs (day, game, ip_hash) where ip_hash is not null;

-- streak freezes: 2, or 3 for Crate Club members. A player editing their device can't save more.
create or replace function public.br_streak_cap() returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; f numeric;
begin
  if new.streak ? 'freezes' then
    cap := case when exists (select 1 from memberships m where m.user_id = new.id and m.status in ('active', 'trialing', 'past_due')) then 3 else 2 end;
    f := case when jsonb_typeof(new.streak->'freezes') = 'number' then (new.streak->>'freezes')::numeric else 0 end;
    if f > cap or f < 0 or f <> trunc(f) then
      new.streak := jsonb_set(new.streak, '{freezes}', to_jsonb(least(cap, greatest(0, trunc(f))::int)));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_streak_cap on public.profiles;
create trigger profiles_streak_cap before insert or update of streak on public.profiles for each row execute function public.br_streak_cap();
revoke all on function public.br_streak_cap() from public, anon, authenticated;
