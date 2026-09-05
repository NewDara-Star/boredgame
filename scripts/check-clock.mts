/**
 * The question clock is derived per question so both clients reach the same
 * deadline from the same puzzle. If that ever stops being a pure function of
 * the puzzle, two phones disagree about when a question expired and the stall
 * rescue starts firing against a deadline the other side never saw.
 */
import { askMs, ASK_MS } from "../src/features/play/clock.ts";
import { stallWriter as tttStall } from "../src/features/squareoff/rules.ts";
import { stallWriter as c4Stall } from "../src/features/connect4/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

// --- the clock itself -------------------------------------------------------
ok(askMs("easy") === 15_000, "easy keeps the old fifteen seconds");
ok(askMs("medium") > askMs("easy"), "a medium question gets longer than an easy one");
ok(askMs("hard") > askMs("medium"), "a hard question gets longer than a medium one");
ok(askMs("hard") <= 30_000, "no question is given more than half a minute");
ok(askMs(undefined) === ASK_MS, "an unloaded question falls back to the base");
ok(askMs(null) === ASK_MS, "so does a null one");
ok(askMs("") === ASK_MS, "so does an empty string");
ok(askMs("LEGENDARY") === ASK_MS, "an unknown level falls back rather than returning NaN");
for (const d of ["easy", "medium", "hard", "nonsense", undefined]) {
  const v = askMs(d as string);
  ok(Number.isFinite(v) && v > 0, `askMs(${d}) is a usable number`);
  ok(askMs(d as string) === v, `askMs(${d}) is pure — same input, same answer`);
}

// --- the deadline both clients compute --------------------------------------
// Two clients, same puzzle, same written state: they must name the same writer
// at every instant, or a "nobody answered" gets written twice or never.
const GRACE = 6000, REVEAL = 4500;
for (const level of ["easy", "medium", "hard"]) {
  const ask = askMs(level);
  const asking = { phase: "asking" as const, answerer: "x" as const, turn: "x" as const, last: null };
  const ms = { ask, reveal: REVEAL, grace: GRACE };

  ok(tttStall(asking, ask - 1, ms) === null, `${level}: nobody may write before the deadline`);
  ok(tttStall(asking, ask, ms)?.mark === "x", `${level}: at the deadline the answerer writes it`);
  ok(tttStall(asking, ask + GRACE, ms)?.mark === "o",
     `${level}: after the grace period the opponent may step in`);

  const c4asking = { phase: "asking" as const, turn: "x" as const, last: null };
  ok(c4Stall(c4asking, ask - 1, ms) === null, `${level}: c4 nobody writes early`);
  ok(c4Stall(c4asking, ask, ms)?.mark === "x", `${level}: c4 the asker writes their own timeout`);
  ok(c4Stall(c4asking, ask + GRACE, ms)?.mark === "o", `${level}: c4 the opponent steps in`);

  // The longer clock must not overtake the reveal deadline, or a stuck reveal
  // would be rescued before a slow answer was even due.
  ok(ask > REVEAL, `${level}: a question is given longer than a reveal pause`);
}

// A harder question must genuinely buy more time, at every stage.
ok(askMs("hard") + GRACE > askMs("easy") + GRACE, "the grace period rides on top of the clock");
ok(askMs("hard") - askMs("easy") >= 5_000, "the difference is worth having");

console.log(`${n} clock assertions hold`);
