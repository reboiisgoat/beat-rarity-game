// Pure logic for submit-run (no network): check a beat is legal, then score it against the real crowd.
import { CONFIG, lanesOf, dayNumber, dayPuzzle, modePuzzle, scoreRun, realPool, realOf, realWeights } from "./core.js";

export function puzzleFor(day, game) { return game === "mode" ? modePuzzle(day) : dayPuzzle(day); }

// Is this day still open for a scored run? Today (UTC), or yesterday for 15 minutes after midnight (clock skew).
export function dayOpen(day, now = new Date()) {
  const today = dayNumber(now);
  if (day === today) return true;
  return day === today - 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 15;
}

// Keep only legal notes; reject anything over budget or out of range rather than "fixing" it.
export function cleanBeat(pz, beat) {
  if (!beat || typeof beat !== "object") throw new Error("bad beat");
  const out = {};
  for (const L of lanesOf(pz)) {
    const notes = Array.isArray(beat[L.id]) ? beat[L.id] : [];
    if (notes.length > L.budget) throw new Error(`${L.id}: over budget`);
    const rows = L.pitched ? 8 : (L.rows || []).length, shown = L.show ? new Set(L.show) : null, seen = new Set(), perStep = {};
    out[L.id] = notes.map(n => {
      const step = n && n.step, row = n && n.row;
      if (!Number.isInteger(step) || step < 0 || step > 15 || !Number.isInteger(row) || row < 0 || row >= rows || (shown && !shown.has(row))) throw new Error(`${L.id}: bad note`);
      const key = step + ":" + row; if (seen.has(key)) throw new Error(`${L.id}: duplicate note`); seen.add(key);
      perStep[step] = (perStep[step] || 0) + 1;
      if (L.mono && perStep[step] > 1) throw new Error(`${L.id}: two notes on one step`);
      if (L.stack && perStep[step] > L.stack) throw new Error(`${L.id}: chord too big`);
      const c = { step, row };
      if (L.id === "drums" && row === 2 && n.roll != null) { if (![1, 2, 3, 4].includes(n.roll)) throw new Error("bad roll"); if (n.roll > 1) c.roll = n.roll; }
      if (L.id === "bass" && n.glide === true) c.glide = true;
      return c;
    });
  }
  return out;
}

// Score against the day's real crowd (pool = day_pool() result). The core keeps its pool in module state, so reset it.
export function scoreWithPool(pz, pool, beat) {
  for (const k of Object.keys(realPool)) delete realPool[k];
  const real = realOf(pz);
  real.n = pool.n || 0; real.counts = Object.assign({}, pool.counts || {});
  realWeights(pz).push(...(pool.weights || []).map(Number));
  const res = scoreRun(pz, beat);
  return { total: Math.round(res.total * 10) / 10, tier: res.tier };
}
export { CONFIG };
