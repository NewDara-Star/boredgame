import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { gridBoard } from "./gridBoard";
import { TTT } from "./useTttRoom";
import { gridHero } from "./card";
import type { Cell } from "./rules";

const gridArt = { hero: (g: { board: Cell[]; line: number[] | null }) => gridHero(g.board, g.line) };


/**
 * Solo Square Off. It was the original solo screen and every other one was
 * written against it by hand; this is the last of them to move onto the shared
 * page. Nothing here but which engine it plays and what the marks look like.
 */
export function SquareOffPage() {
  return <BoardSoloPage engine={TTT} title="Square Off" board={gridBoard(Board)}
    glyphs={{ x: "✕", o: "◯" }} art={gridArt} />;
}
