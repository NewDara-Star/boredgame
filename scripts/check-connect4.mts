/**
 * The Connect 4 rules run on both sides of a network, so they get checked
 * rather than eyeballed. Run: node --experimental-strip-types scripts/check-connect4.mts
 */
import {
  COLS, ROWS, SIZE, newGame, drop, pick, answer, advance, winnerOf, landingRow,
  openColumns, boardFull, botColumn, other, stallWriter,
  type Game, type Mark, type Cell,
} from "../src/features/connect4/rules.ts";

let failed = 0;
const ok = (name: string, cond: boolean) => {
  if (!cond) { failed++; console.log(`  FAIL  ${name}`); } else console.log(`  ok    ${name}`);
};
/** Build a board from rows written top to bottom, '.' for empty. */
const parse = (rows: string[]): Cell[] =>
  rows.join("").split("").map((ch) => (ch === "x" || ch === "o" ? ch : null));
const idx = (r: number, c: number) => r * COLS + c;
/** Drop a run of columns, alternating turns via the reducer itself. */
const play = (g: Game, cols: number[]) => cols.reduce(drop, g);

console.log("the grid");
{
  const g = newGame("x");
  ok("board is 7 by 6", g.board.length === SIZE && COLS === 7 && ROWS === 6);
  ok("every column starts open", openColumns(g.board).length === 7);
  const d = drop(g, 3);
  ok("a disc falls to the bottom row", d.board[idx(ROWS - 1, 3)] === "x");
  ok("nothing floats above it", d.board[idx(ROWS - 2, 3)] === null);
  ok("the turn passes", d.turn === "o");
  const e = drop(d, 3);
  ok("the next disc stacks on top", e.board[idx(ROWS - 2, 3)] === "o");
}

console.log("\nfull columns");
{
  let g = newGame("x");
  for (let i = 0; i < ROWS; i++) g = drop(g, 0);
  ok("six discs fill a column", g.board.filter((c, i) => i % COLS === 0 && c).length === ROWS);
  ok("a full column reports no landing row", landingRow(g.board, 0) === -1);
  ok("it drops out of the open list", !openColumns(g.board).includes(0));
  const before = g.board.join("");
  const after = drop(g, 0);
  ok("dropping into it changes nothing", after.board.join("") === before && after.turn === g.turn);
}

console.log("\nwinning lines");
{
  const horiz = parse([".......", ".......", ".......", ".......", ".......", "xxxx..."]);
  ok("four across wins", winnerOf(horiz)?.mark === "x");
  ok("the winning line is reported", winnerOf(horiz)?.line.length === 4);

  const vert = parse([".......", ".......", "..o....", "..o....", "..o....", "..o...."]);
  ok("four down wins", winnerOf(vert)?.mark === "o");

  const up = parse([".......", ".......", "...x...", "..xo...", ".xoo...", "xooo..."]);
  ok("four on the rising diagonal wins", winnerOf(up)?.mark === "x");

  const down = parse([".......", ".......", "o......", "xo.....", "xxo....", "xxxo..."]);
  ok("four on the falling diagonal wins", winnerOf(down)?.mark === "o");

  const three = parse([".......", ".......", ".......", ".......", ".......", "xxx.o.."]);
  ok("three in a row is not a win", winnerOf(three) === null);

  const split = parse([".......", ".......", ".......", ".......", ".......", "xxoxx.."]);
  ok("a broken run is not a win", winnerOf(split) === null);

  const corner = parse(["....xxx", ".......", ".......", ".......", ".......", "......."]);
  ok("three against the right edge does not wrap", winnerOf(corner) === null);

  const topRow = parse(["xxxx...", ".......", ".......", ".......", ".......", "......."]);
  ok("a win on the very top row is found", winnerOf(topRow)?.mark === "x");
}

console.log("\nending a game");
{
  // x takes columns 0,1,2,3 along the bottom while o stacks on column 6.
  const g = play(newGame("x"), [0, 6, 1, 6, 2, 6, 3]);
  ok("the game is over", g.phase === "over");
  ok("x is the winner", g.winner === "x");
  ok("the line is four long", g.line?.length === 4);
  const after = drop(g, 5);
  ok("no further discs land", after.board.join("") === g.board.join(""));
}

console.log("\na draw");
{
  // Fill every column without a four: stagger the pattern column by column.
  const rows = [
    "ooxxoox",
    "xxooxxo",
    "ooxxoox",
    "xxooxxo",
    "ooxxoox",
    "xxooxxo",
  ];
  const board = parse(rows);
  ok("the board is full", boardFull(board));
  ok("nobody has four in a row", winnerOf(board) === null);
}

console.log("\ntrivia: a right answer places, a wrong one does not");
{
  const asked = pick(newGame("x"), 3);
  ok("picking a column asks a question", asked.phase === "asking" && asked.target === 3);
  ok("no disc has been placed yet", asked.board.every((c) => c === null));
  ok("the turn has not moved", asked.turn === "x");

  const hit = answer(asked, true);
  ok("a right answer drops the disc", hit.board[idx(ROWS - 1, 3)] === "x");
  ok("and pauses on the reveal", hit.phase === "revealed");
  ok("the reveal records who and where", hit.last?.by === "x" && hit.last?.col === 3 && hit.last?.correct === true);
  const afterHit = advance(hit);
  ok("then the turn passes", afterHit.turn === "o" && afterHit.phase === "picking");

  const missed = answer(asked, false);
  ok("a wrong answer places nothing", missed.board.every((c) => c === null));
  ok("and still pauses on the reveal", missed.phase === "revealed" && missed.last?.correct === false);
  const afterMiss = advance(missed);
  ok("a miss costs the turn", afterMiss.turn === "o" && afterMiss.phase === "picking");
  ok("there is no steal to answer", afterMiss.target === null && afterMiss.last === null);
}

console.log("\ntrivia: turn order alternates strictly");
{
  let g = newGame("x");
  const seen: Mark[] = [];
  for (let i = 0; i < 8 && g.phase !== "over"; i++) {
    seen.push(g.turn);
    // alternate right and wrong answers; neither should break the alternation
    g = advance(answer(pick(g, i % COLS), i % 2 === 0));
  }
  ok("moves alternate whatever the answers", seen.every((m, i) => m === (i % 2 === 0 ? "x" : "o")));
}

console.log("\ntrivia: a win through questions still ends it");
{
  let g = newGame("x");
  // x answers everything right on columns 0..3, o answers everything wrong.
  for (const c of [0, 0, 1, 1, 2, 2]) g = advance(answer(pick(g, c), g.turn === "x"));
  ok("x has three along the bottom",
     g.board[idx(ROWS - 1, 0)] === "x" && g.board[idx(ROWS - 1, 1)] === "x" && g.board[idx(ROWS - 1, 2)] === "x");
  ok("o has nothing on the board", !g.board.includes("o"));
  const won = answer(pick(g, 3), true);
  ok("the fourth ends the game", won.phase === "over" && won.winner === "x");
}

console.log("\nthe bot");
{
  const win = parse([".......", ".......", ".......", ".......", ".......", "ooo.xxx"]);
  ok("takes the win", botColumn(win, "o") === 3);
  const block = parse([".......", ".......", ".......", ".......", ".......", "xxx...o"]);
  ok("blocks yours", botColumn(block, "o") === 3);
  const both = parse([".......", ".......", ".......", ".....oo", "xxx..oo", "xxo..oo"]);
  ok("prefers the win over the block", (() => {
    const c = botColumn(both, "o");
    const trial = both.slice(); trial[landingRow(both, c) * COLS + c] = "o";
    return winnerOf(trial)?.mark === "o";
  })());
  ok("opens in the centre", botColumn(newGame("x").board, "x") === 3);
  ok("always returns an open column", (() => {
    for (let t = 0; t < 200; t++) {
      let g = newGame("x");
      for (let i = 0; i < 20 && g.phase !== "over"; i++) {
        const c = botColumn(g.board, g.turn);
        if (!openColumns(g.board).includes(c)) return false;
        g = drop(g, c);
      }
    }
    return true;
  })());
  ok("a full board returns -1", botColumn(parse([
    "ooxxoox", "xxooxxo", "ooxxoox", "xxooxxo", "ooxxoox", "xxooxxo",
  ]), "x") === -1);
}

console.log("\nabandonment: exactly one writer at any instant");
{
  const ASK = 20000, REVEAL = 4500, GRACE = 6000;
  const MS = { ask: ASK, reveal: REVEAL, grace: GRACE };
  const at_ = (g: Parameters<typeof stallWriter>[0], t: number) => {
    const w = stallWriter(g, t, MS);
    return w ? `${w.mark}:${w.action}` : null;
  };
  const asking = pick(newGame("x"), 2);
  const hit = answer(asking, true);
  const miss = answer(asking, false);

  ok("nobody writes while the clock runs", at_(asking, 0) === null && at_(asking, ASK - 1) === null);
  ok("the answerer writes their own timeout", at_(asking, ASK) === "x:timeout");
  ok("the opponent takes over after the grace", at_(asking, ASK + GRACE) === "o:timeout");
  ok("a reveal is left alone during the pause", at_(hit, 0) === null && at_(hit, REVEAL - 1) === null);
  ok("its owner moves it on", at_(hit, REVEAL) === "x:advance");
  ok("a stuck reveal passes to the opponent", at_(hit, REVEAL + GRACE) === "o:advance");
  ok("a missed answer behaves the same way",
     at_(miss, REVEAL) === "x:advance" && at_(miss, REVEAL + GRACE) === "o:advance");
  ok("a frozen reveal always resolves eventually", at_(hit, 10 * 60_000) !== null);
  ok("never two writers at once", (() => {
    for (const g of [asking, hit, miss]) {
      for (let t = 0; t <= ASK + GRACE * 3; t += 137) {
        const w = stallWriter(g, t, MS);
        if (w && w.mark !== "x" && w.mark !== "o") return false;
        if (w && w.action !== "timeout" && w.action !== "advance") return false;
      }
    }
    return true;
  })());
  ok("a pick has no deadline, nor has a finished game",
     at_(newGame("x"), 99999) === null && at_(play(newGame("x"), [0, 6, 1, 6, 2, 6, 3]), 99999) === null);
}

console.log("\nmisc");
ok("other() flips", other("x") === "o" && other("o") === "x");

console.log(failed === 0 ? "\nall rules hold" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
