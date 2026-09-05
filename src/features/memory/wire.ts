import { SIZE, newGame, type Cell, type Game, type Mark } from "./rules";

/** The stored row. `line` is derived, so it is not stored. */
export interface MemoryRow {
  room_id: number;
  /** the faces, one digit per tile — dealt once and never changed */
  deck: string;
  /** who owns each tile, or '-' while it is still in play */
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

export function decode(row: MemoryRow): Game {
  return {
    deck: [...row.deck].map((c) => Number(c)),
    board: [...row.board].map((c) => CELLS[c] ?? null),
    turn: row.turn,
    phase: row.phase,
    target: row.target,
    last: row.last,
    winner: row.winner,
    // Painted only when the row agrees a pair was just made, so a match being
    // written does not briefly highlight the wrong two tiles.
    line: row.last?.correct ? [row.last.a, row.last.b] : null,
  };
}

export const encodeBoard = (board: Cell[]) => board.map((c) => c ?? "-").join("");
export const encodeDeck = (deck: number[]) => deck.join("");
export const EMPTY_BOARD = "-".repeat(SIZE);

/**
 * The deck is included even though a move never changes it: dealing happens
 * through newGame(), and both starting a match and starting a rematch write
 * whatever newGame() produced. Writing sixteen unchanged characters on every
 * tap is cheaper than a second code path that only runs twice a game.
 */
export function encode(g: Game): Omit<MemoryRow,
  "room_id" | "puzzle_id" | "x_player" | "o_player" | "updated_at"> {
  return {
    deck: encodeDeck(g.deck),
    board: encodeBoard(g.board),
    turn: g.turn,
    phase: g.phase,
    target: g.target,
    last: g.last,
    winner: g.winner,
  };
}

export { newGame };
