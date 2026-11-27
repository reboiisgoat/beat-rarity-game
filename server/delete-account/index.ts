// Edge Function: delete-account — a player deletes their account and everything linked to it (runs, league, events,
// profile, membership row cascade from auth.users). Active Crate Club subscriptions must be cancelled in Stripe first.
// Deploy like submit-run, with "Enforce JWT verification" OFF (we check the sign-in ourselves).
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const v = JSON.parse(raw); return typeof v === "string" ? v : v.default || Object.values(v)[0]; } catch { return raw; }
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json({ error: "not signed in" }, 401);
  const { data: m } = await admin.from("memberships").select("status").eq("user_id", who.user.id).maybeSingle();
  if (m && ["active", "trialing", "past_due"].includes(m.status)) return json({ error: "cancel Crate Club first" }, 409);
  const { error } = await admin.auth.admin.deleteUser(who.user.id);
  if (error) return json({ error: "could not delete" }, 500);
  return json({ ok: true });
});
