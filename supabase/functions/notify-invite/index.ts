/**
 * "X wants to play" -> a push on their phone.
 *
 * Called by the client right after invite_friend succeeds. The caller must
 * actually hold a pending invite from themselves to the target for this room --
 * checked by reading game_invites as the caller (RLS only shows invites you
 * sent or got), so this endpoint can only ever notify someone you just invited.
 *
 * The VAPID private key never leaves the server: it lives in app_secrets, which
 * RLS + revoked grants keep unreadable to every client, and is read here with
 * the service role. Encryption and VAPID signing are done by @negrel/webpush
 * (RFC 8291 / 8292) over Web Crypto.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3.0";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const b64urlToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const t = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const r = atob(t);
  const a = new Uint8Array(r.length);
  for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
  return a;
};
const bytesToB64url = (a: Uint8Array) =>
  btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// The stored raw VAPID keys (public = 65-byte point, private = 32-byte scalar,
// both base64url) become the JWK pair @negrel/webpush wants.
function vapidJwks(pub_b64: string, priv_b64: string): webpush.ExportedVapidKeys {
  const pub = b64urlToBytes(pub_b64); // 0x04 || X(32) || Y(32)
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: priv_b64, ext: true, key_ops: ["sign"] },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "no token" }, 401);

  const asUser = createClient(URL_, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  const me = who?.user;
  if (!me) return json({ error: "not signed in" }, 401);

  let body: { room?: number; to?: string };
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const room = Number(body.room), to = String(body.to ?? "");
  if (!Number.isFinite(room) || !to) return json({ error: "room and to are required" }, 400);

  // Gate: you can only notify someone you actually have a pending invite out to.
  const { data: inv } = await asUser.from("game_invites")
    .select("room_code")
    .eq("room_id", room).eq("from_user", me.id).eq("to_user", to).eq("status", "pending")
    .maybeSingle();
  if (!inv) return json({ error: "no pending invite to that person" }, 403);

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const [prof, subsRes, secretsRes] = await Promise.all([
    admin.from("profiles").select("username").eq("id", me.id).maybeSingle(),
    admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", to),
    admin.from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private", "vapid_subject"]),
  ]);
  const subs = subsRes.data ?? [];
  if (subs.length === 0) return json({ sent: 0, reason: "no subscriptions" });

  const S = Object.fromEntries((secretsRes.data ?? []).map((r) => [r.key, r.value]));
  const vapidKeys = await webpush.importVapidKeys(vapidJwks(S.vapid_public, S.vapid_private), { extractable: false });
  const server = await webpush.ApplicationServer.new({
    contactInformation: S.vapid_subject ?? "mailto:admin@boredgame.app",
    vapidKeys,
  });

  const payload = JSON.stringify({
    title: "BoredGame",
    body: `${prof.data?.username ?? "A friend"} wants to play`,
    url: `/rooms/${inv.room_code}`,
    tag: `invite-${room}`,
  });

  let sent = 0;
  const dead: string[] = [];
  for (const s of subs) {
    try {
      const subscriber = server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
      await subscriber.pushTextMessage(payload, {});
      sent++;
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      // A push service returns 404/410 for an endpoint that no longer exists.
      if (/\b(404|410)\b|gone|expired|not\s*found|no longer/i.test(msg)) dead.push(s.endpoint);
      else console.error("push failed", s.endpoint.slice(0, 40), msg);
    }
  }
  if (dead.length) await admin.from("push_subscriptions").delete().eq("user_id", to).in("endpoint", dead);
  return json({ sent, pruned: dead.length });
});
