/**
 * The matcher is allowed to be generous only while generosity cannot make two
 * different puzzles confusable. That is a property of the BANK, not of the
 * function, so it has to be checked against real answers rather than reasoned
 * about — and re-checked whenever a puzzle is added.
 */
import { normalise, isCorrect, closeness, nearMiss, slack, levenshtein }
  from "../src/shared/lib/normalise.ts";
import { PICTO_SEED } from "../src/shared/data/picto.ts";
import { readFileSync } from "node:fs";

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

console.log(`${n} answer-matching assertions hold`);
