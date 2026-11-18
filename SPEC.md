# Beat Rarity Game — SPEC v3 (matches `main` = full-beat + ui-sound-pass)

Intent lives in the design conversation (Project Knowledge). This file describes what is built on `main`.

**One line:** A free daily browser game. Producers build a one-bar beat in four rounds; each note scores by how few players put a note in the same cell. Rarity, never quality. No votes, no leaderboard, no ELO.

## Daily run (single `index.html`, no dependencies, no backend)
- Puzzle No. = days since `CONFIG.LAUNCH_DATE` (UTC). 8 hand-authored puzzles (different scale, BPM, kit, FX palette) + Night Shift returning on day 9 with a blind melody round. `#day-N` jumps to a day as practice (testing aid).
- Four rounds, 45 s each, loop always playing: **Drums** (kick/snare/hat, 12 notes) → **808** (8 scale rows, mono, glide, 6 notes) → **Melody** (8 scale rows, mono, 8 notes) → **The Drop** (riser/impact/chop, 3 notes, counts 2×).
- First run of the day is scored and joins the pool; replays and archive runs are unscored practice. Daily streak in localStorage.

## Scoring
- Token per note: `lane:step:row`. Share = fraction of the pool (faded seed + real scored runs) with a note in that cell.
- Ladder: B-side >30% (0.5) · White label 15–30% (2) · Promo 5–15% (4) · Test press ≤5% (7) · Grail = the lane's flagged rarest cell, <1% (12). Cells outside today's crate = Dead wax (0).
- Visible rules gate lock-in (kick on 01, root on 01, 3+ melody notes, 1+ FX); hidden checks (4+ kicks/snares in a row, 4+ same pitch) zero that lane. Fit: kick+snare on one step, or melody doubling the 808's note, caps that lane at 50%.
- Crate weight = sum of lanes (Drop ×2) → tiers B-side / White label (22) / Promo (34) / Test press (55) / Grail (100). "Heavier than X%" ranks against 400 seeded pretend crates + real runs.
- Choice log: one row per note `{round, lane, kind, token}` (+ `glide: true` on 808 notes).
- `node tests/acceptance.mjs` checks seeds, budget-spam vs rare, Grail lift, 2× drop, heavier-than, mud/hidden gates, scheduler drift.

## Weigh-in (behaviour fixed)
Notes drop onto the scale one at a time with a thunk, needle swings, lane subtotals stamp in; the Drop surges with a riser and 2× flash; sub drop on the final stamp. Then: crate weight → tier stamp → heavier-than → Play your beat → per-lane "Hear the Grail" (plays your beat with the Grail inserted) → share card + copy text (emoji grid) → choice log.

## Look and sound (Panel direction)
- Roland TR-808 panel + cream VU meter. Tier colours = 808 step keys. Archivo Narrow (labels) + Chivo Mono (numbers), embedded as base64 woff2. Style guide: "Beat Rarity style guide" artifact.
- Synth: saturated kick with sub + click; transient-first snare/clap; 808-cluster hats (closed, slightly open on the "&", choke); 808 with punch, portamento and an asymmetric-saturation layer for phone speakers; FM bell / electric keys / detuned pluck / moving lead; riser, impact, vowel chop; shared room + dotted-8th delay; master glue + soft clip.

## Out of scope (Phase B/C)
Accounts, payments, Supabase/live pool, real samples, DAW export, ratings, paid archive, leaderboard.
