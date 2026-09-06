import {
  other, speaker, stallWriter as stall,
  type Mark, type Cell, type Stall,
} from "../play/board.ts";

export { other, type Mark, type Cell, type Stall };

/**
 * Square Off — tic-tac-toe where a square costs a right answer.
 *
 *   X picks a square, X answers
 *     correct -> X claims it
 *     wrong   -> the square stays open
 *   ...either way, the next pick is O's.
 *
 * A miss costs you your turn and nothing else. It used to hand the square to
 * your opponent for a free attempt — the "steal" — and that was a mistake for
 * a reason that has nothing to do with balance: the opponent did not have to
 * SPOT the opening, the game handed it to them. A windfall neither player
 * earned is not tension, and against a much stronger player it compounds,
 * because they convert your misses and you do not convert theirs. The drama it
 * was supposed to create survives without it: miss the winning square and it
 * stays open, and your opponent can go for it next turn — but they have to
 * spend their own turn and make their own shot.
 *
 * Every function here is pure — the solo game and the two-player room run the
 * same reducer, which is the only way the rules can be guaranteed to match on
 * both sides of a network.
 */

export type Phase = "picking" | "asking" | "revealed" | "over";

export interface Game {
  board: Cell[];
  turn: Mark;
  phase: Phase;
  /** the square currently being contested */
  target: number | null;
  /** who owes an answer right now — always whoever's turn it is */
  answerer: Mark | null;
  /** what the last answer did, so the UI can say so before play moves on */
  last: { by: Mark; square: number; correct: boolean } | null;
  winner: Mark | "draw" | null;
  line: number[] | null;
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];


export const newGame = (first: Mark = "x"): Game => ({
  board: Array(9).fill(null),
  turn: first,
  phase: "picking",
  target: null,
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
  return { ...g, phase: "asking", target: square, answerer: g.turn, last: null };
}

/** Resolve the pending question. Claiming can end the game outright. */
export function answer(g: Game, correct: boolean): Game {
  if (g.phase !== "asking" || g.target === null || !g.answerer) return g;
  const by = g.answerer;
  const last = { by, square: g.target, correct };
  // answerer is cleared on the way out of `asking` because it means "who owes
  // the pending answer", and once the answer is in, nobody does. decode() has
  // always derived it from the phase, so the stored game already agreed; it was
  // only the reducer's own output that carried a stale mark through `revealed`,
  // where every reader happens to be guarded by the phase anyway. Two versions
  // of the truth with nothing currently standing on the wrong one.
  if (!correct) return { ...g, phase: "revealed", answerer: null, last };

  const board = g.board.slice();
  board[g.target] = by;
  // A finished square is claimed, not contested — leaving `target` set paints the
  // winning square as "in play" instead of as part of the winning line.
  const done = { ...g, board, phase: "over" as const, target: null, answerer: null, last };
  const win = winnerOf(board);
  if (win) return { ...done, winner: win.mark, line: win.line };
  if (openSquares(board).length === 0) return { ...done, winner: "draw" as const };
  // A claimed square is not contested -- clear `target` here too (matching the
  // win/draw branch) so the just-taken square stops pulsing as "in play" through
  // the reveal pause.
  return { ...g, board, phase: "revealed", target: null, answerer: null, last };
}

/**
 * Plain Tic Tac Toe: take a square, no question attached.
 *
 * It lives here rather than in its own module so that both games share one win
 * test. A separate file would have to import this one, and every rules module
 * in this project must stay runnable by bare Node for the check scripts —
 * which rules out cross-module imports, which would leave only duplication.
 * Two boards disagreeing about what counts as three in a row is precisely the
 * bug nobody finds until someone is staring at an unfinished winning line.
 */
export function place(g: Game, square: number): Game {
  if (g.phase !== "picking") return g;
  if (square < 0 || square > 8 || g.board[square] !== null) return g;

  const board = g.board.slice();
  board[square] = g.turn;
  const last = { by: g.turn, square, correct: true };

  const win = winnerOf(board);
  if (win) return { ...g, board, phase: "over", target: null, answerer: null, last, winner: win.mark, line: win.line };
  if (openSquares(board).length === 0)
    return { ...g, board, phase: "over", target: null, answerer: null, last, winner: "draw" as const };
  return { ...g, board, turn: other(g.turn), last: null };
}

/**
 * Move on from a resolved question, to the other player's pick.
 *
 * Unconditional. Advancing never asks again — the branch that used to arm the
 * steal here was the only way a phase could go backwards from `revealed` into
 * `asking`, and check-engines.mts now holds every game to that.
 */
export function advance(g: Game): Game {
  if (g.phase !== "revealed" || !g.last) return g;
  return {
    ...g, phase: "picking", turn: other(g.turn),
    target: null, answerer: null, last: null,
  };
}

/**
 * One line of English for whatever just happened; the board alone is not
 * legible. `you` is the mark the reader is playing, so the same rules engine
 * writes "You miss" for one player and "Dara misses" for the other watching the
 * same room — one sentence, conjugated, rather than two copies of the logic.
 */
export function describe(g: Game, names: Record<Mark, string>, you: Mark | null = null): string {
  const { mine: second, who, verb: s } = speaker(names, you);
  const sq = (n: number) => `square ${n + 1}`;

  if (g.phase === "over") {
    if (g.winner === "draw") return "Board full — it's a draw.";
    const m = g.winner as Mark;
    return second(m) ? "You win." : `${names[m]} wins.`;
  }
  if (g.phase === "revealed" && g.last) {
    const { by, square, correct } = g.last;
    if (correct) return `${who(by)} ${s(by, "take")} ${sq(square)}.`;
    return `${who(by)} ${s(by, "miss")} — ${sq(square)} stays open.`;
  }
  if (g.phase === "asking" && g.answerer) {
    const m = g.answerer;
    const target = sq(g.target ?? 0);
    return second(m) ? `You're going for ${target}.` : `${names[m]} is going for ${target}.`;
  }
  return second(g.turn) ? "Your pick — take a square." : `${names[g.turn]} is picking.`;
}

/* ------------------------------------------------------- abandonment */

/** What a stalled board needs, and which client owes it. */

/**
 * Who should unstick a board that has stopped moving, and how.
 *
 * Every transition is written by exactly one client — the one that owes the
 * action — because two browsers racing to write the same transition makes the
 * round jump. The cost of that rule is that a player who goes away takes their
 * half of the game with them, so each phase needs a deadline after which the
 * other player is allowed to write it instead.
 *
 * Two ways a board stops:
 *
 *   asking   — nobody answered. The answerer's own clock expires at askMs;
 *              after a further grace the opponent writes the miss.
 *   revealed — nobody moved on. The pause after an answer is a setTimeout in
 *              the answerer's tab, and a locked phone or an app switch
 *              suspends it. That froze the board with no way out for either
 *              side: the opponent is not allowed to advance, and there is
 *              nothing else running. Same shape as above — the answerer gets
 *              revealMs, then the opponent takes it.
 *
 * revealMs must sit above the longest reveal pause, or this races the timer it
 * exists to back up. Exactly one mark is named at any instant, either way.
 */
export function stallWriter(
  g: Pick<Game, "phase" | "answerer" | "last">,
  elapsed: number,
  ms: { ask: number; reveal: number; grace: number },
): Stall | null {
  return stall(g, g.phase === "asking" ? g.answerer : null, elapsed, ms);
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
