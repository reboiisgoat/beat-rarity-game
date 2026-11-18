// Core self-test: node tests/acceptance.mjs   (no dependencies)
import fs from "fs"; import vm from "vm";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const core = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const fresh = () => vm.runInNewContext(core + ";({CONFIG,PUZZLES,SOUNDS,scoreRun,commitToPool,visibleRules,hiddenProblems,craftOf,strBits,bitsTok,hamming,schedulerAdvance,shareText})");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const C0 = fresh();
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
const low = o => Object.entries(o).sort((a, b) => a[1] - b[1])[0][0];

for (const pz0 of C0.PUZZLES) {
  // authoring sanity
  const all = [pz0.anchor.pattern, ...Object.keys(pz0.seed.pattern)];
  ok(all.every(s => s.length === 16), `${pz0.id}: all patterns are 16 steps`);
  ok(Object.keys(pz0.seed.pattern).every(s => { const b = C0.strBits(s); return C0.visibleRules(pz0, b).every(r => r.ok) && C0.hiddenProblems(pz0, b).length === 0; }),
     `${pz0.id}: every seed pattern passes visible + hidden rules`);

  // #3 most common everything
  let C = fresh(), pz = C.PUZZLES.find(p => p.id === pz0.id);
  let r = C.scoreRun(pz, { sound: top(pz.seed.sound), bits: C.strBits(top(pz.seed.pattern)), tweak: top(pz.seed.tweak) });
  ok(r.depth < 100, `#3 ${pz.id}: most common sound+pattern+tweak → ${r.depth}/300 (${r.rounds.map(x => x.payout).join("+")}) < 100`);

  // #4 rarest sound + rarest tweak that keeps it in key + pattern 4+ from every seed, avoiding accents
  C = fresh(); pz = C.PUZZLES.find(p => p.id === pz0.id);
  const snd = low(pz.seed.sound);
  const tw = Object.entries(pz.seed.tweak).sort((a, b) => a[1] - b[1]).map(e => e[0])
    .find(t => C.craftOf(pz, snd, Array(16).fill(false), t).score >= 80);
  const seeds = Object.keys(pz.seedPattern); let bits = null;
  for (let m = 0; m < 65536 && !bits; m++) {
    const b = [...Array(16)].map((_, i) => !!(m >> i & 1));
    if (!C.visibleRules(pz, b).every(x => x.ok) || C.hiddenProblems(pz, b).length) continue;
    if (pz.anchor.accents.some(i => b[i])) continue;
    const t = C.bitsTok(b); if (seeds.every(s => C.hamming(s, t) >= 4)) bits = b;
  }
  r = C.scoreRun(pz, { sound: snd, bits, tweak: tw });
  ok(r.depth > 250, `#4 ${pz.id}: rare ${snd} @ ${tw} + far pattern ${C.bitsTok(bits)} → ${r.depth}/300 craft ${r.craft.score}`);
}

// #5 clashes are capped and explained (dusk)
let C = fresh(), pz = C.PUZZLES[0];
let far = C.strBits("x...x.x......x.x"); // hits step 5; no accent hits
let r = C.scoreRun(pz, { sound: "tom_high", bits: far, tweak: "pitch:0" }); // F# in D minor
ok(r.craft.items.some(i => /Off-key/.test(i.reason)) && r.rounds.some(x => x.capped) && r.cap < 100,
   `#5a off-key tom: craft ${r.craft.score}, cap ${r.cap}, rounds ${r.rounds.map(x => `${x.rarity}→${x.payout}`).join(" ")}`);
C = fresh(); pz = C.PUZZLES[0];
r = C.scoreRun(pz, { sound: "tom_high", bits: C.strBits("....x..x..x..x.."), tweak: "pitch:+3" }); // in key, two accent hits
ok(r.craft.items.some(i => /Accent/.test(i.reason)) && r.rounds.some(x => x.capped),
   `#5b accent collisions: craft ${r.craft.score}, cap ${r.cap}, rounds ${r.rounds.map(x => `${x.rarity}→${x.payout}`).join(" ")}`);
C = fresh(); pz = C.PUZZLES[1];
const r1 = C.scoreRun(pz, { sound: "sub_808", bits: C.strBits("..x.x...x...x..."), tweak: "lowcut:0" });
const r2 = C.scoreRun(pz, { sound: "sub_808", bits: C.strBits("..x.x...x...x..."), tweak: "lowcut:1000" });
ok(r1.craft.score < r2.craft.score, `#5c 808 range fight: full ${r1.craft.score} vs 1k cut ${r2.craft.score}`);

// hidden gate
C = fresh(); pz = C.PUZZLES[2];
r = C.scoreRun(pz, { sound: "shaker", bits: C.strBits("xxxx..x........."), tweak: "pitch:0" });
ok(!r.rounds[1].valid && r.rounds[1].payout === 0 && r.rounds[0].payout > 0, `hidden: 4-in-a-row zeroes pattern only (${r.rounds[1].problems[0]})`);

// #6 reveal percentages sum to 100
C = fresh(); pz = C.PUZZLES[0];
r = C.scoreRun(pz, { sound: "snare_dry", bits: far, tweak: "pitch:0" });
const s = r.reveal.sound.reduce((a, b) => a + b.share, 0);
ok(Math.abs(s - 1) < 1e-9 && r.reveal.pattern.common.length === 3 && r.reveal.pattern.deep.length === 3, `#6 reveal: sound shares sum ${s.toFixed(3)}, 3 common + 3 deep patterns`);

// pool: scored before joining; replays shift it
C = fresh(); pz = C.PUZZLES[0];
const a = C.scoreRun(pz, { sound: "tom_high", bits: far, tweak: "pitch:+3" }); C.commitToPool(pz, a);
const b = C.scoreRun(pz, { sound: "tom_high", bits: far, tweak: "pitch:+3" });
ok(a.rounds[1].stat.d > 0 && b.rounds[1].stat.d === 0 && b.rounds[0].rarity < a.rounds[0].rarity, `pool: replay of same run sees itself (pattern d ${a.rounds[1].stat.d}→0)`);

// #1 scheduler: jittery timer, 30 s, no drift / no late notes
const sd = 60 / 88 / 4, st = { start: 0.06, n: 0 }, times = []; let now = 0, late = 0;
while (now < 30) { C.schedulerAdvance(st, now, C.CONFIG.LOOKAHEAD_S, sd, (_, t) => { if (t < now) late++; times.push(t); }); now += 0.025 + Math.random() * 0.06; }
const drift = Math.max(...times.map((t, i) => Math.abs(t - (0.06 + i * sd))));
ok(late === 0 && drift < 1e-9, `#1 scheduler sim: ${times.length} steps over 30s, timer jitter up to 60ms, late ${late}, max drift ${drift.toExponential(1)}s`);

console.log(fails ? `\n${fails} FAILED` : "\nall core checks passed");
process.exit(fails ? 1 : 0);
