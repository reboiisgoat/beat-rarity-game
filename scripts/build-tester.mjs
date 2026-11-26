// Builds the tester page: the same game with window.TESTER = true (a day browser + separate saves).
// Usage: node scripts/build-tester.mjs [out.html]   (default dist/tester.html; not served by GitHub Pages' index)
import fs from "fs"; import path from "path";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const out = process.argv[2] || new URL("../dist/tester.html", import.meta.url).pathname;
const html = src.replace("<title>Beat Rarity</title>", "<title>Beat Rarity — day tester</title>")
  .replace('<script id="core">', '<script>window.TESTER = true;</script>\n<script id="core">');
if (html === src) throw new Error("markers not found");
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log("wrote", out);
