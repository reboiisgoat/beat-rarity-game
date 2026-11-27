# Supabase setup (Phase B1)

Project: `https://zktvbvlmxlgkxbdjrovd.supabase.co`. The game only ever uses the **publishable** key. The secret key stays inside Supabase (Edge Functions read it automatically); never paste it anywhere else.

## 1. Auth settings (Dashboard → Authentication)
- **Sign In / Providers:** turn on **Allow anonymous sign-ins**; keep **Email** on.
- **URL Configuration:**
  - Site URL: `https://reboiisgoat.github.io/beat-rarity-game/`
  - Redirect URLs: add `https://reboiisgoat.github.io/beat-rarity-game/**`
- **Attack Protection:** turn on CAPTCHA later if bots start creating accounts.

## 2. Database
Either:
- **GitHub integration:** merging `supabase/migrations/20261127200000_launch_b1.sql` into `main` applies it, or
- **By hand:** Dashboard → SQL Editor → New query → paste the whole file → Run. It's safe to run twice.

Check: Table Editor shows `profiles`, `runs`, `league_members`, `memberships`, `events`, each with RLS enabled.

## 3. Edge Function `submit-run`
Dashboard → Edge Functions → **Deploy a new function** → **Via Editor**:
1. Name it exactly `submit-run`.
2. Replace the editor's `index.ts` with the whole of `server/submit-run.bundle.ts`.
3. Deploy.
4. Open the function → **Details / Settings** → turn **Enforce JWT verification OFF** → Save. (The function checks the player's sign-in itself.)

No secrets to add: Supabase gives Edge Functions their own URL and secret key automatically.

After any change to the game's scoring core, run `node scripts/build-server.mjs` and redeploy the function.

## 4. Check it works
Open the game, play today's beat, then:
- Table Editor → `runs`: a new row with your score.
- `profiles`: a row with a name like `dusty.kick123`.
- `league_members`: you're in this week's league.
- SQL Editor: `select * from daily_metrics;` shows players per day and how many came back.

## Useful SQL
```sql
-- players and returners per day
select * from daily_metrics;
-- rename an offensive league name
update profiles set handle = 'renamed.' || floor(random()*1000) where handle = 'badname';
```
