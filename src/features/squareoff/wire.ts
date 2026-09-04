import { winnerOf, type Cell, type Game, type Mark } from "./rules";

/** The database row. `line` and `answerer` are derived, so they are not stored. */
export interface TttRow {
  room_id: number;
  board: string;
  turn: Mark;
  phase: Game["phase"];
  target: number | null;
  steal: boolean;
  last: Game["last"];
  winner: Mark | "draw" | null;
  puzzle_id: number | null;
  x_player: string | null;
  o_player: string | null;
  updated_at: string;
}

const CELLS: Record<string, Cell> = { x: "x", o: "o", "-": null };

export function decode(row: TttRow): Game {
  const board = [...row.board].map((c) => CELLS[c] ?? null);
  const win = winnerOf(board);
  return {
    board,
    turn: row.turn,
    phase: row.phase,
    target: row.target,
    steal: row.steal,
    // Whoever owes an answer follows from the phase; storing it as well is one
    // more thing that can disagree with itself.
    answerer: row.phase === "asking"
      ? (row.steal ? (row.turn === "x" ? "o" : "x") : row.turn)
      : null,
    last: row.last,
    winner: row.winner,
    line: win && row.winner && row.winner !== "draw" ? win.line : null,
  };
}

export const encodeBoard = (board: Cell[]) => board.map((c) => c ?? "-").join("");

/** Only the fields a move can change — never the whole row, never the players. */
export function encode(g: Game): Omit<TttRow, "room_id" | "puzzle_id" | "x_player" | "o_player" | "updated_at"> {
  return {
    board: encodeBoard(g.board),
    turn: g.turn,
    phase: g.phase,
    target: g.target,
    steal: g.steal,
    last: g.last,
    winner: g.winner,
  };
}
