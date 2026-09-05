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

if (bad) { console.error(`\n${bad} of ${n} delivery assertions failed`); process.exit(1); }
console.log(`${n} delivery assertions hold (${voids} void-supabase sites, ${checked} edge functions)`);
