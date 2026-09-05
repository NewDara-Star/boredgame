import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { scoreOf } from "./rules";
import { MEMORY } from "./useMemoryRoom";
import { memoryArt } from "./card";

/**
 * Memory against the bot. Its recall is a span of the last six tiles it was
 * shown — enough that it plays like someone paying attention, short enough that
 * paying MORE attention beats it.
 *
 * This was hand-written once and shipped with a dead "End session" button,
 * because the shared page owns the session-over screen and a copy of it does
 * not. Both taps of a turn are accepted, which is why the phase rule lives here
 * rather than in the page.
 */
export function MemorySoloPage() {
  return (
    <BoardSoloPage
      engine={MEMORY}
      title="Memory Match"
      challenge="none"
      glyphs={{ x: "◆", o: "●" }}
      art={{ hero: () => memoryArt("MEMORY MATCH") }}
      // Pairs, not games won: it is the number you are playing for.
      score={(g) => ({ x: scoreOf(g, "x"), o: scoreOf(g, "o") })}
      board={({ game, myTurn, width, onPick }) => (
        <Board game={game} width={width}
          canFlip={myTurn && (game.phase === "picking" || game.phase === "asking")}
          onFlip={onPick} />
      )} />
  );
}
