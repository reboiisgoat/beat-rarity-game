// Core self-test: node tests/acceptance.mjs   (no dependencies)
import fs from "fs"; import vm from "vm";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const core = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const fresh = () => vm.runInNewContext(core + ";({CONFIG,PUZZLES,LANES,scoreRun,shareOf,visibleRules,hiddenProblems,mudOf,heavierThan,crowdBeats,schedulerAdvance,shareText,tok,sortNotes})");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const C = fresh(), { PUZZLES, LANES, CONFIG } = C;
const verbose = process.argv.includes("-v");

// ---------- authoring sanity ----------
for (const pz of PUZZLES) {
  const errs = [];
  for (const L of LANES) {
    const lane = pz.L[L.id];
    const sum = lane.arche.reduce((a, b) => a + b.count, 0);
    if (Math.abs(sum - CONFIG.SEED_PLAYERS) > 1e-9) errs.push(`${L.id} archetypes sum ${sum}`);
    for (const a of lane.arche) {
      const beat = { drums: [], bass: [], mel: [], fx: [] }; beat[L.id] = a.notes;
      if (a.notes.length > L.budget) errs.push(`${L.id} archetype over budget (${a.notes.length})`);
      if (!C.visibleRules(pz, L, a.notes).every(r => r.ok)) errs.push(`${L.id} archetype fails visible rules`);
      const h = C.hiddenProblems(pz, L, a.notes); if (h.length) errs.push(`${L.id} archetype hidden: ${h}`);
      if (C.mudOf(pz, L, beat).length) errs.push(`${L.id} archetype has mud`);
      if (L.mono && new Set(a.notes.map(n => n.step)).size !== a.notes.length) errs.push(`${L.id} archetype not mono`);
      if (a.notes.some(n => n.row < 0 || n.row > (L.pitched ? 7 : 2))) errs.push(`${L.id} bad row`);
    }
    const archeToks = new Set(lane.arche.flatMap(a => a.notes.map(n => C.tok(L.id, n.step, n.row))));
    for (const t of Object.keys(lane.rares)) if (archeToks.has(t)) errs.push(`${L.id} rare ${t} is also in an archetype`);
    const shares = [...lane.valid].map(t => [t, C.shareOf(pz, L.id, t)]).sort((a, b) => a[1] - b[1]);
    if (shares[0][0] !== lane.grail) errs.push(`${L.id} grail ${lane.grail} is not the min-share token (${shares[0][0]})`);
    if (C.shareOf(pz, L.id, lane.grail) >= 0.01) errs.push(`${L.id} grail share ≥ 1%`);
  }
  ok(!errs.length, `${pz.id}: seeds valid, mono, in budget, no mud; grails are the rarest cells${errs.length ? " — " + errs.join("; ") : ""}`);
}

// ---------- helpers to build test beats ----------
const empty = () => ({ drums: [], bass: [], mel: [], fx: [] });
const parse = (L, t) => { const [, s, r] = t.split(":").map(Number); return { step: s, row: r }; };
function commonLane(pz, L) {      // spend the whole budget on the most common cells
  const ranked = [...pz.L[L.id].valid].map(t => [t, C.shareOf(pz, L.id, t)]).sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [t] of ranked) { const n = parse(L, t); if (out.length >= L.budget) break; if (L.mono && out.some(x => x.step === n.step)) continue;
    if (L.id === "drums" && n.row < 2 && out.some(x => x.step === n.step && x.row < 2)) continue; out.push(n); }
  return out;
}
function rareLane(pz, L, beat) {   // a few Test-press cells + whatever the visible rule needs
  const need = { drums: ["drums:0:0"], bass: ["bass:0:0"], mel: [], fx: [] }[L.id].map(t => parse(L, t));
  const out = need.slice(), nscale = C.PUZZLES[0] && pz.scale && ({ minPent: 5, majPent: 5, minBlues: 6 }[pz.scale] || 7);
  const ranked = [...pz.L[L.id].valid].filter(t => t !== pz.L[L.id].grail).map(t => [t, C.shareOf(pz, L.id, t)])
    .sort((a, b) => a[1] - b[1]);                // rarest first (Test press, then Promo if a lane runs short)
  for (const [t] of ranked) {
    if (out.length >= need.length + 3) break;
    const n = parse(L, t);
    if (L.mono && out.some(x => x.step === n.step)) continue;
    if (L.id === "drums" && n.row < 2 && out.some(x => x.step === n.step && x.row < 2)) continue;
    if (L.id === "mel" && beat.bass.some(b => b.step === n.step && b.row % nscale === n.row % nscale)) continue;
    out.push(n);
  }
  return out;
}

const allSpam = [], allRare = [];
for (const pz of PUZZLES) {
  const spam = empty(), rare = empty();
  for (const L of LANES) { spam[L.id] = commonLane(pz, L); rare[L.id] = rareLane(pz, L, rare); }
  const a = C.scoreRun(pz, spam), b = C.scoreRun(pz, rare);
  allSpam.push(a.total); allRare.push(b.total);
  ok(b.total > a.total * 1.5, `#3 ${pz.id}: budget spam ${a.total} (${a.lanes.map(l => l.total).join("+")}) vs sparse rare ${b.total} (${b.lanes.map(l => l.total).join("+")}), notes ${LANES.map(L => spam[L.id].length).reduce((x, y) => x + y)} vs ${LANES.map(L => rare[L.id].length).reduce((x, y) => x + y)}`);
  // three rare catches beat ten obvious ones, per lane
  for (const L of LANES) {
    const ten = commonLane(pz, L).slice(0, Math.min(10, L.budget)), w10 = C.scoreRun(pz, Object.assign(empty(), { [L.id]: ten })).lanes.find(l => l.lane === L.id).raw;
    if (verbose) console.log(`      ${pz.id} ${L.id}: ${ten.length} obvious = ${w10}`);
    if (L.budget >= 10) ok(w10 < 3 * CONFIG.LADDER[3].w, `    ${pz.id} ${L.id}: ten obvious notes weigh ${w10} < three Test-press notes ${3 * CONFIG.LADDER[3].w}`);
  }
  // #4 grail
  for (const L of LANES) {
    const base = Object.assign(empty(), rare); base[L.id] = rare[L.id].slice();
    const g = parse(L, pz.L[L.id].grail), withG = JSON.parse(JSON.stringify(base));
    if (L.mono) withG[L.id] = withG[L.id].filter(n => n.step !== g.step);
    if (withG[L.id].length >= L.budget) withG[L.id].pop();   // swap a note for the Grail when the budget is full
    withG[L.id].push(g);
    const x = C.scoreRun(pz, base).lanes.find(l => l.lane === L.id).total, y = C.scoreRun(pz, withG).lanes.find(l => l.lane === L.id).total;
    if (pz === PUZZLES[0] || verbose) ok(y >= x + 10, `#4 ${pz.id} ${L.id}: lane without Grail ${x} → with Grail ${y}`);
    else if (!(y >= x + 10)) ok(false, `#4 ${pz.id} ${L.id}: ${x} → ${y}`);
  }
  // #5 the drop doubles
  const fx = C.scoreRun(pz, rare).lanes.find(l => l.lane === "fx");
  const undoubled = fx.notes.reduce((a, n) => a + n.w / 2, 0);
  if (pz === PUZZLES[0]) ok(Math.abs(fx.total - 2 * undoubled) < 0.11, `#5 ${pz.id}: drop lane ${fx.total} = 2 × ${undoubled.toFixed(1)}`);
  // #7 heavier-than plausibility
  const hs = C.heavierThan(pz, a.total), hr = C.heavierThan(pz, b.total);
  const crowd = C.crowdBeats(pz).map(x => C.scoreRun(pz, x).total).sort((p, q) => p - q), q = f => crowd[Math.floor(f * (crowd.length - 1))];
  ok(hr >= 90 && hs <= hr - 5 && hs > 0 && hs < 100, `#7 ${pz.id}: spam heavier than ${hs}%, rare heavier than ${hr}% · crowd p10/50/90 = ${q(0.1)}/${q(0.5)}/${q(0.9)}`);
}

// mud + invalid
{
  const pz = PUZZLES[0], beat = empty();
  beat.drums = [{ step: 0, row: 0 }, { step: 4, row: 0 }, { step: 4, row: 1 }];
  const d = C.scoreRun(pz, beat).lanes[0];
  ok(d.mud.length && Math.abs(d.total - d.raw * 0.5) < 0.11, `fit: kick+snare on step 05 → mud, lane ${d.raw} capped to ${d.total}`);
  beat.drums = [{ step: 0, row: 0 }, { step: 1, row: 0 }, { step: 2, row: 0 }, { step: 3, row: 0 }];
  const v = C.scoreRun(pz, beat).lanes[0];
  ok(v.problems.length && v.total === 0, `hidden: 4 kicks in a row zeroes the lane (${v.problems[0]})`);
}

// #1 scheduler
{
  const sd = 60 / 140 / 4, st = { start: 0.06, n: 0 }, times = []; let now = 0, late = 0;
  while (now < 30) { C.schedulerAdvance(st, now, CONFIG.LOOKAHEAD_S, sd, (_, t) => { if (t < now) late++; times.push(t); }); now += 0.025 + Math.random() * 0.06; }
  const drift = Math.max(...times.map((t, i) => Math.abs(t - (0.06 + i * sd))));
  ok(late === 0 && drift < 1e-9, `#1 scheduler sim at 140 BPM: ${times.length} steps / 30 s with up to 60 ms timer jitter, late ${late}, drift ${drift.toExponential(1)} s`);
}
console.log(`\nspam crates ${allSpam.join(", ")}\nrare crates ${allRare.join(", ")}`);
console.log(fails ? `\n${fails} FAILED` : "\nall core checks passed");
process.exit(fails ? 1 : 0);
