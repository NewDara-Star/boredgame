/**
 * The Square Off rules run on both sides of a network, so they get checked
 * rather than eyeballed. Run: node --experimental-strip-types scripts/check-squareoff.mts
 */
import {
  newGame, pick, answer, advance, winnerOf, botSquare, other,
  type Game, type Mark, type Cell,
} from "../src/features/squareoff/rules.ts";

let failed = 0;
const ok = (name: string, cond: boolean) => {
  if (!cond) { failed++; console.log(`  FAIL  ${name}`); } else console.log(`  ok    ${name}`);
};

/** pick -> answer -> advance, the way the UI drives it. */
const play = (g: Game, square: number, correct: boolean) => advance(answer(pick(g, square), correct));
/** answer the pending steal and move on */
const resolve = (g: Game, correct: boolean) => advance(answer(g, correct));

console.log("claiming");
{
  const g = play(newGame("x"), 4, true);
  ok("a correct answer claims the square", g.board[4] === "x");
  ok("the next pick is the opponent's", g.turn === "o");
  ok("back to picking", g.phase === "picking");
}

console.log("\nthe steal");
{
  const missed = advance(answer(pick(newGame("x"), 0), false));
  ok("a miss opens a steal", missed.phase === "asking" && missed.steal);
  ok("the steal is on the same square", missed.target === 0);
  ok("the opponent owes the answer", missed.answerer === "o");
  ok("the pick still belongs to X", missed.turn === "x");
  ok("nothing was claimed", missed.board[0] === null);

  const stolen = resolve(missed, true);
  ok("a made steal claims it for O", stolen.board[0] === "o");
  ok("and the next pick is O's", stolen.turn === "o");

  const survived = resolve(missed, false);
  ok("a missed steal leaves it open", survived.board[0] === null);
  ok("and the next pick is still O's", survived.turn === "o");
  ok("no second steal is offered", survived.phase === "picking");
}

console.log("\nturn order holds over a long game");
{
  let g = newGame("x");
  const picks: Mark[] = [];
  for (let n = 0; n < 6; n++) {
    picks.push(g.turn);
    // alternate hitting and missing so steals fire on half the turns
    const square = g.board.findIndex((c) => c === null);
    g = pick(g, square);
    g = advance(answer(g, n % 2 === 0));
    if (g.phase === "asking") g = resolve(g, false); // let the steal fail
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

console.log("\nmisc");
ok("other() flips", other("x") === "o" && other("o") === "x");

console.log(failed === 0 ? "\nall rules hold" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
