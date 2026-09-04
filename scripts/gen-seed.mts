/**
 * Emits seed SQL from the bundled content. Uses Node's built-in TypeScript
 * stripping (Node 22.18+), so it needs no build tool — an esbuild dependency
 * here would be a native binary, and native binaries are exactly what breaks
 * when anything is installed from a non-macOS shell.
 *
 *   node --experimental-strip-types scripts/gen-seed.mts > /tmp/seed.sql
 */
import { PICTO_SEED } from "../src/shared/data/picto.ts";
import { TRIVIA_SEED } from "../src/shared/data/trivia.ts";

const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a: string[]) => "ARRAY[" + a.map(q).join(",") + "]";
const cat = (n: string) => `(select id from categories where name = ${q(n)})`;

const rows: string[] = [];
for (const p of PICTO_SEED) {
  rows.push(`('picto','text',${q(JSON.stringify({ items: p.items }))}::jsonb,null,null,` +
    `${q(p.answer)},${q(p.alt_hint)},${q(p.char_hint)},'${p.difficulty}',${cat(p.category)},'live')`);
}
for (const t of TRIVIA_SEED) {
  rows.push(`('trivia','text',null,${q(t.prompt)},${arr(t.choices as unknown as string[])},` +
    `${q(t.choices[0])},${q(t.alt_hint)},${q(t.char_hint)},'${t.difficulty}',${cat(t.category)},'live')`);
}

console.log(`insert into puzzles
  (game, render, spec, prompt, choices, answer, alt_hint, char_hint, difficulty, category_id, status)
values
${rows.join(",\n")};`);
