/**
 * Plain Tic Tac Toe shares Square Off's board and win test; place() is the
 * whole of the plain game. Run:
 *   node --experimental-strip-types scripts/check-tictactoe.mts
 */
import {
  newGame, place, other, winnerOf, botSquare, openSquares,
  type Game, type Mark,
} from "../src/features/squareoff/rules.ts";

let failed = 0;
const ok = (n: string, c: boolean) => { if (!c) { failed++; console.log(`  FAIL  ${n}`); } else console.log(`  ok    ${n}`); };
const run = (g: Game, sq: number[]) => sq.reduce(place, g);

console.log("placing");
{
  const g = place(newGame("x"), 4);
  ok("the square is taken", g.board[4] === "x");
  ok("the turn passes", g.turn === "o");
  ok("still in play", g.phase === "picking");
  ok("no question is pending", g.target === null && g.answerer === null);
  const again = place(g, 4);
  ok("a taken square is refused", again.board[4] === "x" && again.turn === "o");
  ok("an out-of-range square is refused", place(g, 9).board.join("") === g.board.join(""));
  ok("a negative square is refused", place(g, -1).board.join("") === g.board.join(""));
}

console.log("\nendings");
{
  const win = run(newGame("x"), [0, 3, 1, 4, 2]);
  ok("three in a row ends it", win.phase === "over" && win.winner === "x");
  ok("the winning line is reported", win.line?.length === 3);
  ok("no further moves land", place(win, 8).board.join("") === win.board.join(""));
  ok("the finished board is not left contested", win.target === null);

  const draw = run(newGame("x"), [4, 0, 1, 7, 6, 2, 8, 5, 3]);
  ok("a full board with no line is a draw", draw.phase === "over" && draw.winner === "draw");
  ok("and reports no line", draw.line === null);
  ok("the board really is full", openSquares(draw.board).length === 0);
}

console.log("\nturn order");
{
  let g = newGame("x");
  const seen: Mark[] = [];
  for (const sq of [0, 1, 2, 3, 4, 5]) { seen.push(g.turn); g = place(g, sq); }
  ok("moves alternate strictly", seen.every((m, i) => m === (i % 2 === 0 ? "x" : "o")));
  ok("who starts is respected", place(newGame("o"), 0).board[0] === "o");
}

console.log("\nagreement with the shared win test");
{
  let agree = true, ended = 0;
  for (let t = 0; t < 500; t++) {
    let g = newGame(t % 2 ? "o" : "x");
    while (g.phase === "picking") g = place(g, botSquare(g.board, g.turn));
    ended++;
    if ((winnerOf(g.board)?.mark ?? "draw") !== (g.winner ?? "draw")) agree = false;
  }
  ok("500 bot-vs-bot games agree with winnerOf", agree && ended === 500);
  ok("every one of them terminated", ended === 500);
  ok("other() flips", other("x") === "o" && other("o") === "x");
}

console.log(failed === 0 ? "\nall rules hold" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
