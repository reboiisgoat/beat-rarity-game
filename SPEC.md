# Beat Rarity Game — SPEC v4 (matches `main` = full-beat + ui-sound-pass + pixel-sprites)

Intent lives in the design conversation (Project Knowledge). This file describes what is built on `main`.

**One line:** A free daily browser game. Producers build a one-bar beat in four rounds; each note scores by how few players put a note in the same cell. Rarity, never quality. No votes, no leaderboard, no ELO.

## Daily run (single `index.html`, no dependencies, no backend)
- Puzzle No. = days since `CONFIG.LAUNCH_DATE` (UTC). 15-day rotation: 13 hand-authored puzzles (different scale, BPM, kit, FX palette) + two returns with a twist (Night Shift with a blind melody round on day 9, Basement slowed to 68 BPM on day 15). `#day-N` jumps to a day as practice (testing aid).
- Four rounds, 45 s each, loop always playing: **Drums** (kick/snare/hat, 12 notes; right-click or long-press a hat to roll it ×2–×4) → **808** (8 scale rows, one note per step, glide, 6 notes) → **Melody** (8 scale rows, stack any number of notes per step, 8 notes) → **The Drop** (riser/impact/chop, 3 notes, counts 2×; plays as a build-up bar into the drop).
- Editing aids: Tap sound on/off (remembered), Solo the current lane, a flash on the note just placed.
- First run of the day is scored and joins the pool; replays and archive runs are unscored practice. Daily streak in localStorage.

## Scoring
- Token per note: `lane:step:row`. Share = fraction of the pool (faded seed + real scored runs) with a note in that cell.
- Ladder: B-side >30% (0.5) · White label 15–30% (2) · Promo 5–15% (4) · Test press ≤5% (7) · Grail = the lane's flagged rarest cell, <1% (12). Cells outside today's crate = Dead wax (0).
- Visible rules gate lock-in (kick on 01, root on 01, 3+ melody notes, 1+ FX); hidden checks (4+ kicks/snares in a row, 4+ same pitch) zero that lane. Fit: kick+snare on one step, or melody doubling the 808's note, caps that lane at 50%.
- Crate weight = sum of lanes (Drop ×2) → tiers B-side / White label (22) / Promo (34) / Test press (55) / Grail (100). "Heavier than X%" ranks against 400 seeded pretend crates + real runs.
- Choice log: one row per note `{round, lane, kind, token}` (+ `glide: true` on 808 notes, `roll: n` on rolled hats; both sound-only).
- `node scripts/tune-tiers.mjs [weights.json]` suggests crate-tier boundaries from crate weights.
- `node tests/acceptance.mjs` checks seeds, budget-spam vs rare, Grail lift, 2× drop, heavier-than, mud/hidden gates, scheduler drift.

## Weigh-in and results
Notes light up one by one on a picture of your beat (tier colour + weight), with a thunk and needle swing; lane subtotals stamp in; the Drop surges with a riser and 2× flash; sub drop on the final stamp. Then: crate weight → tier stamp + tier ladder ("N to go") → heavier-than → Play your beat (build-up → drop) → "Where your weight came from" (records × count, one plain sentence) → "Heavier next time" (the single best swap, drawn on the lane grid, Hear the swap) → Hidden Grails → share card + copy text → choice log.

## Look and sound (Panel direction + pixel art)
- Roland TR-808 panel + cream VU meter. Tier colours = 808 step keys. Silkscreen (pixel headings), Archivo Narrow (labels), Chivo Mono (numbers), all embedded as base64 woff2. Stepped pixel borders.
- Original pixel sprites drawn in code: crate-digger (start, booth, results), record crate that fills during the weigh-in, tier vinyls, lane icons, per-round instruments (kit, speakers, keys, FX meter) reacting to notes. Tap-to-enter intro; ~0.6 s pixel sweep on Start. iPhone silent-switch hint.
- Synth: saturated kick with sub + click; transient-first snare/clap; 808-cluster hats (closed, slightly open on the "&", choke); 808 with punch, portamento and an asymmetric-saturation layer for phone speakers; FM bell / electric keys / detuned pluck / moving lead; riser, impact, vowel chop; shared room + dotted-8th delay; master glue + soft clip.

## Out of scope (Phase B/C)
Accounts, payments, Supabase/live pool, real samples, DAW export, ratings, paid archive, leaderboard.
