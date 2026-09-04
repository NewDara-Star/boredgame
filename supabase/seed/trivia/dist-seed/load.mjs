#!/usr/bin/env node
/**
 * Loads the verified trivia bank into Supabase as DRAFT rows.
 *
 * Nothing here goes live. `status = 'draft'` means the app will not serve a
 * single one of these until you flip them yourself — see the bottom of this file.
 *
 *   1. Supabase dashboard -> Project Settings -> API -> service_role key
 *   2. export SUPABASE_SERVICE_KEY='...'          (your shell only; never commit it)
 *   3. node load.mjs
 *
 * Safe to run twice. Every insert skips prompts already in the table, so a
 * half-finished run just picks up where it stopped.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.SUPABASE_URL ?? "https://yglqcgidbvqzcjhervzf.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) {
  console.error("Set SUPABASE_SERVICE_KEY first (Project Settings -> API -> service_role).");
  process.exit(1);
}

// Category slug -> id, as they exist in the categories table.
const CAT = { world:12, science:7, design:9, english:13, "film-tv":10, general:14, maths:8, sport:6, tech:11 };

// The same seeded shuffle the app uses, so the stored option order is not
// systematically biased. The app reshuffles per player anyway; this is belt
// and braces after the bug where every answer sat at index 0.
const xmur3 = s => { let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; };
const rng = seed => { let a = xmur3(seed)(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

const api = (path, init = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(init.headers ?? {}) },
});

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Pull the prompts already in the table so we never insert a duplicate.
const existing = new Set();
for (let from = 0; ; from += 1000) {
  const res = await api(`puzzles?game=eq.trivia&select=prompt`, { headers: { range: `${from}-${from + 999}` } });
  if (!res.ok) { console.error(`reading existing prompts: ${res.status} ${await res.text()}`); process.exit(1); }
  const rows = await res.json();
  rows.forEach(r => existing.add(norm(r.prompt)));
  if (rows.length < 1000) break;
}
console.log(`${existing.size} trivia prompts already in the table\n`);

let inserted = 0, skipped = 0;
for (const file of readdirSync(join(HERE, "bank")).filter(f => f.endsWith(".json") && CAT[f.replace(".json", "")])) {
  const slug = file.replace(".json", "");
  const rows = [];
  for (const q of JSON.parse(readFileSync(join(HERE, "bank", file), "utf8"))) {
    if (existing.has(norm(q.prompt))) { skipped++; continue; }
    existing.add(norm(q.prompt));                       // guards duplicates inside one file too
    const r = rng(`ins:${slug}:${q.prompt}`), c = q.choices.slice();
    for (let k = c.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [c[k], c[j]] = [c[j], c[k]]; }
    rows.push({ game: "trivia", render: "text", prompt: q.prompt, choices: c, answer: q.answer,
                difficulty: q.difficulty, category_id: CAT[slug], status: "draft", explanation: q.explanation });
  }
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await api("puzzles", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(chunk) });
    if (!res.ok) { console.error(`\n${slug}: ${res.status} ${await res.text()}`); process.exit(1); }
    inserted += chunk.length;
    process.stdout.write(`\r${slug.padEnd(10)} ${inserted} inserted, ${skipped} already there`);
  }
  process.stdout.write(`\r${slug.padEnd(10)} done — ${rows.length} new, ${inserted} total\n`);
}
console.log(`\n${inserted} inserted as draft, ${skipped} skipped as duplicates.`);
console.log(`\nNothing is live yet. To review before publishing:
  select category_id, difficulty, count(*) from puzzles where status='draft' group by 1,2;

To publish one category at a time (safer than all at once):
  update puzzles set status='live' where status='draft' and category_id=<id>;`);
