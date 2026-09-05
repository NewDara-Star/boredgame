import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "@/features/squareoff/Board";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { TTT } from "@/features/squareoff/useTttRoom";
import { TIC_TAC_TOE_ART } from "@/features/squareoff/card";

const art = { hero: () => TIC_TAC_TOE_ART };


/** Plain Tic Tac Toe against the bot. Same board and same reducer as Square
    Off with the questions switched off — see useBoardRoom. */
export function TicTacToeSoloPage() {
  return <BoardSoloPage engine={TTT} title="Tic Tac Toe" board={gridBoard(Board)}
    glyphs={{ x: "✕", o: "◯" }} plain art={art} />;
}
