# STATUS — 19 Nov 2026

**Phase:** A+ (single-file game complete; no backend). `main` = `e976123` + docs. Playable at GitHub Pages (main) and the "Beat Rarity — pixel prototype" artifact.

## What works (tested in Chrome, 375px + desktop)
- 4 rounds (drums, 808, melody, The Drop ×2), 45 s each, note budgets, 15-day puzzle rotation, archive, streaks, practice replays.
- Scoring: rarity ladder per note, dead wax, Grails, mud cap, hidden checks; "heavier than X%"; tests pass (`node tests/acceptance.mjs`).
- Weigh-in reveal, tier ladder, weight breakdown, best-swap tip with grid, Grail playback, build-up → drop playback, share card/text, choice log.
- Synth engine (Panel sound pass), pixel sprites/animations, intro, Start sweep, tap-sound/solo toggles, hat rolls (right-click/long-press), melody stacking, iOS silent-switch hint.

## Stubbed / faked
- **The crowd is a hand-authored seed.** No real submissions leave the browser; "heavier than X%" is vs 400 pretend crates.
- Stacked melody notes mostly score 0 (seeds have no stacked notes) until real data arrives.
- Crate tiers and ladder weights are tuned to the pretend crowd.

## Decisions this session not in the design doc
- Panel visual direction + pixel aesthetic; chord control replaced by free stacking; hat roll via right-click/long-press.
- The Drop plays as a build-up bar, then the drop.
- Glide and roll are sound-only (not scored).

## Next 3 steps
1. Playtest: send the GitHub Pages link to 5 producers (FL users); watch round 1 comprehension, end-screen replays, sound reactions.
2. Phase B: Supabase pool — log first runs, score against real shares, close-of-day finalisation.
3. Retune tiers/weights with `scripts/tune-tiers.mjs` once ~200 real runs exist.

## Known risks
- Placement feels like guessing without some signal of where the crowd sits (see design note in chat, 19 Nov).
- Pretend-crowd calibration may not match real behaviour.
- Device-ID dedupe only; replays can't enter the pool, but clearing storage can.
