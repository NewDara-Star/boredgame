/**
 * The matcher is allowed to be generous only while generosity cannot make two
 * different puzzles confusable. That is a property of the BANK, not of the
 * function, so it has to be checked against real answers rather than reasoned
 * about — and re-checked whenever a puzzle is added.
 */
import { normalise, isCorrect, closeness, nearMiss, slack, levenshtein, clashesWith }
  from "../src/shared/lib/normalise.ts";
import { PICTO_SEED } from "../src/shared/data/picto.ts";
import { readFileSync } from "node:fs";
import * as scoring from "../src/features/play/scoring.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

// --- the mechanical part ----------------------------------------------------
ok(isCorrect("Water Under The Bridge!", "water under the bridge"), "case and punctuation do not matter");
ok(isCorrect("  head over heels  ", "head over heels"), "nor does surrounding space");
ok(!isCorrect("", "water"), "an empty guess is never right");
ok(!isCorrect("   ", "water"), "nor is whitespace");
ok(isCorrect("waterunderthebridge", "water under the bridge"), "nor do the spaces themselves");

// --- the typo allowance -----------------------------------------------------
ok(slack("cat") === 0, "a short answer gets no allowance");
ok(slack("blueprint") === 1, "a middling one gets a character");
ok(slack("waterunderthebridge") === 2, "a long one gets two");
ok(isCorrect("head over heals", "head over heels"), "one slip in a long answer still counts");
ok(isCorrect("reading between the lnies", "reading between the lines"), "so does a transposition");
ok(!isCorrect("cat", "bat"), "but a three-letter answer is exact");
ok(!isCorrect("red tape", "red rope"), "and a different word is not a typo");

// --- alternative spellings --------------------------------------------------
ok(isCorrect("six feet under", "six feet underground", ["six feet under"]),
   "an accepted alternative counts");
ok(isCorrect("you're under arrest", "you are under arrest", ["youre under arrest"]),
   "and so does the contraction of one");
ok(!isCorrect("six feet", "six feet underground", ["six feet under"]),
   "but the alternative does not open the door to anything shorter");

// --- THE SAFETY PROPERTY ----------------------------------------------------
// No two answers in the bank — counting every accepted spelling of each — may
// sit within the allowance of each other, or a typo of one becomes the other.
{
  const bank = PICTO_SEED.map((p) => ({
    answer: p.answer,
    all: [p.answer, ...(p.accept ?? [])].map(normalise),
  }));
  let clashes = 0;
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      for (const a of bank[i].all) {
        for (const b of bank[j].all) {
          const d = levenshtein(a, b);
          if (d <= Math.max(slack(a), slack(b))) {
            console.error(`  CLASH d=${d}: "${bank[i].answer}" ~ "${bank[j].answer}"`);
            clashes++;
          }
        }
      }
    }
  }
  ok(clashes === 0, `no two puzzles are within the typo allowance of each other (${bank.length} checked)`);
  // and nothing accepts a guess for a DIFFERENT puzzle
  for (const p of bank) {
    for (const q of bank) {
      if (p === q) continue;
      ok(!isCorrect(q.answer, p.answer, []), `"${q.answer}" is not accepted for "${p.answer}"`);
    }
  }
}

// --- the accepts actually reach the player ----------------------------------
// They were in the database and nowhere else for weeks, and the offline path
// dropped them on the floor. Both are structural, so check them structurally.
{
  const content = readFileSync(new URL("../src/features/play/content.ts", import.meta.url), "utf8");
  ok(/fromSeedPicto[\s\S]{0,400}accept:/.test(content),
     "the bundled-seed path passes accept through to the player");
  ok(/accept: row.accept/.test(content), "and so does the database path");
  const seed = readFileSync(new URL("../scripts/seed.mjs", import.meta.url), "utf8");
  ok(/accept: p.accept/.test(seed), "and the seeder writes accept to the database");
}

// --- phrasings the picture licenses -----------------------------------------
// Every one of these is a guess a player can defend by pointing at the card.
{
  const bySlug = new Map(PICTO_SEED.map((p) => [p.slug, p]));
  const licensed: [string, string][] = [
    ["pig-in-a-blanket", "pig in blanket"],
    ["fly-in-the-ointment", "fly in ointment"],
    ["ace-in-the-hole", "ace in hole"],
    ["bee-in-your-bonnet", "bee in bonnet"],
    ["chip-on-your-shoulder", "chip on shoulder"],
    ["caught-red-handed", "red handed"],
    ["history-repeats", "history repeats"],
    ["green-thumb", "green fingers"],
    ["youre-under-arrest", "you're under arrest"],
    ["cards-on-the-table", "cards on table"],
    ["cat-out-of-the-bag", "let the cat out of the bag"],
    ["six-feet-underground", "six feet under"],
  ];
  for (const [slug, guess] of licensed) {
    const p = bySlug.get(slug);
    ok(!!p, `${slug} is still in the bank`);
    ok(isCorrect(guess, p!.answer, p!.accept), `"${guess}" is accepted for ${slug}`);
  }
}

// --- the server judges the same way (supabase/schema.sql, judge_answer) -------
// Two copies of one rule: the phone's (slack() above) and the server's, which is
// what actually counts. They drifted once without anyone seeing: the server used
// the typo allowance on multiple choice, so tapping 'Definately' counted as right
// while the screen said Missed. Read the server's rule out of the schema and
// hold both parts of it.
{
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const at = schema.indexOf("create or replace function public.judge_answer(");
  ok(at >= 0, "schema.sql defines judge_answer");
  const body = schema.slice(at, schema.indexOf("$$;", at));
  const m = body.match(/length\(\w+(?:\.\w+)?\) < (\d+) then (\d+) when length\(\w+(?:\.\w+)?\) < (\d+) then (\d+) else (\d+)/);
  ok(!!m, "judge_answer's typo allowance can be read");
  const [lo, a, hi, b, c] = m!.slice(1).map(Number);
  const server = (len: number) => (len < lo ? a : len < hi ? b : c);
  for (let len = 1; len <= 40; len++)
    ok(server(len) === slack("x".repeat(len)), `server and phone allow the same slips for a ${len}-letter answer`);
  ok(/cardinality\(coalesce\(p_choices[^)]*\)\) > 0 then p_given = p_answer/.test(body),
     "a question with options is judged on the exact option, before any allowance");
  for (const fn of ["record_round", "claim_round", "daily_answer"]) {
    const i = schema.indexOf(`create or replace function public.${fn}(`);
    const f = schema.slice(i, schema.indexOf("end $$;", i));
    ok(/public\.judge_answer\(/.test(f) && !/levenshtein/.test(f), `${fn} judges through judge_answer and nothing else`);
  }
}

// --- a picture never describes itself with the clue ---------------------------
// An image puzzle's alt text was its paid clue: read aloud, and shown on screen
// when the picture failed to load.
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (d: string, out: string[] = []): string[] => {
    for (const e of readdirSync(d)) { const p = d + "/" + e; statSync(p).isDirectory() ? walk(p, out) : /\.tsx$/.test(p) && out.push(p); }
    return out;
  };
  const src = new URL("../src", import.meta.url).pathname;
  for (const f of walk(src)) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(/alt=\{([^}]*)\}/g))
      ok(!/altHint|charHint|alt_hint|char_hint|\.answer\b/.test(m[1]), `${f.slice(src.length)}: alt text must not be a clue or the answer (${m[1]})`);
  }
}

// --- what gets logged -------------------------------------------------------
ok(nearMiss("head over heals", "head over heelz"), "a close wrong answer is worth logging");
ok(!nearMiss("head over heels", "head over heels"), "a right one is not");
ok(!nearMiss("banana", "water under the bridge"), "nor is something nowhere near");
ok(!nearMiss("aa", "water under the bridge"), "nor is a stray keypress");
ok(closeness("water under the bridge", "water under the bridge") === 1, "identical is 1");
ok(closeness("", "water") === 0, "empty is 0");


// --- a new puzzle is checked against the bank before it goes live (F47, A4) ---
{
  const bank = PICTO_SEED.map((p) => ({ answer: p.answer, accept: p.accept ?? null }));
  const long = bank.find((p) => normalise(p.answer).length >= 14)!;
  const slip = long.answer.slice(0, -1) + (long.answer.endsWith("x") ? "y" : "x");
  ok(clashesWith(slip, null, bank).some((q) => q.answer === long.answer), `"${slip}" is refused: one slip from "${long.answer}"`);
  ok(clashesWith(long.answer.toUpperCase() + "!", null, bank).length >= 1, "the same answer again is refused");
  ok(clashesWith("a completely new phrase", null, bank).length === 0, "a new phrase is let through");
  ok(clashesWith("cot", null, [{ answer: "cat" }]).length === 0, "short answers get no allowance, so cat and cot can both exist");
  const withAlt = bank.find((p) => (p.accept ?? []).length > 0);
  if (withAlt) ok(clashesWith(withAlt.accept![0], null, bank).includes(withAlt), "an accepted spelling counts as taken too");
}
// ...and the editor actually asks, and files the category it offers (A1, A3).
{
  const admin = readFileSync(new URL("../src/features/admin/AdminPage.tsx", import.meta.url), "utf8");
  ok(/clashesWith\(d\.answer, null, bank\)/.test(admin) && /if \(hit\.length\)/.test(admin), "the editor refuses a Picto answer that clashes with the live bank");
  ok(/if \(!bank\) \{/.test(admin), "and refuses to publish when it can't read the bank");
  ok(/category_id: Number\(d\.category\)/.test(admin), "the editor saves the category's id");
  ok(/from\("categories"\)/.test(admin) && !/const CATEGORIES = \[/.test(admin), "the editor's categories come from the database, not a list in the code");
}

// --- points for a right answer (talk item 4) ---------------------------------
// No clock while you answer; the reveal says what the speed earned. And the
// phone counts the streak bonus the way the daily's server does (this answer
// included): it used to be one behind, +0 for a first right answer, not +60.
{
  const { scoreParts, partsOf, sayParts } = scoring as unknown as {
    scoreParts?: (ms: number, s: number, h: number) => { right: number; speed: number; streak: number; hints: number; total: number };
    partsOf?: (g: number, s: number) => { speed: number; streak: number };
    sayParts?: (p: object) => string };
  ok(typeof scoreParts === "function" && typeof partsOf === "function" && typeof sayParts === "function", "the points come in parts the reveal can name");
  if (scoreParts && partsOf && sayParts) {
    const first = scoreParts(9000, 1, 0);
    ok(first.speed === 400 && first.streak === 60 && first.total === 960, "a first right answer at 9 s: 500 + 400 speed + 60 streak");
    ok(scoreParts(60_000, 7, 1).total === 500 + 0 + 300 - 100, "past 45 s no speed; the streak bonus stops at 5; a hint costs 100");
    ok(sayParts(scoreParts(9000, 1, 1)) === "500 right · +400 speed · +60 streak · −100 hint", "the reveal's line says each part");
    // the daily's server: think time -> 500 + round(500 * speed) + least(streak, 5) * 60
    for (const [ms, st] of [[0, 1], [9000, 2], [30_000, 6], [50_000, 3]]) {
      const server = 500 + Math.round(500 * Math.max(0, 1 - ms / 45000)) + Math.min(st, 5) * 60;
      ok(scoreParts(ms, st, 0).total === server, `the phone scores like daily_tally (${ms} ms, streak ${st})`);
      const p = partsOf(server, st);
      ok(p.speed === scoreParts(ms, st, 0).speed && p.streak === Math.min(st, 5) * 60, "the daily's parts follow from its total");
    }
  }
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  ok(/scoreParts\(ms, streak \+ 1, hintsUsed\)/.test(src("features/play/useRound.ts")), "a solo answer counts in its own streak");
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  ok(/streak := streak \+ 1;[\s\S]{0,300}least\(streak, 5\) \* 60/.test(schema), "the daily's server counts the answer in its streak before the bonus");
  for (const f of ["features/trivia/TriviaGame.tsx", "features/picto/PictoGame.tsx"])
    ok(/parts=\{r\.last!\.parts\}/.test(src(f)) && !/ROUND_MS|askMs/.test(src(f)), `${f}: parts on the reveal, no clock while answering`);
  ok(/parts=\{r\.last\.correct \? partsOf\(/.test(src("features/daily/DailyPage.tsx")), "the daily's reveal names its parts too");
}

console.log(`${n} answer-matching assertions hold`);
