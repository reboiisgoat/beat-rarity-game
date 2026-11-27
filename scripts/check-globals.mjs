// Fails if two <script> blocks in index.html declare the same top-level name (a later one silently replaces the earlier).
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*(?:src=|type="application\/json"))[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const seen = new Map(), dupes = [];
blocks.forEach((code, i) => {
  for (const m of code.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    const n = m[1];
    if (seen.has(n)) dupes.push(`${n} (script ${seen.get(n)} and ${i})`); else seen.set(n, i);
  }
});
const shadow = ["history", "location", "name", "status", "open", "close", "print", "stop", "length", "top", "parent", "self", "event"].filter(n => seen.has(n) && n !== "stop");
if (dupes.length || shadow.length) { console.error("Duplicate globals:", dupes.join(", "), shadow.length ? "| shadows window: " + shadow.join(", ") : ""); process.exit(1); }
console.log(`globals ok (${seen.size} names across ${blocks.length} scripts)`);
