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

// The daily is played on the phone's own date. Every daily function must take
// a day either side of UTC (touch_streak's rule): UTC-and-yesterday only shut the
// daily for an hour after midnight in Dublin and Lagos.
for (const fn of ["daily_next", "daily_answer", "submit_daily"]) {
  const at = schema.indexOf(`create or replace function public.${fn}(`);
  const body = schema.slice(at, schema.indexOf("end $$;", at));
  ok(at >= 0 && /abs\(p_day - \(now\(\) at time zone 'utc'\)::date\) > 1/.test(body)
     && !/p_day <> \(\(now\(\) at time zone 'utc'\)::date - 1\)/.test(body),
     `${fn} accepts a day either side of UTC`);
}

// A room's board point is paid from the game the room is playing now. Searching
// the game tables in turn found a stale Square Off row after 'Play something
// else' and paid nothing for the Connect 4 win (RM2).
{
  const at = schema.indexOf("create or replace function public.claim_board_win(");
  const body = schema.slice(at, schema.indexOf("end $$;", at));
  ok(/select mode into v_mode from public\.rooms/.test(body) && !/if v_tbl is null then/.test(body),
     "claim_board_win pays from the room's current game (rooms.mode), not the first table with a row");
}

// A call is set up only between the room's players (F44, V2). The voice
// channel is private, and realtime.messages lets on only seated players.
{
  const voice = readFileSync(join(root, "src/features/voice/VoiceProvider.tsx"), "utf8");
  ok(/channel\(`voice:\$\{t\.roomId\}`,\s*\{\s*config:\s*\{\s*private:\s*true/.test(voice),
     "the voice channel is private");
  ok(/if \(msg\.from !== t\.peerId\) return;/.test(voice), "a call takes signals only from the opponent");
  for (const cmd of ["select", "insert"]) {
    const at = schema.search(new RegExp(`create policy "voice: room members \\w+" on realtime\\.messages\\s+for ${cmd}`));
    ok(at >= 0 && /public\.voice_topic_ok\(\(select realtime\.topic\(\)\)\)/.test(schema.slice(at, at + 400)),
       `realtime.messages ${cmd} on voice topics is for room members only`);
  }
}

// Friend codes are readable by nobody over the API (F48). Every profile column
// the app asks for must be in the grant, or the read is refused outright.
{
  const m = schema.match(/grant select \(([^)]*)\) on public\.profiles to anon, authenticated;/);
  ok(!!m, "profiles is granted column by column");
  const granted = new Set((m?.[1] ?? "").split(",").map((c) => c.trim()));
  ok(!granted.has("friend_code") && granted.has("username"), "friend_code is not in the grant; the rest is");
  ok(/revoke select on public\.profiles from anon, authenticated;/.test(schema), "the whole-table read is revoked");
  const asked: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (f.includes("supabase/functions")) continue; // the edge sender uses the service role
    for (const x of src.matchAll(/from\("profiles"\)\s*\.select\("([^"]*)"/g)) asked.push(...x[1].split(","));
    for (const x of src.matchAll(/profiles(?:![a-z_]+)?\(([^)]*)\)/g)) asked.push(...x[1].split(","));
    for (const x of src.matchAll(/PROFILE_COLUMNS = "([^"]*)"/g)) asked.push(...x[1].split(","));
  }
  const cols = asked.map((c) => c.trim()).filter(Boolean);
  ok(cols.length >= 10, `found ${cols.length} profile columns asked for — the scan is broken`);
  for (const c of new Set(cols)) ok(granted.has(c), `the app reads profiles.${c}, which the grant doesn't cover`);
  ok(!files.some((f) => /from\("profiles"\)\s*\.select\("\*/.test(readFileSync(f, "utf8"))), "nothing reads profiles with select(*)");
}

// Every assertion above counts; exit only once they have all run.
if (bad) { console.error(`\n${bad} of ${n} schema assertions failed`); process.exit(1); }
console.log(`${n} schema assertions hold (${rpcs.size} rpcs, ${rels.size} relations)`);
