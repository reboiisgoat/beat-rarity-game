# Beat Rarity Game — SPEC v2 (matches `main` = the full-ui build)

Intent lives in the design conversation (Project Knowledge). This file describes what is built on `main`.

**One line:** A free daily browser game. Producers make three small choices that build a one-bar loop over a fixed kick. Valid choices score more the fewer other players made them. Rarity, never quality. No votes, no leaderboard, no ELO.

## What's built (single `index.html`, no dependencies, no backend)
- **Daily puzzle:** puzzle No. = days since `CONFIG.LAUNCH_DATE` (UTC); 3 hand-authored puzzles rotate. `#puzzle-N` previews one without saving.
- **Anchor:** a fixed kick pattern (with marked accents) plays under every round.
- **Rounds:** 1 Sound (pick 1 of 6 synthesised voices), 2 Pattern (16-step grid, visible rules as chips), 3 Tweak (pitch in semitones, or low cut).
- **Validity gate:** visible rules gate submit; hidden checks (no 4+ hits in a row, no copy of the anchor) zero that round only.
- **Rarity:** sound/tweak points = 100 × (1 − share); pattern = 100 × min(d, D_CAP)/D_CAP, d = Hamming distance to the nearest pool pattern. Scored before your pick joins the pool.
- **Pool:** hand-authored seed (faded by `1 − real/200`) + this browser session's submissions.
- **Craft (0–100):** penalties for off-key pitch, range fight with the kick, hits on kick accents.
- **Coherence:** each round pays `min(rarity, (Craft − 50)/30 × 100)` — "the deeper the cut, the tighter the fit must be".
- **Depth** = sum of rounds (0–300) → tiers Surface Bin / Dusty Shelf / Back Room / Vault / One in a Crillion.
- **Result:** per-round ✓/✗, stats, capping explained, full distribution reveal, share card + copy, choice log `{round, kind, token}` + copy.
- First run of the day is saved as the day's card (localStorage); replays allowed.
- `node tests/acceptance.mjs` re-checks scoring and scheduler timing.

## Next
`full-beat` branch: four-lane beat builder (drums, 808, melody, FX drop), note budgets, rarity-ladder weights, weigh-in reveal, streaks, archive, 8+ puzzles. Its prompt supersedes this spec when merged.

## Out of scope (Phase B/C)
Accounts, payments, Supabase/live pool, real samples, DAW export, ratings, paid archive, leaderboard.
