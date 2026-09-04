import { COLS, ROWS, SIZE, winnerOf, type Cell, type Game, type Mark } from "./rules";

/** The database row. `line` is derived from the board, so it is not stored. */
export interface C4Row {
  room_id: number;
  board: string;
  turn: Mark;
  phase: Game["phase"];
  target: number | null;
  last: Game["last"];
  winner: Mark | "draw" | null;
  puzzle_id: number | null;
  x_player: string | null;
  o_player: string | null;
  updated_at: string;
}

const CELLS: Record<string, Cell> = { x: "x", o: "o", "-": null };

export function decode(row: C4Row): Game {
  const board = [...row.board].map((c) => CELLS[c] ?? null);
  const win = winnerOf(board);
  return {
    board,
    turn: row.turn,
    phase: row.phase,
    target: row.target,
    last: row.last,
    winner: row.winner,
    // Only paint a winning line when the row agrees the game is won. A board
    // can momentarily contain four in a row mid-write; the stored winner is
    // what settles it.
    line: win && row.winner && row.winner !== "draw" ? win.line : null,
  };
}

export const encodeBoard = (board: Cell[]) => board.map((c) => c ?? "-").join("");

export const EMPTY_BOARD = "-".repeat(SIZE);

/** Only the fields a move can change — never the whole row, never the players. */
export function encode(g: Game): Omit<C4Row, "room_id" | "puzzle_id" | "x_player" | "o_player" | "updated_at"> {
  return {
    board: encodeBoard(g.board),
    turn: g.turn,
    phase: g.phase,
    target: g.target,
    last: g.last,
    winner: g.winner,
  };
}

export { COLS, ROWS };
