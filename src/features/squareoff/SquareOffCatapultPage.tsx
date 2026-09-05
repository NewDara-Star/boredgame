import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { gridBoard } from "./gridBoard";
import { TTT } from "./useTttRoom";
import { CATAPULT_SQUARES_ART } from "./card";

const art = { hero: () => CATAPULT_SQUARES_ART };


/** Square Off with a catapult instead of a question: land the shot, claim the
    square. Miss and the square stays open — they can go for it next turn, but
    they have to spend their own turn on it. */
export function SquareOffCatapultPage() {
  return <BoardSoloPage engine={TTT} title="Catapult Squares" board={gridBoard(Board)}
    glyphs={{ x: "✕", o: "◯" }} challenge="catapult" art={art} />;
}
