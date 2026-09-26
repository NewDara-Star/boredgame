/**
 * The question clock is derived per question so both clients reach the same
 * deadline from the same puzzle. If that ever stops being a pure function of
 * the puzzle, two phones disagree about when a question expired and the stall
 * rescue starts firing against a deadline the other side never saw.
 */
import { askMs, ASK_MS, AWAY_MS } from "../src/features/play/clock.ts";
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

// --- a deadline is not a rule ------------------------------------------------
// Two different things were spelled with the same number. askMs is a game rule
// with a bar on screen; AWAY_MS is the point past which a silent client is
// assumed to be gone. The old catapult was given 30s with nothing drawn to warn
// you: a hidden clock.
//
// A shot in a room has 30 seconds again, and this time it's a rule Daramola
// chose (26 Sep), drawn as a bar on the sheet (26g) and on the watching phone
// (26h). What this holds: the number is the one rule, the bar is there, and a
// ball in the air at the buzzer still lands — the thrower's phone doesn't time
// itself out mid-flight, and the other phone waits out the grace first.
{
  const longestRule = Math.max(...["easy", "medium", "hard", "", "nonsense"].map(askMs));
  ok(AWAY_MS > longestRule * 3,
     `an away deadline is nowhere near a playable pace (${AWAY_MS} vs ${longestRule})`);
  ok(AWAY_MS >= 60_000, "and is at least a minute — no one aims for a minute");

  const { SHOT_MS } = await import("../src/features/challenge/kinds.ts");
  ok(SHOT_MS === 30_000, "a shot in a room has 30 seconds (Daramola, 26 Sep)");
  const fs = await import("node:fs");
  const read = (f: string) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  for (const f of ["src/features/squareoff/SquareOffRoom.tsx",
                   "src/features/connect4/Connect4Room.tsx"]) {
    const src = read(f);
    ok(/const ask = shotTurn \? SHOT_MS : askMs\(/.test(src), `${f}: a shot's deadline is SHOT_MS, a question keeps its own`);
    ok(!/CATAPULT_ASK_MS|challenge === "catapult" \? AWAY_MS/.test(src), `${f}: and no other shot clock`);
    ok(/flying && stall\?\.mark === t\.myMark \? null : stall/.test(src), `${f}: a ball in the air isn't timed out by its own phone`);
  }
  const sheet = read("src/features/challenge/RoomShot.tsx");
  ok(/role="timer"/.test(sheet) && /left \/ SHOT_MS/.test(sheet), "the 30 seconds are drawn, on both phones");
}

console.log(`${n} clock assertions hold`);