/**
 * useBoardRoom decides whether to deal a question by looking at the state it is
 * about to write: `next.phase === "asking"` and nothing else. That replaced a
 * boolean every call site passed by hand, which Connect 4 got wrong at three of
 * them. The replacement is only safe if the phase really does identify those
 * moments in BOTH games, so this checks the contract rather than the copy.
 */
import * as T from "../src/features/squareoff/rules.ts";
import * as C from "../src/features/connect4/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

const PHASES = new Set(["picking", "asking", "revealed", "over"]);
let seed = 20260905;
const rnd = (m: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % m;

// The two things the hook asks an engine, expressed per game.
const games = [
  {
    name: "squareoff",
    cells: 9,
    newGame: T.newGame,
    place: T.place, pick: T.pick, answer: T.answer, advance: T.advance,
    answerer: (g: T.Game) => g.answerer,
  },
  {
    name: "connect4",
    cells: 7,
    newGame: C.newGame,
    place: C.drop, pick: C.pick, answer: C.answer, advance: C.advance,
    answerer: (g: C.Game) => (g.phase === "asking" ? g.turn : null),
  },
] as const;

for (const g of games) {
  const w = g.name;

  // --- the contract the hook depends on, over whole games -------------------
  for (let round = 0; round < 400; round++) {
    // plain: place/drop only. Nothing here may ever ask a question.
    let s: any = g.newGame(round % 2 ? "o" : "x");
    let guard = 0;
    while (s.phase !== "over" && guard++ < 500) {
      const before = s;
      s = g.place(s, rnd(g.cells));
      if (s === before) continue;                     // illegal move, no state change
      ok(PHASES.has(s.phase), `${w}: plain phase is one of the four`);
      ok(s.phase !== "asking", `${w}: a plain move never asks a question`);
      ok(g.answerer(s) === null, `${w}: nobody owes an answer in a plain game`);
    }
    ok(s.phase === "over", `${w}: a plain game finishes`);
  }

  for (let round = 0; round < 400; round++) {
    let s: any = g.newGame("x");
    let guard = 0;
    let asked = 0;
    while (s.phase !== "over" && guard++ < 900) {
      if (s.phase === "picking") {
        const before = s;
        s = g.pick(s, rnd(g.cells));
        if (s === before) continue;
        ok(s.phase === "asking", `${w}: naming a cell always leads to a question`);
        asked++;
      } else if (s.phase === "asking") {
        const owed = g.answerer(s);
        ok(owed === "x" || owed === "o", `${w}: a pending question is owed by somebody`);
        s = g.answer(s, rnd(2) === 0);
        ok(s.phase !== "asking",
           `${w}: answering never leaves another question pending in the same step`);
      } else if (s.phase === "revealed") {
        const owner = s.last?.by;
        ok(owner === "x" || owner === "o", `${w}: a reveal knows whose it was`);
        s = g.advance(s);
        // Universal now. Square Off used to be exempt because a miss handed
        // the square to the opponent for a free attempt; that rule is gone, so
        // no game may go backwards from a reveal into another question. Put a
        // steal back anywhere and this is the assertion that stops you.
        ok(s.phase !== "asking", `${w}: advancing never asks — there is no steal`);
        if (s.phase === "asking") asked++;
      }
      ok(PHASES.has(s.phase), `${w}: phase stays one of the four`);
      // The invariant the whole refactor rests on.
      ok((g.answerer(s) !== null) === (s.phase === "asking"),
         `${w}: somebody owes an answer exactly when the phase is asking`);
    }
    ok(s.phase === "over", `${w}: a trivia game finishes`);
    ok(asked > 0, `${w}: a trivia game asks at least one question`);
  }

  // --- illegal moves are refused by identity, which is how choose() bails ----
  const fresh: any = g.newGame("x");
  ok(g.place(fresh, -1) === fresh, `${w}: a negative cell changes nothing`);
  ok(g.place(fresh, g.cells) === fresh, `${w}: an out-of-range cell changes nothing`);
  ok(g.pick(fresh, -1) === fresh, `${w}: picking out of range changes nothing`);
  const asking: any = g.pick(fresh, 0);
  ok(g.place(asking, 1) === asking, `${w}: no plain move while a question is up`);
  ok(g.pick(asking, 1) === asking, `${w}: no second pick while a question is up`);
}

console.log(`${n} engine-contract assertions hold`);
