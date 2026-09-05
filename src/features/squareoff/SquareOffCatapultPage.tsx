import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { gridBoard } from "./gridBoard";
import { TTT } from "./useTttRoom";
import { gridHero } from "./card";
import type { Cell } from "./rules";

const gridArt = { hero: (g: { board: Cell[]; line: number[] | null }) => gridHero(g.board, g.line) };


/** Square Off with a catapult instead of a question: land the shot, claim the
    square. Miss and the square stays open — they can go for it next turn, but
    they have to spend their own turn on it. */
export function SquareOffCatapultPage() {
  return <BoardSoloPage engine={TTT} title="Catapult Squares" board={gridBoard(Board)}
    glyphs={{ x: "✕", o: "◯" }} challenge="catapult" art={gridArt} />;
}
