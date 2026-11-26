# STATUS — 26 Nov 2026 (evening)

**Phase:** A+ (single-file game; no backend). `main` = sound-picks merged (`3decce9`) + docs. Live at https://reboiisgoat.github.io/beat-rarity-game/ (redeploys on every push to `main`).

## What works (tested in Chrome, 375px + desktop)
- Daily beat (classic) + Mode of the day (9 modes, seeded 9-day deal) + guest instrument per puzzle; tempos 72–105 BPM.
- Scoring: rarity ladder, Fresh (3, near the crowd, first 2 per lane), fit rule ("Doesn't fit" = 0), Grails, clash cap, run/drone checks with live warnings; tiers 22/32/45/70 (scaled per mode); "heavier than X%"; tests pass (`node tests/acceptance.mjs`).
- Clap row, chords (up to 4 per step), hat rolls (double-tap on phones, right-click on computers), glide, scale guide, crowd spots (icon), rule ghost + Lock-in hint, one practice run per day per game.
- Sound of the day (12 packs, 7 new melody voices, 808 flavours, drum characters); mix pass (drums up front, master chain, swing); Drop plays as a build-up before the full beat.
- iPhone Drop-round lag: baked samples + voice clean-up (≈5× less audio work in Chrome's phone mode; needs confirming on a real iPhone).
- Tester build (`scripts/build-tester.mjs`) published as a private artifact, with Judge (blind ratings). Two judge rounds done (82 ratings): near-crowd notes add uniqueness without hurting sound; fit rule from round 1; sounds reworked from ratings.
- Recorded acoustic + distorted electric guitars (FluidR3_GM, CC BY 3.0, credited); music box/organ packs replaced, big-room drums retired, guests choir → bells and vocal chops → synth lead.
- Start can't freeze: the transition always clears, sound failures don't block a run, sounds pre-build after Tap to enter (5 s timeout, falls back to live synthesis), audio watchdog, and a visible error note with the message (last error kept in localStorage `beatrarity:lasterror`).
- Results: weigh-in, histogram, price list, swap, crowd glow/map, Grails, share card, friend challenge links.
- Menu radio, lane info cards, archive replay/view, logo → menu, phone bottom bar, audio perf fixes.

## Stubbed / faked
- **The crowd is a hand-authored seed** (+ pretend players trying one fresh idea). No real submissions leave the browser.
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
1. Playtest round 3 on the live site, iPhone included (a Start freeze was reported on iPhone; if the error note appears, screenshot it): Drop round smooth?, drums vs 808 balance, sounds of the day, double-tap rolls, Mode of the day uptake.
2. Phase B: Supabase pool — log first runs (daily + mode), real shares, close-of-day finalisation.
3. Retune tiers with `scripts/tune-tiers.mjs` once ~200 real runs exist; optional pairwise "which is better / more unique" session to sanity-check them.

## Known risks
- Pretend-crowd calibration may not match real behaviour, especially for Fresh-heavy lanes.
- Guest sounds and new melody voices balanced by measurement, not by ear on many devices.
- iPhone performance fix verified only in Chrome's phone emulation (no Safari available in the build environment).
- Guitars are recorded samples (CC BY 3.0, credit required); everything else is synthesised. index.html is ~590 KB because of the embedded guitar notes.
- Judge findings come from one listener (82 ratings); rare spots only mean something once real players exist.
- Device-ID dedupe only; clearing storage allows a second scored run.
