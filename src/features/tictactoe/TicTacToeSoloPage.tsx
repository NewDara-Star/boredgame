import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "@/features/squareoff/Board";
import { TTT } from "@/features/squareoff/useTttRoom";

/** Plain Tic Tac Toe against the bot. Same board and same reducer as Square
    Off with the questions switched off — see useBoardRoom. */
export function TicTacToeSoloPage() {
  return <BoardSoloPage engine={TTT} title="Tic Tac Toe" Board={Board}
    glyphs={{ x: "✕", o: "◯" }} plain />;
}
