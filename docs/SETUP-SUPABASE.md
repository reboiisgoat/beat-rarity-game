# Supabase setup (Phase B1)

Project: `https://zktvbvlmxlgkxbdjrovd.supabase.co`. The game only ever uses the **publishable** key. The secret key stays inside Supabase (Edge Functions read it automatically); never paste it anywhere else.

## 1. Auth settings (Dashboard → Authentication)
- **Sign In / Providers:** turn on **Allow anonymous sign-ins**; keep **Email** on.
- **URL Configuration:**
  - Site URL: `https://beatrarity.com/`
  - Redirect URLs: add `https://beatrarity.com/**` and `https://www.beatrarity.com/**` (keep the old github.io one too while it forwards)
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

## 5. Edge Function `delete-account`
Same as step 3: new function named `delete-account`, paste `server/delete-account/index.ts`, deploy, turn **Enforce JWT verification OFF**. Powers "Delete my data" (GDPR).

## 6. Stripe → Crate Club (Phase B2)
Do it in **test mode** first; repeat in live mode when you launch.

1. **Payment links → each link → Edit → After payment:** "Don't show confirmation page" → redirect to
   `https://beatrarity.com/?club=thanks`
2. **Edge Function `stripe-webhook`:** new function named `stripe-webhook`, paste `server/stripe-webhook/index.ts`, deploy, turn **Enforce JWT verification OFF**.
3. **Stripe → Developers → Webhooks → Add endpoint:**
   - URL: `https://zktvbvlmxlgkxbdjrovd.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Save, then **Reveal** the signing secret (`whsec_…`).
4. **Supabase → Edge Functions → Secrets → Add:** name `STRIPE_WEBHOOK_SECRET`, value = that `whsec_…`. Type it here only — never in chat, the game or GitHub.
5. **Stripe → Settings → Billing → Customer portal:** allow cancelling; copy the **login link** into `PORTAL_URL` in index.html (or send it to Claude).
6. **Test:** in the game, save your progress with an email, open Crate Club, pay with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). You land back in the game; within a few seconds Crate Club turns on. Check Table Editor → `memberships`.

**Going live:** switch Stripe to live mode, make the same product, prices, links, webhook and portal there, replace `CLUB_LINKS` / `PORTAL_URL` with the live ones, and replace `STRIPE_WEBHOOK_SECRET` with the live `whsec_…`.

## 7. Anti-cheat (28 Nov) — do these in this order
1. **Database:** SQL Editor → run `supabase/migrations/20261128030000_anti_cheat.sql` (adds the connection code to runs, caps streak freezes at 2 / 3 for Club). Safe to run twice.
2. **submit-run:** Edge Functions → `submit-run` → paste `server/submit-run.bundle.ts` → Deploy. It now allows 3 scored runs per internet connection per day (`RUNS_PER_CONNECTION`); extra runs come back as practice.
3. **Human check (Cloudflare Turnstile):** Cloudflare dashboard → Turnstile → Add widget → name "Beat Rarity", hostname `beatrarity.com`, mode **Managed** → create. Send the **site key** (public) so it goes into `TURNSTILE_SITE_KEY` in index.html and is pushed live.
4. **Only after that is live:** Supabase → Authentication → Attack Protection → turn on CAPTCHA protection → provider Turnstile → paste the **secret key** yourself → Save. (Turning it on first would stop new players from getting accounts; the game would still play, offline.)

## 8. Sign-in codes (28 Nov)
The game lets players type the code from the email, so signing in works on the device they're playing on even if they read email on another one. Supabase → Authentication → Emails → Templates:
- **Magic Link:** add `<p>Or type this code in the game: <b>{{ .Token }}</b></p>`
- **Change Email Address:** add the same line (used by "Save my progress").
