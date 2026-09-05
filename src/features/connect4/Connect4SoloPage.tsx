import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { Board } from "./Board";
import { C4 } from "./useC4Room";
import { connect4Hero } from "./card";
import type { Cell } from "./rules";

const board = gridBoard(Board);
const glyphs = { x: "●", o: "●" } as const;
const art = { hero: (g: { board: Cell[]; line: number[] | null }) => connect4Hero(g.board, g.line) };

/** Plain Connect 4 against the bot: tap a column, the disc falls. */
export function Connect4SoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4" board={board} glyphs={glyphs} plain art={art} />;
}

/** The trivia version: name a column, then answer for it. A miss costs the
    turn and nothing else — the bot does not get a shot at your column. */
export function Connect4TriviaSoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4 Trivia" board={board} glyphs={glyphs} art={art} />;
}

/** The same board, with the question replaced by a shot. Built for a player who
    loses a general-knowledge question to an adult whatever the setting says. */
export function Connect4CatapultSoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4 Catapult" board={board}
    glyphs={glyphs} challenge="catapult" art={art} />;
}
