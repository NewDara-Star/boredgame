/**
 * Ball Sort runs as a race on two phones off one seed, so the rules, the bank
 * the puzzles come from, and the bot are checked rather than eyeballed.
 */
import {
  CAP, COLOURS, whyNot, canPour, pour, undo, isSolved, solvedCount, newGame, puzzleFor, fromBank,
  dailySeed, dailyPuzzle, encodeTubes, decodeTubes, decodeLine,
  type Level, type Tube, type Move,
} from "../src/features/sort/rules.ts";
import { BANK } from "../src/features/sort/bank.ts";
import { BANDS } from "./sort-bank.mts";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const LEVELS: Level[] = ["easy", "medium", "hard"];
let seq = 4242;
const rand = () => { seq = (Math.imul(seq, 1664525) + 1013904223) >>> 0; return seq / 4294967296; };
const isUniform = (t: Tube) => t.every((c) => c === t[0]);
const keyOf = (tubes: Tube[]) => tubes.map((t) => t.join("")).sort().join("|");

// --- the physical rules ---------------------------------------------------------
{
  const t: Tube[] = [[0, 0, 1], [1], [], [2, 2, 2, 2]];
  ok(canPour(t, CAP, 0, 1), "top ball onto its own colour");
  ok(canPour(t, CAP, 0, 2), "top ball into an empty tube");
  ok(canPour([[0], [1]], CAP, 1, 0), "and onto a DIFFERENT colour — that is the physical rule, and the plan");
  ok(whyNot(t, CAP, 0, 3) === "full", "not into a full tube");
  ok(whyNot(t, CAP, 2, 0) === "empty", "nothing pours from an empty tube");
  ok(whyNot(t, CAP, 0, 0) === "same", "nor onto itself");
  ok(whyNot(t, CAP, 0, 9) === "range", "nor off the board");
  ok(whyNot(t, CAP, 0, 1) === null, "a legal move has no reason against it");
}

// --- pour, undo, and the move count ------------------------------------------
{
  const p = { tubes: [[0, 0, 1], [1], [], []] as Tube[], cap: CAP, colours: 2, par: 2, line: [] as Move[] };
  const g0 = newGame(p);
  const g1 = pour(g0, 0, 1);
  ok(g1 !== g0 && g1.moves === 1, "a legal move is a move");
  ok(g1.tubes[1].length === 2 && g1.tubes[0].length === 2, "and exactly one ball went");
  const g1b = pour(pour(g0, 0, 2), 0, 2);
  ok(g1b.tubes[2].length === 2 && g1b.moves === 2, "two of the same colour take two moves — no run pours");
  ok(pour(g1, 1, 1) === g1, "an illegal move returns the same object");
  ok(g0.tubes[0].length === 3, "and the original is untouched");
  const g2 = undo(g1);
  ok(JSON.stringify(g2.tubes) === JSON.stringify(g0.tubes), "undo restores the tubes");
  ok(g2.moves === 1, "but the move still counts — undo is not free in a race");
  ok(undo(g0) === g0, "nothing to undo is a no-op");
  ok(!isSolved(g0.tubes, CAP), "a mixed board is not solved");
  ok(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]], CAP), "one colour per tube is");
  ok(!isSolved([[0, 0, 0], [0], [1, 1, 1, 1]], CAP), "a split colour is not, even if pure");
  ok(solvedCount([[0, 0, 0, 0], [1, 1, 1], [], [2, 2, 2, 2]], CAP) === 2, "solved tubes count");
  // the undirected graph: every move can be taken back as a move
  let g = newGame(fromBank(BANK.medium[0]));
  for (let k = 0; k < 30; k++) {
    const legal: Move[] = [];
    for (let f = 0; f < 6; f++) for (let t = 0; t < 6; t++) if (canPour(g.tubes, CAP, f, t)) legal.push([f, t]);
    const [f, t] = legal[Math.floor(rand() * legal.length)];
    const g2 = pour(g, f, t);
    ok(canPour(g2.tubes, CAP, t, f), `move ${k}: any move can be reversed — there are no dead ends`);
    g = g2;
  }
}

// --- THE BANK: every board is what it says it is ---------------------------------
// Nothing on a phone can solve these boards, so the bank is the only proof
// there is. Every entry: the right balls, no tube already home, the stored
// line legal under the rules above, finishing the board in exactly par moves,
// par inside the band it sits on, no duplicates across the whole bank.
{
  const seen = new Set<string>();
  for (const level of LEVELS) {
    const shelf = BANK[level];
    ok(shelf.length >= 100, `${level}: a full shelf (${shelf.length})`);
    const [lo, hi] = BANDS[level];
    let minPar = 99, maxPar = 0;
    shelf.forEach((e, i) => {
      const p = fromBank(e);
      ok(p.tubes.length === COLOURS + 1, `${level} ${i}: ${COLOURS} colours and one empty tube`);
      ok(p.tubes.filter((t) => t.length === 0).length === 1, `${level} ${i}: exactly one tube starts empty`);
      const balls = p.tubes.flat();
      ok(balls.length === COLOURS * CAP, `${level} ${i}: every ball is present`);
      for (let c = 0; c < COLOURS; c++)
        ok(balls.filter((b) => b === c).length === CAP, `${level} ${i}: ${CAP} of colour ${c}`);
      ok(!p.tubes.some((t) => t.length === CAP && isUniform(t)), `${level} ${i}: no tube starts finished`);
      ok(p.par >= lo && p.par <= hi, `${level} ${i}: par ${p.par} sits in its band ${lo}–${hi}`);
      ok(p.line.length === p.par, `${level} ${i}: par is the length of the line`);
      let g = newGame(p);
      for (const [f, t] of p.line) { const g2 = pour(g, f, t); ok(g2 !== g, `${level} ${i}: every move on the line is legal`); g = g2; }
      ok(isSolved(g.tubes, CAP) && g.moves === p.par, `${level} ${i}: the line finishes the board in par`);
      ok(lowerBound(p.tubes) <= p.par, `${level} ${i}: par is not below the provable lower bound`);
      const k = keyOf(p.tubes);
      ok(!seen.has(k), `${level} ${i}: not a duplicate of another entry`);
      seen.add(k);
      minPar = Math.min(minPar, p.par); maxPar = Math.max(maxPar, p.par);
    });
    console.log(`  ${level}: ${shelf.length} boards, par ${minPar}–${maxPar}`);
  }
  ok(BANDS.easy[1] < BANDS.medium[0] && BANDS.medium[1] < BANDS.hard[0], "the bands do not overlap");
  // The stored line is claimed SHORTEST. The bank script's A* is the source of
  // that claim; the first two entries of each shelf are re-solved here by an
  // independent search as a spot check that the claim is not just a claim.
  for (const level of LEVELS) for (const i of [0, 1]) {
    const p = fromBank(BANK[level][i]);
    const t0 = performance.now();
    const best = shortest(p.tubes, p.par);
    ok(best === p.par, `${level} ${i}: an independent search agrees par is ${p.par} (found ${best}, ${(performance.now() - t0).toFixed(0)}ms)`);
  }
}

/** The same admissible bound the bank script uses: each colour needs a home
    tube; a tube is worth its bottom run of a colour minus that colour's balls
    stacked above it (they must leave and return). Best assignment by DP. */
function lowerBound(tubes: Tube[]): number {
  const T = tubes.length;
  const w: number[][] = [];
  for (let c = 0; c < COLOURS; c++) {
    w.push([]);
    for (let t = 0; t < T; t++) {
      const tube = tubes[t];
      let run = 0; while (run < tube.length && tube[run] === c) run++;
      let above = 0; for (let i = run; i < tube.length; i++) if (tube[i] === c) above++;
      w[c][t] = run - above;
    }
  }
  let dp = new Map<number, number>([[0, 0]]);
  for (let c = 0; c < COLOURS; c++) {
    const nd = new Map<number, number>();
    for (const [mask, v] of dp) for (let t = 0; t < T; t++) {
      if (mask & (1 << t)) continue;
      const m2 = mask | (1 << t), v2 = v + w[c][t];
      if ((nd.get(m2) ?? -Infinity) < v2) nd.set(m2, v2);
    }
    dp = nd;
  }
  let best = -Infinity; for (const v of dp.values()) best = Math.max(best, v);
  return COLOURS * CAP - best;
}

/** Iterative-deepening search for a solution SHORTER than `claimed`, pruned by
    the lower bound. Returns the shortest length found up to `claimed`. It is
    a different algorithm from the bank's A*, which is the point. */
function shortest(start: Tube[], claimed: number): number {
  for (let depth = lowerBound(start); depth <= claimed; depth++) {
    const seen = new Map<string, number>();
    const dfs = (tubes: Tube[], d: number): boolean => {
      if (isSolved(tubes, CAP)) return true;
      if (d + lowerBound(tubes) > depth) return false;
      const k = keyOf(tubes);
      const prev = seen.get(k);
      if (prev !== undefined && prev <= d) return false;
      seen.set(k, d);
      for (let f = 0; f < tubes.length; f++) for (let t = 0; t < tubes.length; t++) {
        if (!canPour(tubes, CAP, f, t)) continue;
        const t2 = tubes.map((x) => x.slice());
        t2[t].push(t2[f].pop()!);
        if (dfs(t2, d + 1)) return true;
      }
      return false;
    };
    if (dfs(start, 0)) return depth;
  }
  return claimed + 1;
}

// --- one seed, one puzzle, on both phones ------------------------------------------
{
  for (const level of LEVELS) {
    const picks = new Set<number>();
    for (let s = 0; s < 60; s++) {
      const seed = 1_700_000_000_000 + s * 60_007;
      const a = puzzleFor(seed, level), b = puzzleFor(seed, level);
      ok(JSON.stringify(a) === JSON.stringify(b), `${level} ${s}: the same seed is the same puzzle`);
      picks.add(BANK[level].findIndex((e) => e[0] === encodeTubes(a.tubes)));
      ok(a.par >= BANDS[level][0] && a.par <= BANDS[level][1], `${level} ${s}: the level is the band`);
    }
    ok(picks.size > 30, `${level}: seeds spread across the shelf (${picks.size} of 60 distinct)`);
  }
  ok(JSON.stringify(puzzleFor(1, "medium").tubes) !== JSON.stringify(puzzleFor(2, "medium").tubes),
     "different seeds are different puzzles");
}

// --- today's tubes -----------------------------------------------------------------
// Solo is one board per level per day for everyone, so the pick has to be a
// pure function of the day and the level — and the edge function makes the
// same pick from the attempt row's day when it replays a finish.
{
  const days = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  });
  for (const level of LEVELS) {
    const seen = new Set<string>();
    let picks = new Set<number>();
    for (const day of days) {
      const a = dailyPuzzle(day, level), b = dailyPuzzle(day, level);
      ok(JSON.stringify(a) === JSON.stringify(b), `${day} ${level}: the same day is the same board`);
      ok(JSON.stringify(a) === JSON.stringify(puzzleFor(dailySeed(day, level), level)),
         `${day} ${level}: the day's board is the bank pick for the day's seed`);
      const seed = dailySeed(day, level);
      ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, `${day} ${level}: the seed is a uint32`);
      seen.add(encodeTubes(a.tubes));
      picks.add(BANK[level].findIndex((e) => e[0] === encodeTubes(a.tubes)));
    }
    ok(picks.size > 30, `${level}: sixty days spread across the shelf (${picks.size} distinct boards)`);
  }
  const d = "2026-09-05";
  ok(dailySeed(d, "easy") !== dailySeed(d, "medium") && dailySeed(d, "medium") !== dailySeed(d, "hard"),
     "the three levels of one day are three different draws");
  ok(dailySeed("2026-09-05", "medium") !== dailySeed("2026-09-06", "medium"), "consecutive days are different draws");
  ok(dailySeed("2026-09-05", "medium") !== dailySeed("2026-05-09", "medium"), "a swapped day and month is a different draw");
}

// --- the wire format -----------------------------------------------------------
// The row stores tubes as a string because SQL has to read it too, so the
// round trip is a property and not an implementation detail.
{
  for (const level of LEVELS) {
    for (let s = 0; s < 30; s++) {
      const p = puzzleFor(4_000_000 + s * 7919, level);
      const wire = encodeTubes(p.tubes);
      ok(/^[0-9/]*$/.test(wire), `${level} ${s}: the wire form is digits and slashes`);
      ok(JSON.stringify(decodeTubes(wire)) === JSON.stringify(p.tubes),
         `${level} ${s}: encode then decode is the identity`);
      ok(wire.split("/").length === p.tubes.length,
         `${level} ${s}: every tube survives, empties included`);
    }
  }
  ok(encodeTubes([[0,1,2,3],[],[]]) === "0123//", "empty tubes are empty segments");
  ok(decodeTubes("0123//").length === 3, "and come back as empty tubes");
  ok(JSON.stringify(decodeLine("0512")) === "[[0,5],[1,2]]", "a line is two digits a move");
}

// --- what the edge function does when it verifies a finish ----------------------
// The server does not take "I won" on trust: it regenerates the puzzle from the
// seed and replays the move list, rejecting the first illegal move. That is
// exactly the loop below, running the same functions the deployed function
// imports — so a change that would break the referee breaks this first.
{
  const replay = (seed: number, level: Level, moves: number[][]) => {
    let g = newGame(puzzleFor(seed, level));
    for (const [f, t] of moves) {
      const next = pour(g, f, t);
      if (next === g) return { ok: false as const, at: g.history.length };
      g = next;
    }
    return { ok: isSolved(g.tubes, g.cap), g };
  };
  for (const level of LEVELS) {
    for (let s = 0; s < 12; s++) {
      const seed = 6_000_000 + s * 15_485_863;
      const p = puzzleFor(seed, level);
      const line = p.line;
      const good = replay(seed, level, line);
      ok(good.ok, `${level} ${s}: an honest move list is accepted`);
      ok(good.g!.moves === line.length, `${level} ${s}: and counts the moves it made`);
      ok(good.g!.moves >= p.par, `${level} ${s}: a real solve is never under par`);
      ok(!replay(seed, level, []).ok, `${level} ${s}: an empty move list finishes nothing`);
      ok(!replay(seed, level, line.slice(0, -1)).ok, `${level} ${s}: one move short is not a finish`);
      // an illegal move spliced into the middle — the referee checks legality,
      // not that you played the one line the bank happens to store
      const bent = [...line.slice(0, Math.floor(line.length / 2)), [0, 0],
                    ...line.slice(Math.floor(line.length / 2))];
      ok(!replay(seed, level, bent).ok, `${level} ${s}: an illegal move anywhere voids the list`);
      const strange = [...line]; strange[0] = [99, 0];
      ok(!replay(seed, level, strange).ok, `${level} ${s}: an out-of-range tube voids it too`);
      // a longer, wandering, legal line that still finishes is a finish
      const wander = [...line.slice(0, 3), [line[2][1], line[2][0]], line[2], ...line.slice(3)];
      const w = replay(seed, level, wander);
      ok(w.ok && w.g!.moves === line.length + 2, `${level} ${s}: any legal line that finishes is accepted, at its own cost`);
      ok(!replay(seed + 1, level, line).ok, `${level} ${s}: a line from another puzzle does not transfer`);
    }
  }
}

// --- the referee is the same files the players run --------------------------------
// supabase/functions/sort-finish/ carries copies of rules.ts and bank.ts,
// because a deployed function needs its dependencies beside it. A copy that
// drifts is worse than no server check at all — it would reject honest
// finishes — so neither is allowed to drift silently.
{
  const sha = (p: string) => createHash("sha256")
    .update(readFileSync(new URL(p, import.meta.url))).digest("hex");
  for (const f of ["rules.ts", "bank.ts"]) {
    const mine = sha(`../src/features/sort/${f}`);
    const deployed = sha(`../supabase/functions/sort-finish/${f}`);
    ok(mine === deployed,
       `the deployed ${f} is byte-for-byte the played ${f}\n` +
       `      src:      ${mine}\n      function: ${deployed}\n` +
       `      -> cp src/features/sort/${f} supabase/functions/sort-finish/${f} and redeploy`);
  }
}

console.log(`${n} ball-sort assertions hold`);
