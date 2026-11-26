# Beat Rarity Game — SPEC v8 (matches `main` = everything through day-sounds)

Intent lives in the design conversation (Project Knowledge). This file describes what is built on `main`.

**One line:** A free daily browser game. Producers build a one-bar beat part by part; each note scores by how few players put a note in the same cell. Rarity, never quality. No votes, no leaderboard, no ELO.

## Two games a day (single `index.html`, no dependencies, no backend)
- **Daily beat** (classic rules). Puzzle No. = days since `CONFIG.LAUNCH_DATE` (UTC). 15-puzzle rotation (13 originals + Night Shift and Basement returning at new tempos). Tempos 72–105 BPM, standard ≈ 90. First run of the day is scored, joins the pool and counts for the streak; replays and archive runs are practice.
- **Mode of the day**: one mode per day on a different beat (`puzzleForDay(d + 4)`). Modes are dealt in a seeded, shuffled 9-day cycle; no mode repeats within 4 days. First run is scored and saved separately; it stays out of the daily pool and streak. Big teal button under Start.
- **Modes:** Blind (one seeded round can't be heard while writing it) · Minimal (half the notes) · Remix (3–4 locked notes that play but don't score) · Three notes (808/melody limited to root, 3rd, 5th) · Upside down (Drop → Melody → 808 → Drums) · Speed run (20 s rounds) · Dark crate (no crowd spots, no scale guide) · One lane deep (one seeded part, double notes ×2 weight; the rest is the crowd's pattern, unscored) · Full band (5th round: Chords, held pad, up to 4 per step).
- **Sound of the day:** 12 packs dealt in a shuffled 12-day cycle (separate from the puzzles): melody voice (bells, Rhodes, marimba, vibes, music box, flute, organ, brass, koto, pluck, synth lead, piano), 808 flavour (normal, clean sub, sliding, distorted) and drum character (crisp, dusty, tight, big-room). A puzzle's guest sound wins. Sound only, never scored.
- **Guest instrument** per puzzle: a new row (drums: open hat, rimshot, snap, shaker, conga; Drop: air horn, tape stop, reverse cymbal, downlifter) or a sound (melody: piano, guitar, strings, choir, vocal chops; 808: reese).
- **Rounds:** Drums (Hat / Snare / Clap / Kick + guest, 12 notes; right-click a hat (computer) or double-tap it (phone) to roll ×2–×4; instructions match the device) → 808 (8 scale rows, one note per step, glide, 6 notes) → Melody (8 scale rows, up to 4 stacked per step, 8 notes) → The Drop (riser/impact/chop + guest, 3 notes, counts 2×; all of it plays in a build-up bar over hats + melody, then the full beat drops in). 45 s each, loop always playing.
- **Editing aids:** Tap sound, Solo, Crowd spots (little crowd icon on the most-used B-side cells), Scale guide (key strip: root / home / in key / off-key), rule ghost ("tap") on a required empty cell, Lock-in says what's missing, live warnings (red notes) for lane-zeroing runs/drones and half-weight clashes.
- **Practice:** one practice run per day per game (daily beat, Mode of the day), on today after the scored run or on any past day.
- **Friend challenge:** "Copy challenge link" puts the beat and crate in the URL hash; the friend sees "A friend's crate … beat it" and a you-vs-friend bar after their run.

## Scoring
- Token per note: `lane:step:row`. Share = fraction of the pool (faded seed + real scored runs) with a note in that cell.
- Ladder: B-side >30% (0.5) · White label 15–30% (2) · Promo 5–15% (4) · Test press ≤5% (7) · Grail = the lane's flagged rarest cell, <1% (12).
- **Fresh:** a cell nobody in the crate used weighs 4 for the first 2 per lane; more weigh 0 (Dead wax). Rewards one idea per lane, not spraying.
- Visible rules gate lock-in (kick on 01, root on 01, 3+ melody, 2+ chords, 1+ FX); 4+ kicks/snares/claps in a row or a 4-note drone zeroes the lane; kick + snare/clap on one step, or melody doubling the 808, caps the lane at 50%.
- Crate weight = sum of lanes (Drop ×2) → tiers B-side / White label 25 / Promo 40 / Test press 58 / Grail 85. Per mode: Minimal 15/24/35/51, One lane deep 13/20/29/43, Full band 31/50/73/106.
- "Heavier than X%" ranks against 400 seeded pretend crates per variant (35% try one fresh idea) + real runs.
- `node tests/acceptance.mjs` checks seeds, spam vs rare, Grail lift, 2× drop, heavier-than, mud/hidden gates, Fresh cap, clap mud, every puzzle × every mode, mode deal, scheduler drift. `node scripts/tune-tiers.mjs [weights.json]` suggests crate tiers.

## Results
Weigh-in on your lane grids (tier colour + weight per note, crowd glow behind empty cells after) → VU needle → tier + ladder → histogram of today's crates with YOU → Play your beat → you vs friend (if challenged) → price list (one block per note per tier) → best swap as record → record + gain → crowd map → Hidden Grails → share card, share text, challenge link → choice log.

## Look, sound, navigation
- TR-808 panel + VU meter, pixel sprites drawn in code, embedded fonts. Tap-to-enter intro (logo scales to the phone); quick pixel sweep on Start. Logo returns to the main menu (asks first mid-round). Tap a part on the menu for a card with a demo and ▶ Hear it.
- Menu radio: quiet lo-fi loop in the day's key on start/archive; Music toggle.
- Phones: timer / Play / Lock in pinned to the bottom, bigger cells, helper switches in one swipeable row.
- Mix: drum bus (glue compression, louder kick knock / snare crack / accented hats), 808 tucked under the kick, melody bus; master low-cut, air shelf, glue, limiter, soft clip (≈ −7 LUFS). Swing per style at playback only.
- Audio performance: drum hits, melody/chord notes and fixed FX are baked into samples per puzzle at the start of a run (≈5× less work than live synthesis); finished live voices are disconnected; phones get lighter voices, mono short room and a 0.25 s lookahead; max 8 melody/chord voices; any tap resumes suspended audio.
- Tester build: `node scripts/build-tester.mjs` makes a page with a day browser (today + 30 days: beat, sound, guest, mode; hear demos, open any day as practice; separate saves). Not part of the live site.
- Archive: last 30 days, with your daily crate, practice or mode crate per day (view & play).

## Out of scope (Phase B/C)
Accounts, payments, Supabase/live pool, real samples, DAW export, ratings, paid archive, leaderboard.
