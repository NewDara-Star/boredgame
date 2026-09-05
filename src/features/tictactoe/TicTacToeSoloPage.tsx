import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "@/features/squareoff/Board";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { TTT } from "@/features/squareoff/useTttRoom";
import { gridHero } from "@/features/squareoff/card";
import type { Cell } from "@/features/squareoff/rules";

const gridArt = { hero: (g: { board: Cell[]; line: number[] | null }) => gridHero(g.board, g.line) };


/** Plain Tic Tac Toe against the bot. Same board and same reducer as Square
    Off with the questions switched off — see useBoardRoom. */
export function TicTacToeSoloPage() {
  return <BoardSoloPage engine={TTT} title="Tic Tac Toe" board={gridBoard(Board)}
    glyphs={{ x: "✕", o: "◯" }} plain art={gridArt} />;
}
