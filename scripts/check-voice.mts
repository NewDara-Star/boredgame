/**
 * The voice relay (talk item 17): voice-ice hands a room member a Cloudflare
 * TURN login, and the app never waits on it. The function is run here with the
 * Deno runtime, Supabase and Cloudflare stood in, since a relay that only
 * fails on a real phone on mobile data is the one we can't watch.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { routeFor, RTC } from "../src/features/voice/useVoice.ts";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };

const src = readFileSync(new URL("../supabase/functions/voice-ice/index.ts", import.meta.url), "utf8");
ok(/import \{ createClient \} from "jsr:@supabase\/supabase-js@2";/.test(src), "voice-ice imports the Supabase client the way the harness expects");
const body = src.replace(/^import \{ createClient \}.*$/m, "const createClient = (globalThis as any).__createClient;");
const dir = mkdtempSync(join(tmpdir(), "voice-ice-"));

type Handler = (r: Request) => Promise<Response>;
const g = globalThis as any;
let cf: { calls: number; reply: () => Response };
g.fetch = async (url: string) => { cf.calls++; ok(String(url).startsWith("https://rtc.live.cloudflare.com/v1/turn/keys/KID/"), "asks Cloudflare with the key id"); return cf.reply(); };
g.__createClient = (_u: string, _a: string, o: { global: { headers: { Authorization: string } } }) => {
  const who = o.global.headers.Authorization;
  return {
    auth: { getUser: async () => ({ data: { user: who === "Bearer member" || who === "Bearer stranger" ? { id: who } : null } }) },
    rpc: async (_f: string, a: { p_room: number }) => ({ data: who === "Bearer member" && a.p_room === 7 }),
  };
};

let v = 0;
async function load(env: Record<string, string>): Promise<Handler> {
  let handler: Handler | null = null;
  g.Deno = { env: { get: (k: string) => env[k] }, serve: (h: Handler) => { handler = h; } };
  const file = join(dir, `voice-ice-${++v}.ts`);
  writeFileSync(file, body);
  await import(pathToFileURL(file).href);
  return handler!;
}
const call = (h: Handler, auth: string | null, room: unknown = 7, method = "POST") =>
  h(new Request("https://x/functions/v1/voice-ice", {
    method, headers: auth ? { Authorization: auth } : {}, body: method === "POST" ? JSON.stringify({ room }) : undefined,
  }));

const base = { SUPABASE_URL: "https://s", SUPABASE_ANON_KEY: "a" };
const bare = await load(base);
const keyed = await load({ ...base, CF_TURN_KEY_ID: "KID", CF_TURN_KEY_API_TOKEN: "TOK" });
cf = { calls: 0, reply: () => new Response(JSON.stringify({ iceServers: [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
  { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "u", credential: "c" },
] }), { status: 201 }) };

ok((await call(keyed, null, 7, "OPTIONS")).status === 204, "answers the browser's preflight");
ok((await call(keyed, null)).status === 401, "no login, no relay");
ok((await call(keyed, "Bearer anon")).status === 401, "signed out, no relay");
ok((await call(keyed, "Bearer stranger")).status === 403 && cf.calls === 0, "someone not in the room gets nothing, and Cloudflare isn't asked");
ok((await call(keyed, "Bearer member", 8)).status === 403, "a member of one room can't get a relay for another");

let r = await (await call(bare, "Bearer member")).json();
ok(r.relay === false && r.iceServers.every((s: { urls: string }) => String(s.urls).startsWith("stun:")) && cf.calls === 0,
   "with no key set, a member gets the direct route, as before");

r = await (await call(keyed, "Bearer member")).json();
const urls = r.iceServers.flatMap((s: { urls: string[] }) => s.urls);
ok(r.relay === true && urls.some((u: string) => u.startsWith("turn:")) && r.iceServers.some((s: { credential?: string }) => s.credential === "c"),
   "with the key, a member gets Cloudflare's relay and its login");
ok(!urls.some((u: string) => /:53(\?|$)/.test(u)), "the port-53 addresses browsers block are dropped");
ok(!JSON.stringify(r).includes("TOK"), "the relay key itself never leaves the server");

cf.reply = () => new Response("nope", { status: 500 });
r = await (await call(keyed, "Bearer member")).json();
ok(r.relay === false && r.iceServers.length > 0, "Cloudflare failing falls back to the direct route");

// The app side: never held up, never left without a route.
const fromFn = await routeFor(async () => ({ data: { iceServers: [{ urls: "turn:t:3478", username: "u", credential: "c" }] }, error: null }), 7);
ok(JSON.stringify(fromFn.iceServers).includes("turn:t:3478"), "the app uses the relay it's given");
ok((await routeFor(async () => ({ data: null, error: new Error("x") }), 7)) === RTC, "an error falls back to the direct route");
ok((await routeFor(() => { throw new Error("offline"); }, 7)) === RTC, "a throw falls back to the direct route");
const t0 = Date.now();
const slow = await routeFor(() => new Promise(() => {}), 7);
ok(slow === RTC && Date.now() - t0 < 3500, `a relay that never answers costs at most 3 s (${Date.now() - t0} ms)`);

const provider = readFileSync(new URL("../src/features/voice/VoiceProvider.tsx", import.meta.url), "utf8");
ok(/const route = routeFor\(/.test(provider) && /new RTCPeerConnection\(await route\)/.test(provider),
   "a call asks for the relay alongside the mic, and builds its connection on it");

console.log(`${n} voice-relay assertions hold`);
