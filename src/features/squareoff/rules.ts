/**
 * Square Off — tic-tac-toe where a square costs a right answer.
 *
 * The rule that makes it a game rather than a speed quiz with a grid drawn on
 * it: turns alternate by PICK, and a steal is an interrupt that does not change
 * whose pick comes next.
 *
 *   X picks a square, X answers
 *     correct -> X claims it
 *     wrong   -> O gets one shot at that same square (a fresh question)
 *                  correct -> O claims it
 *                  wrong   -> the square stays open
 *   ...either way, the next pick is O's.
 *
 * So missing costs you the square and hands your opponent a free attempt, but
 * never costs you a turn outright. Every function here is pure — the solo game
 * and the two-player room run the same reducer, which is the only way the rules
 * can be guaranteed to match on both sides of a network.
 */

export type Mark = "x" | "o";
export type Cell = Mark | null;
export type Phase = "picking" | "asking" | "revealed" | "over";

export interface Game {
  board: Cell[];
  /** whose PICK it is; a steal never moves this */
  turn: Mark;
  phase: Phase;
  /** the square currently being contested */
  target: number | null;
  /** true when the pending question is the opponent's one shot at `target` */
  steal: boolean;
  /** who owes an answer right now */
  answerer: Mark | null;
  /** what the last answer did, so the UI can say so before play moves on */
  last: { by: Mark; square: number; correct: boolean; steal: boolean } | null;
  winner: Mark | "draw" | null;
  line: number[] | null;
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (m: Mark): Mark => (m === "x" ? "o" : "x");

export const newGame = (first: Mark = "x"): Game => ({
  board: Array(9).fill(null),
  turn: first,
  phase: "picking",
  target: null,
  steal: false,
  answerer: null,
  last: null,
  winner: null,
  line: null,
});

export function winnerOf(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a]!, line };
    }
  }
  return null;
}

export const openSquares = (board: Cell[]) =>
  board.reduce<number[]>((acc, c, i) => (c === null ? [...acc, i] : acc), []);

/** The active player commits to a square. The question comes after, not before. */
export function pick(g: Game, square: number): Game {
  if (g.phase !== "picking" || g.board[square] !== null) return g;
  return { ...g, phase: "asking", target: square, steal: false, answerer: g.turn, last: null };
}

/** Resolve the pending question. Claiming can end the game outright. */
export function answer(g: Game, correct: boolean): Game {
  if (g.phase !== "asking" || g.target === null || !g.answerer) return g;
  const by = g.answerer;
  const last = { by, square: g.target, correct, steal: g.steal };
  if (!correct) return { ...g, phase: "revealed", last };

  const board = g.board.slice();
  board[g.target] = by;
  // A finished square is claimed, not contested — leaving `target` set paints the
  // winning square as "in play" instead of as part of the winning line.
  const done = { ...g, board, phase: "over" as const, target: null, answerer: null, steal: false, last };
  const win = winnerOf(board);
  if (win) return { ...done, winner: win.mark, line: win.line };
  if (openSquares(board).length === 0) return { ...done, winner: "draw" as const };
  return { ...g, board, phase: "revealed", last };
}

/**
 * Move on from a resolved question: into the steal if one is owed, otherwise to
 * the other player's pick.
 */
export function advance(g: Game): Game {
  if (g.phase !== "revealed" || !g.last) return g;
  const stealOwed = !g.last.correct && !g.last.steal;
  if (stealOwed) {
    return { ...g, phase: "asking", steal: true, answerer: other(g.turn), last: null };
  }
  return {
    ...g, phase: "picking", turn: other(g.turn),
    target: null, steal: false, answerer: null, last: null,
  };
}

/**
 * One line of English for whatever just happened; the board alone is not
 * legible. `you` is the mark the reader is playing, so the same rules engine
 * writes "You miss" for one player and "Dara misses" for the other watching the
 * same room — one sentence, conjugated, rather than two copies of the logic.
 */
export function describe(g: Game, names: Record<Mark, string>, you: Mark | null = null): string {
  const second = (m: Mark) => m === you;
  const who = (m: Mark) => (second(m) ? "You" : names[m]);
  const s = (m: Mark, verb: string) => (second(m) ? verb : `${verb}s`);
  const sq = (n: number) => `square ${n + 1}`;

  if (g.phase === "over") {
    if (g.winner === "draw") return "Board full — it's a draw.";
    const m = g.winner as Mark;
    return second(m) ? "You win." : `${names[m]} wins.`;
  }
  if (g.phase === "revealed" && g.last) {
    const { by, square, correct, steal } = g.last;
    if (correct) return `${who(by)} ${s(by, "take")} ${sq(square)}.`;
    if (steal) return `${who(by)} ${s(by, "miss")} too — ${sq(square)} stays open.`;
    const thief = other(by);
    return `${who(by)} ${s(by, "miss")}. ${who(thief)} ${s(thief, "get")} one shot at it.`;
  }
  if (g.phase === "asking" && g.answerer) {
    const m = g.answerer;
    const target = sq(g.target ?? 0);
    if (g.steal) return `${who(m)} can steal ${target}.`;
    return second(m) ? `You're going for ${target}.` : `${names[m]} is going for ${target}.`;
  }
  return second(g.turn) ? "Your pick — take a square." : `${names[g.turn]} is picking.`;
}

/* ------------------------------------------------------------------ the bot */

/**
 * Take the win, else block theirs, else centre, else a corner. Deliberately not
 * perfect: a solved opponent would make every solo game a draw, and the tension
 * here is meant to come from the questions, not from out-thinking a minimax.
 */
export function botSquare(board: Cell[], me: Mark, rand = Math.random): number {
  const open = openSquares(board);
  const completes = (mark: Mark) => {
    for (const line of LINES) {
      const cells = line.map((i) => board[i]);
      const mine = cells.filter((c) => c === mark).length;
      const empty = cells.filter((c) => c === null).length;
      if (mine === 2 && empty === 1) return line[cells.indexOf(null)];
    }
    return -1;
  };
  const win = completes(me);
  if (win >= 0) return win;
  const block = completes(other(me));
  if (block >= 0) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  const from = corners.length ? corners : open;
  return from[Math.floor(rand() * from.length)];
}

/**
 * How often the bot is right, by how hard the question is. It answers the same
 * questions you do and can be seen getting them wrong, so this is a visible
 * property of the opponent rather than a hidden dice roll on the outcome.
 */
export const BOT_ACCURACY: Record<string, number> = { easy: 0.85, medium: 0.62, hard: 0.4 };
export const botIsRight = (difficulty: string, rand = Math.random) =>
  rand() < (BOT_ACCURACY[difficulty] ?? 0.6);
