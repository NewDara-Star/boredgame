import type { Challenge, RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink,
  MatchOver, useMatchChrome,
} from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { describe, scoreOf, type Mark } from "./rules";
import { useMemoryRoom } from "./useMemoryRoom";

/**
 * No stall rescue here, and none needed: every phase of a memory turn is
 * written by the player whose turn it is, and the only timed transition is
 * turning two tiles back over — which the reducer will do for whoever is
 * looking, because `advance` from a reveal is the same for both of them.
 */
export function MemoryRoom({
  roomId, code, status, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus;
  challenge?: Challenge;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useMemoryRoom(roomId, userId);
  const g = t.game;
  const { now, names, sides, card, done } =
    useMatchChrome(code, "MEMORY MATCH", status, players, t.seats);

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;
  if (!g) return <Dealing what="the tiles" />;

  const mine = g.turn === t.myMark;

  return (
    <div className="space-y-4">
      <Seats
        names={names}
        scores={{ x: scoreOf(g, "x"), o: scoreOf(g, "o") }}
        active={g.turn}
        dimmed={g.phase === "over"}
        glyph={(m: Mark) => (m === "x" ? "◆" : "●")} />

      <Board game={g} canFlip={mine && (g.phase === "picking" || g.phase === "asking")}
        onFlip={t.choose} />

      <p className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, names, t.myMark)}
      </p>

      <Note>{t.error}</Note>

      <AwayNotice players={players} userId={userId} now={now} />

      {g.phase !== "over" && <EndMatchLink onQuit={() => void t.quit()} />}

      {g.phase === "over" && (
        <OverPanel
          headline={g.winner === "draw" ? "All square"
            : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          mine={g.winner === t.myMark}
          draw={g.winner === "draw"}
          onRematch={() => void t.rematch()}
          onQuit={() => void t.quit()}
          onChangeGame={() => void t.changeGame()} />
      )}
    </div>
  );
}
