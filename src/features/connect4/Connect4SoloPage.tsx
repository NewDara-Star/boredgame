import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { C4 } from "./useC4Room";

/** Plain Connect 4 against the bot: tap a column, the disc falls. */
export function Connect4SoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4" Board={Board}
    glyphs={{ x: "●", o: "●" }} plain />;
}

/** The trivia version: name a column, then answer for it. A miss costs the
    turn and nothing else — the bot does not get a shot at your column. */
export function Connect4TriviaSoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4 Trivia" Board={Board}
    glyphs={{ x: "●", o: "●" }} />;
}

/** The same board, with the question replaced by a shot. Built for a player who
    loses a general-knowledge question to an adult whatever the setting says. */
export function Connect4CatapultSoloPage() {
  return <BoardSoloPage engine={C4} title="Connect 4 Catapult" Board={Board}
    glyphs={{ x: "●", o: "●" }} challenge="catapult" />;
}
