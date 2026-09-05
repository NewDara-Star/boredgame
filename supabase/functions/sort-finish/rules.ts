/**
 * Ball Sort, as a race.
 *
 * Tubes of coloured balls; sort them until every tube holds one colour. Three
 * rules: only the top ball moves, it may land only on an empty tube or on its
 * own colour, and a tube holds CAP. The empty tubes are the entire puzzle —
 * they are your working space, and running out of it is how you get stuck.
 *
 * Played as a race rather than a solitaire: the same puzzle on two phones,
 * Dublin and Manchester, first to sort it wins. That is the reason it is in
 * this app rather than being the ten-thousandth clone of itself. Pure planning
 * and no knowledge, so an eight-year-old and an adult are on level ground.
 *
 * Everything here is a pure function of its arguments and import-free, so the
 * component draws it, the bot plays it, both phones agree on the puzzle from
 * one seed, and scripts/check-sort.mts holds all of that to account.
 */

export type Level = "easy" | "medium" | "hard";

/** A tube, bottom first. Values are colour indices. */
export type Tube = number[];

export interface Puzzle {
  tubes: Tube[];
  cap: number;
  colours: number;
  /** the fewest moves it can be solved in — the solver's answer, not a guess */
  par: number;
}

export interface Game {
  tubes: Tube[];
  cap: number;
  moves: number;
  /** a move is one pour, however many balls travel */
  history: { from: number; to: number; n: number }[];
}

/** colours × cap balls, plus this many empty tubes to work in */
const SHAPE: Record<Level, { colours: number; empties: number; minPar: number }> = {
  easy:   { colours: 4, empties: 2, minPar: 6 },
  medium: { colours: 5, empties: 2, minPar: 10 },
  hard:   { colours: 6, empties: 2, minPar: 15 },
};
export const CAP = 4;

const top = (t: Tube) => t[t.length - 1];
const isUniform = (t: Tube) => t.every((c) => c === t[0]);

/** How many balls a pour would move: the run of matching colour on top of
    `from`, limited by the room left in `to`. 0 when the pour is illegal. */
export function pourSize(tubes: Tube[], cap: number, from: number, to: number): number {
  if (from === to) return 0;
  const a = tubes[from], b = tubes[to];
  if (!a || !b || a.length === 0 || b.length >= cap) return 0;
  const colour = top(a);
  if (b.length > 0 && top(b) !== colour) return 0;
  let run = 0;
  for (let i = a.length - 1; i >= 0 && a[i] === colour; i--) run++;
  return Math.min(run, cap - b.length);
}

export const canPour = (tubes: Tube[], cap: number, from: number, to: number) =>
  pourSize(tubes, cap, from, to) > 0;

/** The pour, applied. Returns the same game when it is illegal, so a caller can
    test by identity and a stray tap changes nothing. */
export function pour(g: Game, from: number, to: number): Game {
  const n = pourSize(g.tubes, g.cap, from, to);
  if (n === 0) return g;
  const tubes = g.tubes.map((t) => t.slice());
  const moved = tubes[from].splice(tubes[from].length - n, n);
  tubes[to].push(...moved);
  return { ...g, tubes, moves: g.moves + 1, history: [...g.history, { from, to, n }] };
}

/** Take the last pour back. Undo is not free in a race — it still cost a move. */
export function undo(g: Game): Game {
  const last = g.history[g.history.length - 1];
  if (!last) return g;
  const tubes = g.tubes.map((t) => t.slice());
  const moved = tubes[last.to].splice(tubes[last.to].length - last.n, last.n);
  tubes[last.from].push(...moved);
  return { ...g, tubes, history: g.history.slice(0, -1) };
}

export const isSolved = (tubes: Tube[], cap: number) =>
  tubes.every((t) => t.length === 0 || (t.length === cap && isUniform(t)));

/** Tubes already finished — a colour fully home. */
export const solvedCount = (tubes: Tube[], cap: number) =>
  tubes.filter((t) => t.length === cap && isUniform(t)).length;

/**
 * The wire format: one character per ball, "/" between tubes, so
 * "0123/1032/2301/3210//" is four filled tubes and two empty ones.
 *
 * It lives here rather than in a wire module because the SERVER parses it too
 * — sort_is_solved reads it in SQL, and the edge function that verifies a
 * finish runs this very file. One definition, three runtimes.
 */
export const encodeTubes = (tubes: Tube[]) => tubes.map((t) => t.join("")).join("/");
export const decodeTubes = (s: string): Tube[] =>
  s.split("/").map((t) => [...t].map((c) => Number(c)));

export const newGame = (p: Puzzle): Game =>
  ({ tubes: p.tubes.map((t) => t.slice()), cap: p.cap, moves: 0, history: [] });

/**
 * A stream of numbers from one seed. Both phones derive the puzzle from the
 * moment the race was written — the row they already share — so they get the
 * same tubes without another column. Same hash as the catapult's, for the
 * same reason: seeds are timestamps whose low bits move in lockstep.
 */
function stream(seed: number): () => number {
  let h = Math.abs(Math.trunc(seed)) || 1;
  h = (h ^ 61) ^ (h >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  let s = h >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Tubes are interchangeable, so two boards that differ only in which tube is
    where are the same position. Sorting the key is what makes the solver's
    visited set small enough to be fast. */
const keyOf = (tubes: Tube[]) => tubes.map((t) => t.join("")).sort().join("|");

/**
 * The fewest pours that solve a position, or null past `limit` nodes.
 *
 * Breadth-first, so the first solution found is the shortest. Two pruning
 * rules keep it honest and quick: never pour a finished tube, and never pour
 * a single-colour tube into an empty one (that is the same position with the
 * names swapped). The `limit` exists so a pathological board cannot hang a
 * phone; the generator treats "too hard to solve" as "reject".
 */
export function solve(tubes: Tube[], cap: number, limit = 60_000): number[][] | null {
  const start = keyOf(tubes);
  if (isSolved(tubes, cap)) return [];
  const seen = new Set<string>([start]);
  let frontier: { tubes: Tube[]; path: number[][] }[] = [{ tubes, path: [] }];
  let nodes = 0;
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { tubes: cur, path } of frontier) {
      for (let from = 0; from < cur.length; from++) {
        const a = cur[from];
        if (a.length === 0) continue;
        if (a.length === cap && isUniform(a)) continue;             // finished: leave it
        for (let to = 0; to < cur.length; to++) {
          const n = pourSize(cur, cap, from, to);
          if (n === 0) continue;
          if (cur[to].length === 0 && isUniform(a)) continue;        // rename, not a move
          const t2 = cur.map((t) => t.slice());
          const moved = t2[from].splice(t2[from].length - n, n);
          t2[to].push(...moved);
          const k = keyOf(t2);
          if (seen.has(k)) continue;
          const p2 = [...path, [from, to]];
          if (isSolved(t2, cap)) return p2;
          seen.add(k);
          next.push({ tubes: t2, path: p2 });
          if (++nodes > limit) return null;
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * The puzzle for a seed.
 *
 * Random fill, then PROVE it: a random arrangement can be unsolvable, or
 * solvable in three pours, and neither is a puzzle. Each candidate is run
 * through the solver and kept only if it is solvable and its optimal solution
 * is long enough to be interesting. The solver's answer is stored as `par`,
 * so the game can say "solved in 14, par 11" and mean it.
 */
export function puzzleFor(seed: number, level: Level = "medium"): Puzzle {
  const { colours, empties, minPar } = SHAPE[level];
  const next = stream(seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const balls: number[] = [];
    for (let c = 0; c < colours; c++) for (let i = 0; i < CAP; i++) balls.push(c);
    for (let i = balls.length - 1; i > 0; i--) {                    // Fisher–Yates
      const j = Math.floor(next() * (i + 1));
      [balls[i], balls[j]] = [balls[j], balls[i]];
    }
    const tubes: Tube[] = [];
    for (let c = 0; c < colours; c++) tubes.push(balls.slice(c * CAP, c * CAP + CAP));
    for (let e = 0; e < empties; e++) tubes.push([]);
    if (tubes.some((t) => t.length === CAP && isUniform(t))) continue; // a free tube is no fun
    const path = solve(tubes, CAP);
    if (!path || path.length < minPar) continue;
    return { tubes, cap: CAP, colours, par: path.length };
  }
  // Unreached in practice (see check-sort.mts); a known-good fallback so the
  // race can always start rather than crash.
  const tubes: Tube[] = [[0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0],[],[]];
  return { tubes, cap: CAP, colours: 4, par: solve(tubes, CAP)?.length ?? 8 };
}

/** How often the bot takes the best move rather than a merely legal one. */
export const BOT_SKILL: Record<Level, number> = { easy: 0.55, medium: 0.7, hard: 0.82 };
/** Milliseconds between the bot's pours — its thinking time. */
export const BOT_PACE: Record<Level, number> = { easy: 2600, medium: 2000, hard: 1500 };

/**
 * The bot's next pour. It knows the optimal line (it can afford to solve), and
 * plays it with probability BOT_SKILL; otherwise a random legal pour. So it is
 * beatable by planning, not by luck.
 *
 * Two rules stop "random" from becoming "never finishes", which it did on one
 * hard board in twelve: it never plays the exact reverse of its last pour —
 * the main way a wanderer loops — and once it is within four pours of the end
 * it closes out. A bot that flails in the middle is a fair opponent; one that
 * dithers on the last two tubes is a race with nobody in it.
 */
export function botPour(g: Game, level: Level, rand: () => number): [number, number] | null {
  const legal: [number, number][] = [];
  const last = g.history[g.history.length - 1];
  for (let f = 0; f < g.tubes.length; f++) {
    const a = g.tubes[f];
    if (a.length === 0 || (a.length === g.cap && isUniform(a))) continue;
    for (let t = 0; t < g.tubes.length; t++) {
      if (pourSize(g.tubes, g.cap, f, t) === 0) continue;
      if (g.tubes[t].length === 0 && isUniform(a)) continue;
      if (last && last.from === t && last.to === f) continue;      // not straight back
      legal.push([f, t]);
    }
  }
  const best = solve(g.tubes, g.cap, 20_000);
  if (best && best.length && (best.length <= 4 || rand() < BOT_SKILL[level]))
    return best[0] as [number, number];
  // A random pour, but never one that KILLS the board: a legal pour can fill
  // the working space in a way nothing recovers from, and the bot then has
  // moves for ever and a finish never. One hard board in twelve did exactly
  // that. Shuffle the candidates and take the first that leaves a solution.
  for (let i = legal.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)); [legal[i], legal[j]] = [legal[j], legal[i]];
  }
  for (const [f, t] of legal) {
    const after = pour(g, f, t).tubes;
    if (solve(after, g.cap, 20_000)) return [f, t];
  }
  return best && best.length ? (best[0] as [number, number]) : null;
}
