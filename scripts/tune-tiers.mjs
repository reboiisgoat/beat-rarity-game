// Suggest crate-tier boundaries from crate weights.
//   node scripts/tune-tiers.mjs                 → uses the seeded pretend crowd for every puzzle
//   node scripts/tune-tiers.mjs weights.json    → uses real crate weights (a JSON array of numbers), once Phase B collects them
// Targets: what share of crates should land BELOW each tier. Edit these, then copy the output into CONFIG.CRATE_TIERS.
import fs from "fs"; import vm from "vm";
const TARGETS = { "White label": 0.45, "Promo": 0.75, "Test press": 0.93, "Grail": 0.995 };
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const core = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const C = vm.runInNewContext(core + ";({CONFIG,PUZZLES,crowdBeats,scoreRun})");
const weights = process.argv[2]
  ? JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  : C.PUZZLES.flatMap(pz => C.crowdBeats(pz).map(b => C.scoreRun(pz, b).total));
weights.sort((a, b) => a - b);
const q = f => weights[Math.min(weights.length - 1, Math.floor(f * weights.length))];
console.log(`${weights.length} crates · p10 ${q(0.1)} · median ${q(0.5)} · p90 ${q(0.9)} · max ${weights[weights.length - 1]}`);
console.log("current:  ", JSON.stringify(C.CONFIG.CRATE_TIERS));
const suggested = [[0, "B-side"], ...Object.entries(TARGETS).map(([name, f]) => [Math.round(q(f)), name])];
console.log("suggested:", JSON.stringify(suggested));
console.log(process.argv[2] ? "" : "(pretend crowd only — rerun with real weights after Phase B)");
