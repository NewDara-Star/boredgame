/**
 * The bug this exists to prevent: every authored trivia question was stored with
 * the correct answer in position 1, and any screen that rendered the stored
 * order turned that into a 100% tell. A player found it in about ten minutes.
 *
 * Storage order is no longer trusted — loadContent permutes on the puzzle id —
 * so this checks the permutation actually spreads a worst-case input.
 * Run: node --experimental-strip-types scripts/check-options.mts
 */
import { shuffleSeeded, shuffle } from "../src/shared/lib/shuffle.ts";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.log(`  FAIL  ${name} ${detail}`); }
  else console.log(`  ok    ${name} ${detail}`);
};

const OPTIONS = ["ANSWER", "wrong-1", "wrong-2", "wrong-3"];

console.log("seeded shuffle");
{
  ok("is deterministic",
    JSON.stringify(shuffleSeeded(OPTIONS, "42")) === JSON.stringify(shuffleSeeded(OPTIONS, "42")));
  ok("differs between seeds",
    JSON.stringify(shuffleSeeded(OPTIONS, "42")) !== JSON.stringify(shuffleSeeded(OPTIONS, "43")));
  ok("keeps every option",
    shuffleSeeded(OPTIONS, "7").slice().sort().join() === OPTIONS.slice().sort().join());
  ok("does not mutate the input", OPTIONS[0] === "ANSWER");
}

console.log("\nposition spread over the real id range (worst case: answer stored first)");
{
  // 2000 ids, four slots: each should land near 25%. Anything past 32% is the
  // shape of the bug coming back.
  const at = [0, 0, 0, 0];
  for (let id = 1; id <= 2000; id++) at[shuffleSeeded(OPTIONS, String(id)).indexOf("ANSWER")]++;
  const pct = at.map((n) => (100 * n) / 2000);
  console.log("   ", pct.map((p, i) => `pos${i + 1} ${p.toFixed(1)}%`).join("  "));
  ok("no position is a tell", Math.max(...pct) < 32, `(worst ${Math.max(...pct).toFixed(1)}%)`);
  ok("no position is starved", Math.min(...pct) > 18, `(lowest ${Math.min(...pct).toFixed(1)}%)`);
}

console.log("\nunseeded shuffle still works");
{
  const at = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) at[shuffle(OPTIONS).indexOf("ANSWER")]++;
  const pct = at.map((n) => (100 * n) / 4000);
  ok("spreads uniformly", Math.max(...pct) < 30 && Math.min(...pct) > 20,
    `(${pct.map((p) => p.toFixed(1)).join("/")})`);
}

console.log(failed === 0 ? "\noptions are not guessable by position" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
