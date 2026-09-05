import type { Challenge, RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink,
  MatchOver, useMatchChrome, useStallRescue,
} from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { PlayBoard, PlayRow, PlaySurface } from "@/features/play/PlaySurface";
import { memoryArt } from "./card";
import { describe, scoreOf, stallWriter, type Mark } from "./rules";
import { useMemoryRoom } from "./useMemoryRoom";
import { AWAY_MS } from "@/features/play/clock";

/** How long after a deadline passes before the other player takes over. */
const GRACE_MS = 6000;
/** When a reveal is considered stuck. Must sit above useBoardRoom's pause for
    a bankless game (1200ms) or this races the timer it exists to back up. */
const REVEAL_MS = 4500;
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
    useMatchChrome(code, "MEMORY MATCH", status, players, t.seats, g?.phase === "asking",
      { hero: () => memoryArt("MEMORY MATCH") });

  /**
   * This room used to have no rescue at all, on the reasoning that every phase
   * is written by whoever's turn it is. That is true and it is exactly the
   * problem: `useBoardRoom` guards both the reveal timer and advanceNow on
   * `last.by === myMark`, so the pause that turns two tiles back over lives in
   * one tab, and a locked phone froze the board for both players permanently.
   *
   * There is no clock on looking at a grid, so `ask` here is the away deadline
   * rather than a rule — nothing counts down and nothing is drawn. `true` for
   * haveItem because a memory turn deals no question to wait for.
   */
  const elapsed = now - t.askedAt;
  const stall = g
    ? stallWriter(g, elapsed, { ask: AWAY_MS, reveal: REVEAL_MS, grace: GRACE_MS })
    : null;
  useStallRescue(stall, t.myMark, t.askedAt, true, t);

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;
  if (!g) return <Dealing what="the tiles" />;

  const mine = g.turn === t.myMark;

  return (
    <PlaySurface>
      <PlayRow>
        <Seats
          names={names}
          scores={{ x: scoreOf(g, "x"), o: scoreOf(g, "o") }}
          active={g.turn}
          dimmed={g.phase === "over"}
          glyph={(m: Mark) => (m === "x" ? "◆" : "●")} />
      </PlayRow>

      <PlayBoard min={78}>
        {(width) => (
          <Board game={g} width={width}
            canFlip={mine && (g.phase === "picking" || g.phase === "asking")}
            onFlip={t.choose} />
        )}
      </PlayBoard>

      <PlayRow className="space-y-3">
        <p className="text-center text-[15px] font-bold text-soft">
          {describe(g, names, t.myMark)}
        </p>

        <Note>{t.error}</Note>

        <AwayNotice players={players} userId={userId} now={now} />

        {g.phase !== "over" && <EndMatchLink onQuit={() => void t.quit()} />}
      </PlayRow>

      {g.phase === "over" && (
        <PlayRow>
        <OverPanel
          headline={g.winner === "draw" ? "All square"
            : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          mine={g.winner === t.myMark}
          draw={g.winner === "draw"}
          onRematch={() => void t.rematch()}
          onQuit={() => void t.quit()}
          onChangeGame={() => void t.changeGame()} />
        </PlayRow>
      )}
    </PlaySurface>
  );
}
