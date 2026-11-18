# Beat Rarity Game — SPEC v1 (approved plan; Phase A build pending)

Intent lives in DESIGN_CONVERSATION. This file governs scope: what we build, per phase. Where they conflict, SPEC wins on what to build now; DESIGN_CONVERSATION wins on what the product is meant to be.

**One line:** A free daily browser game where producers make small step-sequencer choices under constraints. Valid choices score more the fewer other players made them that day.

**Scored axis:** rarity among valid choices, never quality. No voting, ELO or "best beat" ranking. Ratings (later) may only grow/prune the valid set and never enter any score. Share card only, no leaderboard (§3 of the design doc wins; the §8 "free leaderboard" line was an error).

## Settled decisions (answers to clarifying questions)
1. Scoring: live provisional score (labelled "provisional"), final at day close. Phase A: live only, no label. Phase B adds the close job.
2. Hidden-rule failure: 0 for that round, run continues. Keep the hidden set small; only egregious cases.
3. One scored play per person: per-browser ID + local storage (A–B). Rate limiting + dedupe before real scoring. Known hole, not solved.
4. Paid packs never appear in scored dailies (practice/archive only). Hard line.
5. Grid: one lane, on/off, 16 steps in Phase A. Multi-lane is Phase C.
6. Round order fixed: sound → pattern → tweak (Phase B). Per-puzzle round sequences are Phase C.
7. Three decisions building one loop. Confirmed.
8. Depth score = 0–300 total mapped to named tiers on the share card (Surface Bin 0–99, Dusty Shelf 100–169, Back Room 170–229, Vault 230–279, One in a Crillion 280–300). Tiers are provisional until retuned by simulate.js. No tier names before Phase B.
9. Puzzles: JSON files in repo through Phase B; admin page Phase C.
10. Sounds: browser-generated in Phase A.
- Result screen shows the full distribution (common choices and deep cuts), not just "8% chose this". Phase B.
- Day boundary 00:00 UTC. Between rounds no scores/stats are shown.
- **Anchor:** each puzzle includes one fixed anchor sound + pattern (Phase B on). Craft is judged against it.

## Daily run
Same puzzle for everyone. Each puzzle fixes tempo, 1-bar 16-step grid, 4–6 sounds, prompt, per-round rules, and (Phase B) an anchor. Rounds: **Sound** (pick sample), **Pattern** (place hits within the rule), **Tweak** (one fixed-option parameter; Phase B). First completed run counts; replays are unscored practice.

Player sees: start screen (date, puzzle #, prompt, rule chips, "Round n of N") → round (picker/grid, Play/Stop, chips turn green when rules are met, Submit only when met) → no stats between rounds → result (per-round valid ✓/✗, rarity stat, points, total, share card).

## Scoring
- **Validity gate (authored):** visible rules checked pre-submit; hidden curated valid set checked after. Invalid round = 0.
- **Sound / param points** = 100 × (1 − share of pool making same choice).
- **Pattern points** = 100 × min(d, D_CAP) / D_CAP, d = Hamming distance to nearest pattern in pool. D_CAP = 4 (starting knob; expected to rise to 5–6; Phase B sets it to ~the 75th percentile of d from real data).
- **Pool** = seed + real submissions; seed weight = max(0, 1 − real_submissions/200); log when it drops below 0.2.
- **Phase A total = /200** (sound + pattern), raw score only.
- **Phase B:** total /300 mapped to tiers. **Depth** = rarity over valid rounds. **Craft** (0–100) starts at 100, minus clashes with the anchor (off-key, hits on anchor accents, range fights) from authored tags. **Coherence rule:** a round's rarity only counts if Craft ≥ 50 + 30 × (rarity/100). Rarity gated by validity ("the deeper the cut, the tighter the fit").
- **Pre-publish check (`simulate.js`):** 200 random valid submissions; fail if >30% earn full pattern marks or scores bunch in one tier.

## Phase A — prototype (single `index.html`, plain JS, no backend, no accounts/payments/export)
- Sections: CONFIG (all tunables at top), PUZZLE, SEED, AUDIO, GRID, LOG, SCORING, RESULT.
- **Two rounds:** Sound, then Pattern. 16-step grid, one lane, 4–6 browser-synthesised one-shots. Start button (audio unlock); lookahead scheduling for loop timing.
- **Choice log uses the Phase B `choices` row shape now:** `{round, kind: "sound"|"pattern", token}`. Token = sample ID or 16-char pattern string. No flat choiceLog. Run context (puzzle_id, session_id, ts) wraps the rows. "Copy log JSON" button.
- **Seed is hand-authored and deliberately spread across choices (not uniform)**, so the scoring logic is visibly differentiated.
- Pool = seed + submissions this session (in-memory; no browser storage).
- Result: raw per-round points + total /200. No tier names, no "provisional" label.
- Each scoring change: state old value, new value, why, in one line.

## Phase B — real daily game
Files: `public/index.html`; `src/{config,audio,sequencer,rounds,result,share,scoring}.js` (scoring shared by browser + server); `puzzles/YYYY-MM-DD.json` (public) and `puzzles/private/` (hidden valid sets, Craft tags; server-only); `supabase/migrations/001_init.sql`; `supabase/functions/{submit,close-day}`; `scripts/simulate.js`. Stack: plain JS on Cloudflare Pages/Netlify + Supabase (DB, functions, scheduled job).
Tables: `runs(id, puzzle_id, client_id, ip_hash, started_at, completed_at, is_scored)`; `choices(id, run_id, puzzle_id, round 1–3, kind sound|pattern|tweak, token, valid, craft_penalty, created_at, UNIQUE(run_id, round))`; `seed_counts(puzzle_id, round, token, weight)`; `results(run_id, depth_provisional, depth_final, craft, tier, finalised_at)`. Every decision is logged (powers the distribution reveal). Add multi-round, validity gate, Craft + coherence, result card, share card, provisional→final close job. Scored runs: first per client_id; max 5 per hashed IP/day.
Risks: hidden set leaking to client (keep server-side); browser/server scoring drift (shared `scoring.js`); UTC day boundary vs Dublin summer time; seed miscalibration (simulate.js); client-ID bypass (accepted).

## Phase C — packs + Unlimited
Files: `auth.js, store.js, archive.js, practice.js, export-midi.js, functions/payments-webhook/, migrations/002_entitlements.sql`. Tables: `packs`, `entitlements`, `exports` (free cap 1–2/week). Supabase email-link auth; merchant-of-record payments (Paddle/Lemon Squeezy; verify current terms). DB rejects puzzles using non-core pack sounds. Unlimited = archive + practice + unlimited MIDI export; does not include packs. Idempotent webhook handling. Pack licensing per design doc §9. Multi-lane is a separate decision.

## Ratings (not in A–C)
Schema leaves room for a `ratings` table that must never be joined to `results`. Authored-only for first month; ratings only propose valid-set promotions/demotions.

## Out of scope
Accounts/payments/export (Phase A), raw-audio comparison, any quality ranking, display ads, paywalling the daily.
