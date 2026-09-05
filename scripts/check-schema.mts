/**
 * The schema file has to be able to rebuild the app.
 *
 * supabase/schema.sql says "paste into the SQL Editor and run", and twice it
 * quietly could not. Seven live objects were never written into it — the whole
 * username system and the whole daily round, both called by the client every
 * day — so a rebuild from the file produced an app whose signup could not set
 * a name and whose daily round returned nothing. Separately, a fix applied to
 * the database as a migration never reached the file, so running it would have
 * put a fixed bug back.
 *
 * Neither was visible by reading, because nothing rebuilds from the file in
 * the normal course of work. This is the cheap half of the invariant, and it
 * runs offline: every table, view and RPC the client asks for by name must be
 * declared in schema.sql. It cannot see drift in a function's BODY — that
 * needs the database, which no shell here can reach — so a body is checked by
 * hashing it against pg_proc by hand when one changes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const files = [...walk(join(root, "src")), ...walk(join(root, "supabase/functions"))];
const code = files.map((f) => readFileSync(f, "utf8")).join("\n");

// What the client asks the database for, by name.
const rpcs = new Set([...code.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]));
const rels = new Set([
  ...[...code.matchAll(/\.from\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]),
  // BoardEngine names its table in a field, not at the call site
  ...[...code.matchAll(/\btable:\s*"([a-z_0-9]+)"/g)].map((m) => m[1]),
]);

// What the schema file declares. `create or replace function public.x(` and
// the bare `create or replace function x(` both appear in the file.
const declaredFns = new Set(
  [...schema.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/g)]
    .map((m) => m[1]),
);
const declaredRels = new Set([
  ...[...schema.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(/g)]
    .map((m) => m[1]),
  ...[...schema.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z_0-9]+)\b/g)]
    .map((m) => m[1]),
]);

let n = 0, bad = 0;
const ok = (cond: boolean, msg: string) => {
  n++;
  if (!cond) { console.error("FAIL " + msg); bad++; }
};

for (const r of [...rpcs].sort()) {
  ok(declaredFns.has(r), `the client calls rpc("${r}") and schema.sql does not declare it`);
}
for (const t of [...rels].sort()) {
  ok(declaredRels.has(t), `the client reads "${t}" and schema.sql does not declare it`);
}

// A guard on the guard: if these ever find nothing, the regexes have rotted
// and every assertion above is passing vacuously.
ok(rpcs.size >= 15, `only found ${rpcs.size} rpc call sites — the scan is broken`);
ok(rels.size >= 8, `only found ${rels.size} table reads — the scan is broken`);
ok(declaredFns.size >= 15, `only found ${declaredFns.size} functions in schema.sql — the scan is broken`);
ok(declaredRels.size >= 12, `only found ${declaredRels.size} tables in schema.sql — the scan is broken`);

if (bad) { console.error(`\n${bad} of ${n} schema assertions failed`); process.exit(1); }
console.log(`${n} schema assertions hold (${rpcs.size} rpcs, ${rels.size} relations)`);
