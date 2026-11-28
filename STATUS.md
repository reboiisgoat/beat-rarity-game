# STATUS — 28 Nov 2026 (launch)

**Phase:** B launched (single-file game + Supabase + Stripe). `main` = `launch-b1` merged. Live at https://beatrarity.com (GitHub Pages, redeploys on every push to `main`).

## What works (tested in Chrome, 375px + desktop)
- Daily beat (classic) + Mode of the day (9 modes, seeded 9-day deal) + guest instrument per puzzle; tempos 72–105 BPM.
- Scoring: rarity ladder, Fresh (3, near the crowd, first 2 per lane), fit rule ("Doesn't fit" = 0), Grails, clash cap, run/drone checks with live warnings; tiers 22/32/45/70 (scaled per mode); "heavier than X%"; tests pass (`node tests/acceptance.mjs`).
- Clap row, chords (up to 4 per step), hat rolls (double-tap on phones, right-click on computers), glide, scale guide, crowd spots (icon), rule ghost + Lock-in hint, one practice run per day per game.
- Sound of the day (12 packs, 7 new melody voices, 808 flavours, drum characters); mix pass (drums up front, master chain, swing); Drop plays as a build-up before the full beat.
- iPhone Drop-round lag: baked samples + voice clean-up (≈5× less audio work in Chrome's phone mode; needs confirming on a real iPhone).
- Tester build (`scripts/build-tester.mjs`) published as a private artifact, with Judge (blind ratings). Two judge rounds done (82 ratings): near-crowd notes add uniqueness without hurting sound; fit rule from round 1; sounds reworked from ratings.
- Recorded kits (user-picked from a CC0 / public-domain sample picker): 8 drum kits on 13 of 19 packs, 12 multi-sampled instruments (7 new packs), 6 recorded basses, recorded Drop effects; per-day loading with synth fallback; full game played through on phone + desktop widths with no errors.
- Electric guitar is FluidR3_GM (CC BY 3.0, credited); acoustic is now the CC0 Martin. Music box/organ packs replaced, big-room drums retired, guests choir → bells and vocal chops → synth lead.
- Start can't freeze: the transition always clears, sound failures don't block a run, sounds pre-build after Tap to enter (5 s timeout, falls back to live synthesis), audio watchdog, and a visible error note with the message (last error kept in localStorage `beatrarity:lasterror`).
- Results: weigh-in, histogram, price list, swap, crowd glow/map, Grails, share card, friend challenge links.
- Menu radio, lane info cards, archive replay/view, logo → menu, phone bottom bar, audio perf fixes.

## Launched — 28 Nov 2026 (`launch-b1` merged into `main`)
- Live at beatrarity.com with accounts, real crowd, server-scored runs, weekly leagues, streak sync, exports, clips, reminders, data export/delete. /beta/ now redirects to the game.
- Security pass (28 Nov): challenge links whitelisted (a crafted link could run code before), other players' names escaped, Content Security Policy, anti-framing, generic sign-in message (no email enumeration), `#day-N` tester-only (it leaked future days and skipped the archive lock), DB hardening migration (`20261128020000_hardening.sql`: name filter, size limits, event cap), webhook ignores sandbox events and unpaid checkouts.
- Fixes: intro animation on computers (reduced-motion setting removed it entirely; now a calm version) and scaled up on desktop; weigh-in no longer throws if the screen changes mid-animation.
- Tested: core acceptance, globals, local Postgres with the strict-project grants, mocked online/offline/club/diagnostics/growth/intro browser tests, and a sweep of days 1–14 + Mode of the day (all 9 modes) on phone and desktop — no errors, no layout overflow, no CSP violations.
- Crate Club shows "opening soon" until live Stripe links replace the sandbox links (Stripe identity review pending).
- Still to do by Rehan: run the hardening migration if the GitHub integration doesn't; redeploy `stripe-webhook`; when Stripe approves: live payment links → `CLUB_LINKS`, live portal → `PORTAL_URL`, live webhook + its `whsec` in Supabase secrets; Enforce HTTPS on GitHub Pages; sole-trader registration before income; legal review of drafts.

## Anti-cheat — merged 28 Nov 2026
- Scored runs limited to 3 per internet connection per day per game (keyed, per-day scramble of the address, cleared after 2 days); extra runs are practice with a notice.
- Cloudflare Turnstile human check before an account is created or a sign-in email is sent (off until `TURNSTILE_SITE_KEY` is set; if blocked, the game plays offline).
- Crate Club status read from the database each visit; the device copy is only an offline fallback for 3 days. Streak freezes capped by the database (2, Club 3).
- Tested: function run locally against a fake database (3 runs from one connection scored, 4th and 5th practice, other connection scored), migration on local Postgres, browser tests incl. human-check token on sign-up and sign-in, blocked human check, forged device membership (no longer unlocks perks).
- Setup order: `docs/SETUP-SUPABASE.md` §7. Migration + submit-run deployed by Rehan; Turnstile site key live; CAPTCHA switch in Supabase is the last step.

## Stubbed / faked
- The crowd starts as a hand-authored seed that fades as real runs arrive.
- Clap, guest rows and Chords have no seed data, so they score Fresh until real players exist.
- Tiers are tuned with the simulator, not real runs.

## Decisions this session not in the design doc
- Unused cells score Fresh instead of Dead wax 0 (now 3, near the crowd, cap 2/lane); tiers 22/34/55/100 → 25/40/58/85 → 22/32/45/70 (judge round 1).
- Fit rule: rare/fresh notes that clash with their neighbours score 0 (user: "a rare spot is useless if the note next to it doesn't match").
- Hidden checks are shown live as warnings (were silent until the weigh-in).
- Modes are a separate daily puzzle (Mode of the day), not twists on the daily beat; the pick-any-mode screen was dropped.
- Practice blind removed; practice limited to one run per day per game.
- The whole Drop part plays in the build-up bar (impacts no longer land on the drop).

## Next 3 steps
1. Open Crate Club when Stripe approves the account (swap in live links, portal, webhook secret).
2. Watch `daily_metrics` (D1/D7, finishes, shares) during the first promo push; play on a real iPhone.
3. Retune tiers with `scripts/tune-tiers.mjs` once ~200 real runs exist.

## Known risks
- Pretend-crowd calibration may not match real behaviour, especially for Fresh-heavy lanes.
- Guest sounds and new melody voices balanced by measurement, not by ear on many devices.
- iPhone performance fix verified only in Chrome's phone emulation (no Safari available in the build environment).
- Recorded sounds need the network on first load of a day (assets/samples, ~5.5 MB total, ~200–400 KB per day); offline they fall back to synth. Sample levels and bell pitches were set by measurement, not by ear.
- Only the electric guitar needs a credit (CC BY 3.0); index.html ~480 KB.
- Judge findings come from one listener (82 ratings); rare spots only mean something once real players exist.
- Clearing storage gives a new account; on `anti-cheat` that's capped at 3 scored runs per connection per day (switching networks still gets one more).
- Someone rewriting the game's code can turn on cosmetic Club extras on their own screen (never score, league, or badge).
