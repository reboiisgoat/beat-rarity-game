// Edge Function: stripe-webhook — Stripe tells us about Crate Club payments; we record who's a member.
// Deploy: Dashboard → Edge Functions → new function "stripe-webhook" → paste this file → Deploy →
// turn OFF "Enforce JWT verification" (Stripe signs its requests instead; we check that signature below).
// Secret (Dashboard → Edge Functions → Secrets): STRIPE_WEBHOOK_SECRET = the whsec_… value from Stripe. Never put it in the game.
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// Stripe-Signature: t=timestamp,v1=hmac_sha256(secret, `${t}.${body}`) — reject anything unsigned, wrong or older than 5 minutes
async function verify(body: string, header: string, secret: string, now = Date.now()): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=") as [string, string]));
  const t = Number(parts.t); if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const sigs = header.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  return sigs.some(s => safeEqual(s, want));
}
function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const v = JSON.parse(raw); return typeof v === "string" ? v : v.default || Object.values(v)[0]; } catch { return raw; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const planOfInterval = (i?: string) => (i === "year" ? "year" : i === "month" ? "month" : null);
const periodEnd = (sub: any) => { const s = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end; return s ? new Date(s * 1000).toISOString() : null; };

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("webhook secret not set", { status: 500 });
  const body = await req.text();
  if (!(await verify(body, req.headers.get("stripe-signature") || "", secret))) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(body), o = event.data?.object || {};
  const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });

  if (event.type === "checkout.session.completed" && o.mode === "subscription") {
    const uid = o.client_reference_id;
    if (!uid || !UUID.test(uid)) return new Response("no player id on this checkout — ignored", { status: 200 });
    const sub = o.amount_subtotal ?? o.amount_total;
    await db.from("memberships").upsert({
      user_id: uid, status: "active", plan: sub >= 1000 ? "year" : "month",
      stripe_customer: o.customer, stripe_subscription: o.subscription, updated_at: new Date().toISOString(),
    });
  } else if (event.type.startsWith("customer.subscription.")) {
    const status = event.type === "customer.subscription.deleted" ? "canceled" : o.status;
    const patch: Record<string, unknown> = { status, current_period_end: periodEnd(o), updated_at: new Date().toISOString() };
    const plan = planOfInterval(o.items?.data?.[0]?.price?.recurring?.interval); if (plan) patch.plan = plan;
    const { data } = await db.from("memberships").update(patch).eq("stripe_subscription", o.id).select("user_id");
    if (!data?.length && o.metadata?.user_id && UUID.test(o.metadata.user_id)) await db.from("memberships").upsert({ user_id: o.metadata.user_id, stripe_subscription: o.id, stripe_customer: o.customer, ...patch });
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
