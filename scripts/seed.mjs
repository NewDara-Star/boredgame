/**
 * Pushes the bundled content into Supabase.
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed.mjs
 * Idempotent: re-running skips rows that are already there.
 */
import { createClient } from "@supabase/supabase-js";
import { build } from "esbuild";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY (Supabase → Settings → API → service_role).");
  process.exit(1);
}

const load = async (file, name) => {
  await build({ entryPoints: [file], bundle: true, format: "esm", outfile: `/tmp/${name}.mjs`, logLevel: "silent" });
  return (await import(`/tmp/${name}.mjs`))[name];
};
const PICTO_SEED = await load("src/shared/data/picto.ts", "PICTO_SEED");
const TRIVIA_SEED = await load("src/shared/data/trivia.ts", "TRIVIA_SEED");

const db = createClient(url, key);
const { data: cats } = await db.from("categories").select("id,name");
const catId = (n) => cats?.find((c) => c.name === n)?.id ?? null;

const rows = [
  ...PICTO_SEED.map((p) => ({
    game: "picto", render: "text", spec: { items: p.items },
    answer: p.answer, accept: p.accept ?? null, alt_hint: p.alt_hint, char_hint: p.char_hint,
    difficulty: p.difficulty, category_id: catId(p.category), status: "live",
  })),
  ...TRIVIA_SEED.map((q) => ({
    game: "trivia", render: "text", prompt: q.prompt, choices: q.choices,
    answer: q.choices[0], alt_hint: q.alt_hint, char_hint: q.char_hint,
    difficulty: q.difficulty, category_id: catId(q.category), status: "live",
  })),
];

const { data: existing } = await db.from("puzzles").select("id,answer,prompt");
const byKey = new Map((existing ?? []).map((r) => [`${r.prompt ?? ""}|${r.answer}`, r.id]));
const fresh = rows.filter((r) => !byKey.has(`${r.prompt ?? ""}|${r.answer}`));

// Insert what is new.
if (fresh.length) {
  const { error } = await db.from("puzzles").insert(fresh);
  if (error) { console.error(`Insert failed: ${error.message}`); process.exit(1); }
}

// Then push the fields that get EDITED in the repo rather than added. Without
// this the accept lists and redrawn specs only ever existed in the database,
// which is how they drifted out of the repo in the first place.
let edited = 0;
for (const r of rows) {
  const id = byKey.get(`${r.prompt ?? ""}|${r.answer}`);
  if (!id) continue;
  const { error } = await db.from("puzzles")
    .update({ spec: r.spec, accept: r.accept, alt_hint: r.alt_hint, char_hint: r.char_hint,
              choices: r.choices ?? null, difficulty: r.difficulty })
    .eq("id", id);
  if (error) { console.error(`Update ${id} failed: ${error.message}`); process.exit(1); }
  edited++;
}
console.log(`Inserted ${fresh.length} rows, refreshed ${edited}.`);
