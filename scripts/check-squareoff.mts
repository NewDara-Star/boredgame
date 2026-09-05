/**
 * The Square Off rules run on both sides of a network, so they get checked
 * rather than eyeballed. Run: node --experimental-strip-types scripts/check-squareoff.mts
 */
import {
  newGame, pick, answer, advance, winnerOf, botSquare, other, stallWriter,
  type Game, type Mark, type Cell, describe,
} from "../src/features/squareoff/rules.ts";

let failed = 0;
const ok = (name: string, cond: boolean) => {
  if (!cond) { failed++; console.log(`  FAIL  ${name}`); } else console.log(`  ok    ${name}`);
};
/** Same check, silent unless it fails — for assertions inside a long walk. */
let quiet = 0;
const ok0 = (cond: boolean, name: string) => {
  quiet++;
  if (!cond) { failed++; console.log(`  FAIL  ${name}`); }
};

/** pick -> answer -> advance, the way the UI drives it. */
const play = (g: Game, square: number, correct: boolean) => advance(answer(pick(g, square), correct));

console.log("claiming");
{
  const g = play(newGame("x"), 4, true);
  ok("a correct answer claims the square", g.board[4] === "x");
  ok("the next pick is the opponent's", g.turn === "o");
  ok("back to picking", g.phase === "picking");
}

console.log("\na miss costs your turn and nothing else");
{
  // There used to be a steal here: miss, and the reducer offered your square
  // to your opponent. It went because the opponent never had to SPOT the
  // opening — the game handed it over — and because against a stronger player
  // it compounds: they convert your misses and you do not convert theirs.
  const missed = advance(answer(pick(newGame("x"), 0), false));
  ok("a miss goes straight back to picking", missed.phase === "picking");
  ok("nobody owes an answer", missed.answerer === null);
  ok("the square is not contested any more", missed.target === null);
  ok("the square stays open", missed.board[0] === null);
  ok("and the next pick is the opponent's", missed.turn === "o");

  // The property, over every reachable state rather than one example: there is
  // no path on which advancing asks again, so there is nowhere a steal could
  // hide. This is the assertion that would have to be deleted to put one back.
  let asked = 0, seen = 0, seed = 7;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 400; round++) {
    let g = newGame(rnd(2) ? "x" : "o");
    for (let step = 0; step < 60 && g.phase !== "over"; step++) {
      if (g.phase === "picking") {
        const open = g.board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
        g = pick(g, open[rnd(open.length)]);
      } else if (g.phase === "asking") {
        const before = g.turn;
        g = answer(g, rnd(3) === 0);
        ok0(g.phase !== "asking", "answering never leaves another question pending");
        ok0(g.turn === before, "and answering never moves the pick");
      } else {
        const before = g.board.slice();
        g = advance(g);
        seen++;
        if (g.phase === "asking") asked++;
        ok0(g.board.every((c, i) => c === before[i]), "advancing never changes the board");
      }
    }
  }
  ok(`advancing never asks again, over ${seen} reveals`, asked === 0);
  ok("the walk actually got somewhere", seen > 1000);
}

console.log("\nturn order holds over a long game");
{
  let g = newGame("x");
  const picks: Mark[] = [];
  for (let n = 0; n < 6; n++) {
    picks.push(g.turn);
    const square = g.board.findIndex((c) => c === null);
    g = pick(g, square);
    // alternate hitting and missing: neither should change whose pick is next
    g = advance(answer(g, n % 2 === 0));
    if (g.phase === "over") break;
  }
  ok("picks alternate strictly", picks.every((m, i) => m === (i % 2 === 0 ? "x" : "o")));
}

console.log("\nendings");
{
  let g = newGame("x");
  g = play(g, 0, true);   // x
  g = play(g, 3, true);   // o
  g = play(g, 1, true);   // x
  g = play(g, 4, true);   // o
  g = pick(g, 2); g = answer(g, true); // x completes the top row
  ok("a line ends the game", g.phase === "over" && g.winner === "x");
  ok("the winning line is reported", JSON.stringify(g.line) === "[0,1,2]");
  ok("no further picks land", pick(g, 5).board[5] === null);
  ok("the winning square is no longer contested", g.target === null);

  const draw: Cell[] = ["x","o","x","x","o","o","o","x","x"];
  ok("a full board with no line is a draw", winnerOf(draw) === null);
}

console.log("\nthe bot");
{
  ok("takes the win", botSquare(["o","o",null,"x","x",null,null,null,null], "o") === 2);
  ok("blocks yours",  botSquare(["x","x",null,"o",null,null,null,null,null], "o") === 2);
  ok("prefers the win over the block",
     botSquare(["x","x",null,"o","o",null,null,null,null], "o") === 5);
  ok("takes the centre on an empty board", botSquare(Array(9).fill(null), "x") === 4);
  ok("always returns an open square", (() => {
    const board: Cell[] = ["x","o","x","o",null,"o","x","o","x"];
    for (let i = 0; i < 50; i++) if (botSquare(board, "x") !== 4) return false;
    return true;
  })());
}

console.log("\nabandonment: exactly one writer at any instant");
{
  const ASK = 15000, REVEAL = 4500, GRACE = 5000;
  const MS = { ask: ASK, reveal: REVEAL, grace: GRACE };
  const at = (g: Parameters<typeof stallWriter>[0], t: number) => {
    const w = stallWriter(g, t, MS);
    return w ? `${w.mark}:${w.action}` : null;
  };

  const asking = pick(newGame("x"), 0);           // x owes the answer
  // The board that actually froze in production: x took square 0 and the
  // reveal was never written on. board "x--------", phase revealed.
  const claimed = answer(asking, true);
  const missed = answer(asking, false);

  ok("nobody writes while the clock runs",
     at(asking, 0) === null && at(asking, ASK - 1) === null);
  ok("the answerer writes their own timeout", at(asking, ASK) === "x:timeout");
  ok("the opponent takes over once the grace is up",
     at(asking, ASK + GRACE) === "o:timeout");
  ok("a question is always owed by whoever's turn it is",
     at(pick(newGame("o"), 3), ASK) === "o:timeout");

  ok("a reveal is left alone while the pause runs",
     at(claimed, 0) === null && at(claimed, REVEAL - 1) === null);
  ok("the answerer owns moving on from their own reveal",
     at(claimed, REVEAL) === "x:advance");
  ok("a stuck reveal is handed to the opponent",
     at(claimed, REVEAL + GRACE) === "o:advance");
  ok("a missed answer hands the stuck reveal over too",
     at(missed, REVEAL) === "x:advance" && at(missed, REVEAL + GRACE) === "o:advance");
  // The rescue calls advance() — the same pure function the owner's own pause
  // would have called — so the board cannot diverge depending on who wrote it.
  ok("the rescued transition is the one the owner owed",
     advance(claimed).phase === "picking" && advance(claimed).turn === "o"
     && advance(missed).phase === "picking" && advance(missed).turn === "o");
  ok("the reveal deadline clears the longest pause in useTttRoom",
     REVEAL > 2900);
  ok("a frozen reveal always resolves eventually",
     at(claimed, 10 * 60_000) !== null);

  ok("never two writers at once", (() => {
    for (const g of [asking, claimed, missed]) {
      for (let t = 0; t <= ASK + GRACE * 3; t += 137) {
        const w = stallWriter(g, t, MS);
        if (w && w.mark !== "x" && w.mark !== "o") return false;
        if (w && w.action !== "timeout" && w.action !== "advance") return false;
      }
    }
    return true;
  })());
  // x takes 0, 1, 2 for the line; o answers in between and gets nowhere.
  const over = play(play(play(play(play(newGame("x"), 0, true), 3, true), 1, true), 4, true), 2, true);
  ok("a pick has no deadline, and a finished game none either",
     over.phase === "over" && over.winner === "x"
     && at(newGame("x"), 99999) === null
     && at(advance(claimed), 99999) === null
     && at(over, 99999) === null);
}

console.log("\nthe sentence under the board");
{
  const names = { x: "You", o: "Dara" };
  const missed = { ...newGame("x"), phase: "revealed", target: 4,
                   last: { by: "o", square: 4, correct: false } } as unknown as Game;
  const line = describe(missed, names, "x");
  ok("a third-person miss reads as English", line.includes("Dara misses"));
  ok("and never doubles the s", !line.includes("misss"));
  const own = describe({ ...missed,
    last: { by: "x", square: 4, correct: false } } as unknown as Game, names, "x");
  ok("first person stays unconjugated", own.includes("You miss") && !own.includes("You misses"));
}

console.log("\nmisc");
ok("other() flips", other("x") === "o" && other("o") === "x");

console.log(failed === 0 ? "\nall rules hold" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
