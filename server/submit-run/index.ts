// Edge Function: submit-run — saves a player's scored run with a score the server worked out itself.
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function → "submit-run", add index.ts, logic.js, core.js,
// and turn OFF "Verify JWT" (this function checks the sign-in itself, which also works with the new API keys).
import { createClient } from "npm:@supabase/supabase-js@2";
import { puzzleFor, dayOpen, cleanBeat, scoreWithPool } from "./logic.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const v = JSON.parse(raw); return typeof v === "string" ? v : v.default || Object.values(v)[0]; } catch { return raw; }
}
const WORDS_A = ["dusty", "lofi", "heavy", "golden", "crisp", "velvet", "midnight", "rusty", "neon", "sleepy", "groovy", "analog", "tape", "swing", "deep", "warm"];
const WORDS_B = ["kick", "snare", "crate", "loop", "hat", "groove", "vinyl", "chop", "pad", "riff", "break", "keys", "bass", "beat", "sample", "digger"];
const randomHandle = () => `${WORDS_A[Math.floor(Math.random() * WORDS_A.length)]}.${WORDS_B[Math.floor(Math.random() * WORDS_B.length)]}${Math.floor(100 + Math.random() * 900)}`;

// At most this many scored runs per internet connection per day and game; extra runs are practice (still fine to play).
// 3, not 1, so families, flatmates and schools sharing one connection aren't locked out.
const RUNS_PER_CONNECTION = 3;
// A keyed, per-day scramble of the connection's address: can't be reversed or matched across days. Cleared after 2 days.
async function connectionCode(req: Request, day: number): Promise<string | null> {
  const ip = (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "").trim();
  if (!ip) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${day}|${ip}`)));
  return [...sig.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(url, secretKey(), { auth: { persistSession: false } });
  const { data: who, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !who?.user) return json({ error: "not signed in" }, 401);
  const uid = who.user.id;

  let body: { day?: number; game?: string; beat?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const day = Number(body.day), game = body.game === "mode" ? "mode" : "day";
  if (!Number.isInteger(day) || !dayOpen(day)) return json({ error: "that day is closed" }, 400);

  const { data: existing } = await admin.from("runs").select("total, tier").eq("user_id", uid).eq("day", day).eq("game", game).maybeSingle();
  if (existing) return json({ ok: true, already: true, total: Number(existing.total), tier: existing.tier });

  const conn = await connectionCode(req, day);
  if (conn) {
    const { count } = await admin.from("runs").select("id", { count: "exact", head: true }).eq("day", day).eq("game", game).eq("ip_hash", conn);
    if ((count || 0) >= RUNS_PER_CONNECTION) return json({ ok: true, practice: true });
  }

  const pz = puzzleFor(day, game);
  let beat;
  try { beat = cleanBeat(pz, body.beat); } catch (e) { return json({ error: String((e as Error).message) }, 400); }

  const { data: pool, error: poolErr } = await admin.rpc("day_pool", { p_day: day, p_game: game });
  if (poolErr) return json({ error: "pool unavailable" }, 503);
  const res = scoreWithPool(pz, pool || {}, beat);

  const { error: insErr } = await admin.from("runs").insert({ user_id: uid, day, game, beat, total: res.total, tier: res.tier, ip_hash: conn });
  if (Math.random() < 0.05) await admin.from("runs").update({ ip_hash: null }).lt("day", day - 1).not("ip_hash", "is", null);   // forget old codes
  if (insErr && !/duplicate/i.test(insErr.message)) return json({ error: "could not save" }, 500);

  // first run ever: give the player a name; every scored run keeps them in this week's league
  const { data: prof } = await admin.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!prof) for (let i = 0; i < 5; i++) { const { error } = await admin.from("profiles").insert({ id: uid, handle: randomHandle() }); if (!error) break; }
  const { data: league } = await admin.rpc("join_league", { p_user: uid });

  return json({ ok: true, total: res.total, tier: res.tier, league });
});
