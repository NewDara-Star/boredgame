import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "@/features/squareoff/Board";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { TTT } from "@/features/squareoff/useTttRoom";
import { gridHero } from "@/features/squareoff/card";

const art = { hero: (g: { board: NonNullable<Parameters<typeof gridHero>[0]>; line: number[] | null }) => gridHero(g.board, g.line) };


/** Plain Tic Tac Toe against the bot. Same board and same reducer as Square
    Off with the questions switched off — see useBoardRoom. */
export function TicTacToeSoloPage() {
  return <BoardSoloPage engine={TTT} title="Tic Tac Toe" board={gridBoard(Board)}
    glyphs={{ x: "cross", o: "ring" }} plain art={art} />;
}
