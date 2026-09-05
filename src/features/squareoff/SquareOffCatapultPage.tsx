import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { TTT } from "./useTttRoom";

/** Square Off with a catapult instead of a question: land the shot, claim the
    square. Miss, and your opponent gets one go at it — the steal is in the
    reducer, so it works the same whatever the challenge is. */
export function SquareOffCatapultPage() {
  return <BoardSoloPage engine={TTT} title="Catapult Squares" Board={Board}
    glyphs={{ x: "✕", o: "◯" }} challenge="catapult" />;
}
