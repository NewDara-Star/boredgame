import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "./Board";
import { scoreOf, faceUp, FACES } from "./rules";
import { MEMORY } from "./useMemoryRoom";
import { memoryHero } from "./card";

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
      youAre="Turn a tile over"
      counting="pairs"
      // #29: one tile up and yours to match: "Pick one more / Is there another heart?"
      banner={(g, mine) => {
        if (g.phase !== "asking") return null;
        const up = faceUp(g)[0];
        const face = up === undefined ? null : FACES[g.deck[up]];
        return mine ? { title: "Pick one more", sub: face ? `Is there another ${face}?` : undefined }
          : { title: "The bot's looking", sub: face ? `For another ${face}` : undefined };
      }}
      glyphs={{ x: "tile", o: "disc" }}
      art={{ hero: (g) => memoryHero(g.board) }}
      // Pairs, not games won: it is the number you are playing for.
      score={(g) => ({ x: scoreOf(g, "x"), o: scoreOf(g, "o") })}
      board={({ game, myTurn, width, onPick }) => (
        <Board game={game} width={width}
          canFlip={myTurn && (game.phase === "picking" || game.phase === "asking")}
          onFlip={onPick} />
      )} />
  );
}
