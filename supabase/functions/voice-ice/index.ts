/**
 * A relay for a room's voice call (talk item 17, Daramola).
 *
 * A call first tries the direct route between the two phones. On mobile data
 * that route is often blocked, and the call never connected. This hands the
 * caller a short-lived login for Cloudflare's TURN relay, which carries the
 * audio when the direct route fails.
 *
 * Only a member of the room can get one (is_room_member, asked as the caller).
 * The relay key lives in this function's secrets, CF_TURN_KEY_ID and
 * CF_TURN_KEY_API_TOKEN (Supabase > Edge Functions > Secrets). It never goes
 * in the app or on Vercel. With no key set, or Cloudflare unreachable, this
 * answers with the direct route only, so a call still tries what it did before.
 *
 * Cost: Cloudflare's first 1,000 GB a month is free, then $0.05/GB; a relayed
 * voice call is roughly 1 MB a minute.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY_ID = Deno.env.get("CF_TURN_KEY_ID") ?? "";
const KEY_TOKEN = Deno.env.get("CF_TURN_KEY_API_TOKEN") ?? "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const DIRECT = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }];
const DAY = 24 * 60 * 60;

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
  if (!who?.user) return json({ error: "not signed in" }, 401);

  let body: { room?: number };
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const room = Number(body.room);
  if (!Number.isFinite(room)) return json({ error: "room is required" }, 400);

  const { data: member } = await asUser.rpc("is_room_member", { p_room: room });
  if (member !== true) return json({ error: "not in that room" }, 403);

  if (!KEY_ID || !KEY_TOKEN) return json({ iceServers: DIRECT, relay: false, why: "no relay key set" });

  try {
    const r = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: DAY }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!r.ok) return json({ iceServers: DIRECT, relay: false, why: `relay said ${r.status}` });
    const { iceServers } = await r.json() as { iceServers: { urls: string[] | string; username?: string; credential?: string }[] };
    // Cloudflare lists a port-53 address too; browsers block it and the call
    // waits on it before giving up, so it is dropped (their docs advise this).
    const cleaned = iceServers.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    })).filter((s) => s.urls.length > 0);
    return json({ iceServers: cleaned, relay: true });
  } catch (e) {
    return json({ iceServers: DIRECT, relay: false, why: `relay unreachable: ${String(e)}` });
  }
});
