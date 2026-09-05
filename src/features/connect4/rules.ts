import {
  other, speaker, stallWriter as stall,
  type Mark, type Cell, type Stall,
} from "../play/board.ts";

/**
 * Connect 4 — the grid, gravity and the win test, as pure functions.
 *
 * Two games are built on this file. Plain Connect 4 drops a disc when you tap a
 * column. Connect 4 Trivia makes the drop cost a right answer: you name a
 * column, you get a question, and a miss costs you the turn without placing
 * anything. A miss costs the turn and nothing else — Square Off worked the
 * other way once and no longer does, so this is now simply the rule, and
 * Connect 4 punishes a lost tempo hard enough on its own.
 *
 * Index layout: row 0 is the TOP row, so index = row * COLS + col and a disc
 * falls to the largest empty row. Storing it the other way up reads naturally
 * in code and then renders upside down, which is a bug waiting to happen.
 */

export const COLS = 7;
export const ROWS = 6;
export const SIZE = COLS * ROWS;

export { other, speaker, type Mark, type Cell, type Stall };
export type Phase = "picking" | "asking" | "revealed" | "over";

export interface Game {
  board: Cell[];
  /** whose move it is */
  turn: Mark;
  phase: Phase;
  /** the column under question, trivia mode only */
  target: number | null;
  /** what the last answer did, so the UI can narrate before play moves on */
  last: { by: Mark; col: number; correct: boolean } | null;
  winner: Mark | "draw" | null;
  /** the four indices that won it, for the celebration */
  line: number[] | null;
}


export const newGame = (first: Mark = "x"): Game => ({
  board: Array(SIZE).fill(null),
  turn: first,
  phase: "picking",
  target: null,
  last: null,
  winner: null,
  line: null,
});

export const at = (board: Cell[], row: number, col: number): Cell =>
  row < 0 || row >= ROWS || col < 0 || col >= COLS ? null : board[row * COLS + col];

/** The row a disc dropped into this column would land on, or -1 if it is full. */
export function landingRow(board: Cell[], col: number): number {
  if (col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === null) return r;
  return -1;
}

export const openColumns = (board: Cell[]) =>
  Array.from({ length: COLS }, (_, c) => c).filter((c) => landingRow(board, c) >= 0);

export const boardFull = (board: Cell[]) => openColumns(board).length === 0;

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

/** First four-in-a-row found, with the indices that make it up. */
export function winnerOf(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const mark = at(board, r, c);
      if (!mark) continue;
      for (const [dr, dc] of DIRS) {
        const line = [r * COLS + c];
        for (let k = 1; k < 4; k++) {
          if (at(board, r + dr * k, c + dc * k) !== mark) break;
          line.push((r + dr * k) * COLS + (c + dc * k));
        }
        if (line.length === 4) return { mark, line };
      }
    }
  }
  return null;
}

/** Settle a board that has just had a disc added to it. */
function settle(g: Game, board: Cell[], last: Game["last"]): Game {
  const win = winnerOf(board);
  if (win) return { ...g, board, phase: "over", target: null, last, winner: win.mark, line: win.line };
  if (boardFull(board)) return { ...g, board, phase: "over", target: null, last, winner: "draw", line: null };
  return { ...g, board, last };
}

/* ------------------------------------------------------- plain Connect 4 */

/** Tap a column, the disc falls. Turn passes unless the game just ended. */
export function drop(g: Game, col: number): Game {
  if (g.phase !== "picking") return g;
  const row = landingRow(g.board, col);
  if (row < 0) return g;
  const board = g.board.slice();
  board[row * COLS + col] = g.turn;
  const next = settle(g, board, { by: g.turn, col, correct: true });
  return next.phase === "over" ? next : { ...next, turn: other(g.turn), last: null };
}

/* ------------------------------------------------------ Connect 4 Trivia */

/** Name the column you are going for. The question comes after, not before. */
export function pick(g: Game, col: number): Game {
  if (g.phase !== "picking" || landingRow(g.board, col) < 0) return g;
  return { ...g, phase: "asking", target: col, last: null };
}

/**
 * Resolve the pending question. Right, and the disc drops; wrong, and nothing
 * is placed. Either way the turn will pass — a miss costs the move itself,
 * which in Connect 4 is expensive enough without handing over a free attempt.
 */
export function answer(g: Game, correct: boolean): Game {
  if (g.phase !== "asking" || g.target === null) return g;
  const col = g.target;
  const last = { by: g.turn, col, correct };
  if (!correct) return { ...g, phase: "revealed", last };

  const row = landingRow(g.board, col);
  if (row < 0) return { ...g, phase: "revealed", last: { ...last, correct: false } };
  const board = g.board.slice();
  board[row * COLS + col] = g.turn;
  const next = settle(g, board, last);
  return next.phase === "over" ? next : { ...next, phase: "revealed" };
}

/** Move on from a resolved question. The turn always passes. */
export function advance(g: Game): Game {
  if (g.phase !== "revealed" || !g.last) return g;
  return { ...g, phase: "picking", turn: other(g.turn), target: null, last: null };
}

/* -------------------------------------------------------------- the bot */

/**
 * Win, else block, else prefer the middle. Centre columns sit on more possible
 * fours than the edges do, so weighting them is most of what casual play needs
 * without turning the opponent into a solved wall.
 */
export function botColumn(board: Cell[], me: Mark, rand = Math.random): number {
  const open = openColumns(board);
  if (open.length === 0) return -1;

  const completes = (mark: Mark) => {
    for (const c of open) {
      const r = landingRow(board, c);
      const trial = board.slice();
      trial[r * COLS + c] = mark;
      if (winnerOf(trial)?.mark === mark) return c;
    }
    return -1;
  };
  const win = completes(me);
  if (win >= 0) return win;
  const block = completes(other(me));
  if (block >= 0) return block;

  // Weight by closeness to the centre column, then pick among the best.
  const score = (c: number) => COLS - Math.abs(c - (COLS - 1) / 2) * 2;
  const best = Math.max(...open.map(score));
  const top = open.filter((c) => score(c) === best);
  return top[Math.floor(rand() * top.length)];
}

/* ------------------------------------------------------------ narration */

export function describe(g: Game, names: Record<Mark, string>, you: Mark | null = null): string {
  const { mine, who, verb: s } = speaker(names, you);
  const col = (n: number) => `column ${n + 1}`;

  if (g.phase === "over") {
    if (g.winner === "draw") return "Board full — it's a draw.";
    const m = g.winner as Mark;
    return mine(m) ? "You win." : `${names[m]} wins.`;
  }
  if (g.phase === "revealed" && g.last) {
    const { by, col: c, correct } = g.last;
    return correct
      ? `${who(by)} ${s(by, "drop")} into ${col(c)}.`
      : `${who(by)} ${s(by, "miss")} — nothing lands in ${col(c)}.`;
  }
  if (g.phase === "asking" && g.target !== null) {
    return mine(g.turn) ? `You're going for ${col(g.target)}.` : `${names[g.turn]} is going for ${col(g.target)}.`;
  }
  return mine(g.turn) ? "Your move — pick a column." : `${names[g.turn]} is choosing.`;
}

/* ---------------------------------------------------------- abandonment */

/**
 * Same shape as Square Off's stallWriter, and for the same reason: every
 * transition is written by one client, so each phase needs a deadline after
 * which the other player may write it instead. See CLAUDE.md.
 */

export function stallWriter(
  g: Pick<Game, "phase" | "turn" | "last">,
  elapsed: number,
  ms: { ask: number; reveal: number; grace: number },
): Stall | null {
  // A pending answer is always owed by whoever's turn it is.
  return stall(g, g.phase === "asking" ? g.turn : null, elapsed, ms);
}
