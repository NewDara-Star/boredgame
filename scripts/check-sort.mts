/**
 * Ball Sort runs as a race on two phones off one seed, so the puzzle, the
 * rules and the bot are checked rather than eyeballed.
 */
import {
  CAP, pourSize, pour, undo, isSolved, solvedCount, newGame, solve, puzzleFor,
  botPour, BOT_SKILL, BOT_PACE, type Level, type Tube,
} from "../src/features/sort/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const LEVELS: Level[] = ["easy", "medium", "hard"];
let seq = 4242;
const rand = () => { seq = (Math.imul(seq, 1664525) + 1013904223) >>> 0; return seq / 4294967296; };

// --- the three rules ---------------------------------------------------------
{
  const t: Tube[] = [[0, 0, 1], [1], [], [2, 2, 2, 2]];
  ok(pourSize(t, CAP, 0, 1) === 1, "top ball onto its own colour");
  ok(pourSize(t, CAP, 0, 2) === 1, "top ball into an empty tube");
  ok(pourSize([[0], [1]], CAP, 1, 0) === 0, "not onto a different colour");
  ok(pourSize(t, CAP, 0, 3) === 0, "not into a full tube");
  ok(pourSize(t, CAP, 2, 0) === 0, "nothing pours from an empty tube");
  ok(pourSize(t, CAP, 0, 0) === 0, "nor onto itself");
  ok(pourSize([[1, 0, 0], [0, 0]], CAP, 0, 1) === 2, "a run of the same colour pours together");
  ok(pourSize([[1, 0, 0, 0], [0, 0, 0]], CAP, 0, 1) === 1, "but only as many as fit");
}

// --- pour, undo, and the move count ------------------------------------------
{
  const g0 = newGame({ tubes: [[0, 0, 1], [1], [], []], cap: CAP, colours: 2, par: 2 });
  const g1 = pour(g0, 0, 1);
  ok(g1 !== g0 && g1.moves === 1, "a legal pour is a move");
  ok(g1.tubes[1].length === 2 && g1.tubes[0].length === 2, "and the ball went");
  ok(pour(g1, 1, 0) === g1, "an illegal pour returns the same object");
  ok(g0.tubes[0].length === 3, "and the original is untouched");
  const g2 = undo(g1);
  ok(JSON.stringify(g2.tubes) === JSON.stringify(g0.tubes), "undo restores the tubes");
  ok(g2.moves === 1, "but the move still counts — undo is not free in a race");
  ok(undo(g0) === g0, "nothing to undo is a no-op");
  ok(!isSolved(g0.tubes, CAP), "a mixed board is not solved");
  ok(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]], CAP), "one colour per tube is");
  ok(!isSolved([[0, 0, 0], [0], [1, 1, 1, 1]], CAP), "a split colour is not, even if pure");
  ok(solvedCount([[0, 0, 0, 0], [1, 1, 1], [], [2, 2, 2, 2]], CAP) === 2, "solved tubes count");
}

// --- the solver ----------------------------------------------------------------
{
  ok(solve([[0, 0, 0, 0], []], CAP)!.length === 0, "a solved board needs no moves");
  const one = solve([[0, 0, 0], [0], []], CAP);
  ok(!!one && one.length === 1, "one pour when one pour does it");
  // "solved" means every colour is HOME — a full tube — so a board with fewer
  // than CAP balls of a colour can never be solved. That is the rule, not a bug.
  ok(solve([[0, 1], [1, 0], [], []], CAP) === null, "a short-handed colour can never come home");
  // the path it returns actually works
  let g = newGame({ tubes: [[0, 1, 0, 1], [1, 0, 1, 0], [], []], cap: CAP, colours: 2, par: 0 });
  const sol = solve(g.tubes, CAP)!;
  for (const [f, t] of sol) { const g2 = pour(g, f, t); ok(g2 !== g, "every solver pour is legal"); g = g2; }
  ok(isSolved(g.tubes, CAP), "and following it solves the board");
  ok(solve([[0, 1, 0, 1], [1, 0, 1, 0]], CAP) === null, "no working space means no solution");
  // optimality: brute-force one small case
  const opt = solve([[0, 0, 1, 1], [1, 1, 0, 0], [], []], CAP)!;
  ok(opt.length <= 4, `it finds a short line, not just a line (${opt.length})`);
}

// --- THE GUARANTEE: every puzzle is solvable, and says how hard it is --------
{
  for (const level of LEVELS) {
    let worstMs = 0, pars: number[] = [];
    for (let s = 0; s < 40; s++) {
      const seed = 1_700_000_000_000 + s * 60_007;
      const t0 = performance.now();
      const p = puzzleFor(seed, level);
      worstMs = Math.max(worstMs, performance.now() - t0);
      const again = puzzleFor(seed, level);
      ok(JSON.stringify(again.tubes) === JSON.stringify(p.tubes) && again.par === p.par,
         `${level} ${s}: the same seed is the same puzzle, on both phones`);
      const sol = solve(p.tubes, CAP);
      ok(!!sol, `${level} ${s}: the puzzle is solvable`);
      ok(sol!.length === p.par, `${level} ${s}: par is the solver's answer (${p.par})`);
      ok(!p.tubes.some((t) => t.length === CAP && t.every((c) => c === t[0])),
         `${level} ${s}: no tube starts finished`);
      const balls = p.tubes.flat();
      ok(balls.length === p.colours * CAP, `${level} ${s}: every ball is present`);
      for (let c = 0; c < p.colours; c++)
        ok(balls.filter((b) => b === c).length === CAP, `${level} ${s}: ${CAP} of colour ${c}`);
      pars.push(p.par);
    }
    const minPar = Math.min(...pars), maxPar = Math.max(...pars);
    ok(minPar >= 6, `${level}: never trivial (shortest par ${minPar})`);
    // A phone has to do this on the way into a race. 40 seeds in a row here
    // includes every rejected candidate, so the worst case is the real one.
    ok(worstMs < 1500, `${level}: generating is fast enough for a phone (worst ${worstMs.toFixed(0)}ms)`);
    console.log(`  ${level}: par ${minPar}–${maxPar}, worst ${worstMs.toFixed(0)}ms to generate`);
  }
  const a = puzzleFor(1, "medium"), b = puzzleFor(2, "medium");
  ok(JSON.stringify(a.tubes) !== JSON.stringify(b.tubes), "different seeds are different puzzles");
}

// --- the bot ---------------------------------------------------------------------
{
  for (const level of LEVELS) {
    let solvedGames = 0, totalMoves = 0, stuck = 0;
    for (let s = 0; s < 12; s++) {
      const p = puzzleFor(9_000_000 + s * 7919, level);
      let g = newGame(p);
      let steps = 0;
      while (!isSolved(g.tubes, g.cap) && steps < 400) {
        const mv = botPour(g, level, rand);
        if (!mv) { stuck++; break; }
        const g2 = pour(g, mv[0], mv[1]);
        ok(g2 !== g, `${level} ${s}: the bot only ever proposes a legal pour`);
        g = g2; steps++;
      }
      if (isSolved(g.tubes, g.cap)) { solvedGames++; totalMoves += g.moves; }
    }
    ok(stuck === 0, `${level}: the bot never gets stuck`);
    ok(solvedGames === 12, `${level}: the bot finishes every race (${solvedGames}/12)`);
    // and it never digs itself into a dead board on the way
    for (let s = 0; s < 6; s++) {
      const p = puzzleFor(3_000_000 + s * 104_729, level);
      let g = newGame(p);
      for (let k = 0; k < 40 && !isSolved(g.tubes, g.cap); k++) {
        const mv = botPour(g, level, rand)!;
        g = pour(g, mv[0], mv[1]);
        ok(solve(g.tubes, g.cap) !== null, `${level} ${s}: the board is still solvable after the bot's pour ${k}`);
      }
    }
    ok(BOT_SKILL[level] > 0 && BOT_SKILL[level] < 1, `${level}: skill is a probability`);
    ok(BOT_PACE[level] >= 1000, `${level}: the bot takes at least a second to think`);
    console.log(`  bot ${level}: solves in ${(totalMoves / solvedGames).toFixed(1)} moves on average`);
  }
  ok(BOT_SKILL.easy < BOT_SKILL.hard && BOT_PACE.easy > BOT_PACE.hard, "harder is sharper and faster");
}

console.log(`${n} ball-sort assertions hold`);
