/**
 * No raw error text on screen (F2, E, E2).
 *
 * "JWT expired", "Failed to fetch", "new row violates row-level security policy
 * for table rooms" and the like reached players through a dozen `error.message`s
 * put straight into a sentence or the page. Every one now goes through
 * sayError() (src/shared/lib/sayError.ts), which gives plain words or the
 * caller's own fallback, and the raw detail goes to the console.
 *
 * This fails on any read of `.message` in src that could reach the screen. A
 * read is fine when it only decides which sentence to show (inside a regex
 * `.test(...)`), when it goes to the console, or inside sayError itself.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sayError } from "../src/shared/lib/sayError.ts";

const root = new URL("..", import.meta.url).pathname;
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); bad++; } };

const EXEMPT = new Set(["src/shared/lib/sayError.ts"]);
let reads = 0;
for (const f of walk(join(root, "src"))) {
  const rel = relative(root, f);
  if (EXEMPT.has(rel)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    const code = line.replace(/\/\/.*$/, "");
    for (const m of code.matchAll(/\b[A-Za-z_$][\w$.!?]*\.message\b/g)) {
      reads++;
      const safe = /console\.(error|warn|log|info)\(/.test(code)
        || new RegExp(String.raw`\.test\(\s*[^)]*${m[0].replace(/[.$?!]/g, "\\$&")}`).test(code)
        || /\.message \?\? ""\)\.test|\.test\(err\.message \?\? ""\)/.test(code);
      ok(safe, `${rel}:${i + 1} puts a raw error message where the player can see it: ${t.slice(0, 90)}`);
    }
    // String(e) of a caught error is the same thing in another coat.
    if (/String\((e|err|error)\)/.test(code) && !/console\./.test(code))
      ok(false, `${rel}:${i + 1} turns an error into text for the screen: ${t.slice(0, 90)}`);
    // Our own stack's name is not a player's business.
    if (/["'`][^"'`]*\bSupabase\b[^"'`]*["'`]/.test(code) && !/console\.|import /.test(code))
      ok(false, `${rel}:${i + 1} says "Supabase" to the player: ${t.slice(0, 90)}`);
    if (/Profile tab/.test(code)) ok(false, `${rel}:${i + 1} points at a 'Profile tab' that doesn't exist`);
  });
}
ok(reads >= 5, `found ${reads} .message reads — the scan is broken`);

// sayError itself: plain words for the common failures, and never the input.
const src = readFileSync(join(root, "src/shared/lib/sayError.ts"), "utf8");
ok(!/return[^;]*\be\.message\b/.test(src) && !/return[^;]*\bm\b[^.]/.test(src.replace(/return `Use at least \$\{min\[1\]\}/, "")),
   "sayError never returns the message it was given");

// A failed email link: read the moment the app starts, whatever page it lands
// on, and said in our words, not Supabase's error_description (F14, P2).
{
  const main = read("src/main.tsx").split("\n").find((l) => l.startsWith("import "));
  ok(main === 'import "@/shared/lib/linkError";', "the failed-link reason is read before anything else in the app");
  ok(!/error_description/.test(read("src/shared/lib/linkError.ts").replace(/^\s*(\*|\/\/).*$/gm, "")) && !/error_description/.test(read("src/features/profile/ProfilePage.tsx")),
     "Supabase's own description of a failed link never reaches the screen");
  ok(/hasLinkError\(\) && pathname !== "\/profile"/.test(read("src/app/layout/Shell.tsx")), "a failed link that lands on Home goes on to the You screen");
}

const FB = "Couldn't do that. Try again.";
const says = (message: string, extra: Record<string, unknown> = {}) => sayError({ message, ...extra }, FB);
ok(/offline/.test(says("Failed to fetch")) && /offline/.test(says("Load failed")), "a dropped connection says you seem to be offline");
ok(/sign-in has run out/.test(says("JWT expired")) && /sign-in has run out/.test(says("", { code: "PGRST301" })), "an expired sign-in says so");
ok(says("Password should be at least 6 characters.") === "Use at least 6 characters for your password.", "a short password names the minimum");
ok(/Too many tries/.test(says("Email rate limit exceeded")), "a rate limit says wait");
for (const raw of ["new row violates row-level security policy for table \"rooms\"", "duplicate key value violates unique constraint", "TypeError: x is undefined", ""])
  ok(says(raw) === FB, `unrecognised server text gets the caller's words, not ${JSON.stringify(raw.slice(0, 30))}`);
ok(sayError(null, FB) === FB && sayError("boom", FB) === FB, "anything that isn't an error object gets the caller's words");

if (bad) { console.error(`\n${bad} of ${n} error-wording assertions failed`); process.exit(1); }
console.log(`${n} error-wording assertions hold (${reads} .message reads, none on screen)`);
