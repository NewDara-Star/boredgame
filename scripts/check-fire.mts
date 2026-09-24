/**
 * Calls that cannot arrive.
 *
 * Two ways a request never reaches the server while the code that makes it
 * reads perfectly. Both shipped, both were invisible, and both were only
 * found in the server's logs by noticing a request that was never there.
 *
 * 1. `supabase.rpc(...)` is a LAZY builder, not a Promise: it performs the
 *    request inside `.then()`. `void supabase.rpc(…)` therefore builds one and
 *    never sends it. That silenced every board post in a Ball Sort room and
 *    the presence heartbeat in every room mode. Use fire() instead.
 *
 * 2. A cross-origin POST with an Authorization header is preceded by an
 *    OPTIONS preflight. An edge function whose first line rejects anything
 *    that is not a POST answers the preflight with 405, and the browser then
 *    refuses to send the POST. That made the finish referee unreachable from
 *    the app from the day it shipped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

let n = 0, bad = 0;
const ok = (cond: boolean, msg: string) => { n++; if (!cond) { console.error("FAIL " + msg); bad++; } };

// ---- 1. no lazy builder left unsent -------------------------------------
/** Comments are prose, not code: this file's own explanation of the bug
    contains the very pattern being banned, and scanning it would count one.
    Blanked rather than deleted, keeping newlines, so every offset — and so
    every line number in a failure message — still points at the real file. */
const blank = (m: string) => m.replace(/[^\n]/g, " ");
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])(\/\/[^\n]*)/g, (_, a, c) => a + blank(c));

let voids = 0, fires = 0;
for (const file of walk(join(root, "src"))) {
  const src = decomment(readFileSync(file, "utf8"));
  fires += [...src.matchAll(/\bfire\(/g)].length;
  for (const m of src.matchAll(/void\s+supabase!?\s*\./g)) {
    // the statement runs to its terminating ";" at paren/brace depth zero
    let i = m.index! + m[0].length, depth = 0, stmt = m[0];
    for (; i < src.length; i++) {
      const c = src[i];
      stmt += c;
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (c === ";" && depth <= 0) break;
    }
    if (/removeChannel|channel\(/.test(stmt)) continue;   // returns a real Promise
    voids++;
    const line = src.slice(0, m.index).split("\n").length;
    ok(stmt.includes(".then("),
      `${file.replace(root, "")}:${line} — "void supabase…" without .then() never sends the request. Use fire().`);
  }
}
ok(fires >= 2, `found ${fires} fire() call sites — the scan is broken or the helper was dropped`);

// ---- 2. every edge function answers its preflight ------------------------
const fns = join(root, "supabase/functions");
let checked = 0;
for (const slug of readdirSync(fns)) {
  const entry = join(fns, slug, "index.ts");
  try { statSync(entry); } catch { continue; }
  const src = decomment(readFileSync(entry, "utf8"));
  checked++;
  ok(/req\.method\s*===\s*"OPTIONS"/.test(src),
    `${slug} does not answer the CORS preflight — the browser will never send the POST`);
  ok(/Access-Control-Allow-Origin/.test(src),
    `${slug} sends no Access-Control-Allow-Origin — the browser discards the reply`);
  const opt = src.indexOf('req.method === "OPTIONS"');
  const post = src.indexOf('req.method !== "POST"');
  ok(opt !== -1 && (post === -1 || opt < post),
    `${slug} rejects non-POST before it answers OPTIONS, so the preflight gets the rejection`);
}
ok(checked >= 1, `found ${checked} edge functions — the scan is broken`);

// ---- 3. nothing the server refuses on sight ------------------------------
// A wrong pick in a solo board game was sent as "\u0000", and Postgres refuses a
// null character in json, so the whole round was rejected -- and nobody read the
// error. Both halves are checked: no null characters in the source, and the
// one call that files a round looks at what came back.
let nuls = 0, filings = 0;
for (const file of walk(join(root, "src"))) {
  const src = decomment(readFileSync(file, "utf8"));
  for (const m of src.matchAll(/\\u0000|\\x00|\\0(?![0-9])|\u0000/g)) {
    nuls++;
    ok(false, `${file.replace(root, "")}:${src.slice(0, m.index).split("\n").length} — a null character; Postgres refuses it in json and text`);
  }
  for (const m of src.matchAll(/rpc\(\s*"record_round"/g)) {
    filings++;
    const before = src.slice(Math.max(0, m.index! - 80), m.index);
    ok(/\{[^}]*\berror\b[^}]*\}\s*=\s*await\s+supabase!?\s*\.\s*$/.test(before),
      `${file.replace(root, "")}:${src.slice(0, m.index).split("\n").length} — record_round's error is not read, so a refused round disappears`);
  }
}
ok(filings >= 1, `found ${filings} record_round calls — the scan is broken`);

// ---- 4. every row arrives -----------------------------------------------------
// The server returns at most 1,000 rows per request and says nothing when it
// stops. The trivia bank is 1,787: asked once, two thirds of some categories
// never reached a player. The loader must page, in a fixed order.
{
  const src = decomment(readFileSync(join(root, "src/features/play/content.ts"), "utf8"));
  const i = src.indexOf("async function loadLive(");
  const body = i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i));
  ok(i >= 0, "content.ts loads the bank through loadLive");
  ok(/\.range\(/.test(body) && /\.order\(/.test(body), "the bank is fetched in ordered pages (.order + .range), not in one request");
  ok(/count:\s*"exact"/.test(body) && /for\s*\(/.test(body), "the first page carries the total and the rest are fetched from it");
  ok(!/select\(\s*"\*/.test(body), "the bank asks for the columns it uses, not select(*)");
  // ...and once per visit, not once per round (about 0.8 MB each time).
  const lc = src.slice(src.indexOf("export async function loadContent("));
  ok(/cache\.get\(game\)/.test(lc) && /CACHE_MS/.test(lc), "loadContent keeps the bank for the visit");
}


// ---- 5. a call that fails says so ---------------------------------------------
// A refused channel sat on 'Connecting…' for ever; a connection that never came
// up, or dropped, went back to 'Voice call' without a word; iPhone could hold
// the other voice back until a tap nobody was asked for (F45, V1, V3).
{
  const vp = readFileSync(join(root, "src/features/voice/VoiceProvider.tsx"), "utf8");
  const vc = readFileSync(join(root, "src/features/voice/VoiceControl.tsx"), "utf8");
  for (const why of ["mic", "line", "connect", "dropped"]) ok(vp.includes(`fail("${why}")`) || vp.includes(`"${why}" : `) || vp.includes(`? "${why}"`), `a call can fail with the reason "${why}"`);
  ok(/status === "CHANNEL_ERROR" \|\| status === "TIMED_OUT"\)\) fail\("line"\)/.test(vp), "a refused or unreachable call line ends 'Connecting…'");
  ok(!/cs === "failed"[^\n]*hangup\(\)/.test(vp), "a failed connection is reported, not hung up in silence");
  ok(/setBlocked\(true\)/.test(vp) && /Tap to hear/.test(vc) && /Tap to hear/.test(vp), "held-back audio offers 'Tap to hear' in the room and in the bar");
  ok(/troubleText\(trouble/.test(vc) && /troubleText\(trouble/.test(vp), "the room and the bar both say why");
  ok(/if \(run\.current !== me\) \{ local\.getTracks\(\)\.forEach\(\(tr\) => tr\.stop\(\)\); return; \}/.test(vp), "Cancel during the mic prompt turns the mic back off");
}


// ---- 6. sign-out doesn't wait for the server ---------------------------------
// It asked the server first and waited: on a weak signal the phone sat signed
// in with nothing happening (F5, M). The phone forgets first; the server is told
// in the background with the token held back for that.
{
  const auth = readFileSync(join(root, "src/app/providers/AuthProvider.tsx"), "utf8");
  const at = auth.indexOf("async function signOut(");
  const body = auth.slice(at, auth.indexOf("\n  }\n", at));
  const forget = body.indexOf("localStorage.removeItem(AUTH_STORAGE_KEY)"), local = body.indexOf('auth.signOut({ scope: "local" })');
  ok(forget > 0 && local > forget, "sign-out forgets the stored login before asking supabase-js to sign out");
  ok(/void fetch\(`\$\{SERVER\.url\}\/auth\/v1\/logout/.test(body) && /keepalive: true/.test(body), "the server is told in the background (keepalive), not waited for");
  ok(/forgetThisPhone\(\)/.test(body) && /bg-daily-grid-/.test(auth), "the leaving person's daily grid doesn't stay for the next");
  const rel = readFileSync(join(root, "src/features/push/release.ts"), "utf8");
  ok(/void fetch\(/.test(rel) && /keepalive: true/.test(rel) && !/await supabase/.test(rel), "handing back push doesn't wait on the server either");
}

if (bad) { console.error(`\n${bad} of ${n} delivery assertions failed`); process.exit(1); }
console.log(`${n} delivery assertions hold (${voids} void-supabase sites, ${checked} edge functions)`);
