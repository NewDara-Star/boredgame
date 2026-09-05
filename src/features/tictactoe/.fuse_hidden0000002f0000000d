import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Board } from "@/features/squareoff/Board";
import { describe, type Mark } from "@/features/squareoff/rules";
import { useTttRoom } from "@/features/squareoff/useTttRoom";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink, MatchOver, useMatchChrome,
} from "@/features/rooms/matchUi";

/**
 * Plain Tic Tac Toe. The board, the reducer and the synced-row hook are all
 * Square Off's, with the questions switched off — there is no asking phase, so
 * no clock, no reveal and nothing that can stall. A player who wanders off just
 * leaves their turn hanging, which the away notice already covers.
 */
export function TicTacToeRoom({
  roomId, code, status, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useTttRoom(roomId, userId, null, true);
  const { now, names, scoreOf, sides, card, done } =
    useMatchChrome(code, "TIC TAC TOE", status, players, t.seats);

  const g = t.game;

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!g) return <p className="text-sm text-soft font-bold">Dealing the board…</p>;


  return (
    <div className="space-y-4">
      <Seats
        names={names}
        scores={{ x: scoreOf("x"), o: scoreOf("o") }}
        active={g.phase === "over" ? null : g.turn}
        glyph={(m) => (m === "x" ? "✕" : "◯")}
        dimmed={g.phase === "over"} />

      <Board board={g.board} target={null} line={g.line}
        canPick={g.phase === "picking" && g.turn === t.myMark}
        onPick={t.choose} />

      <p className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, names, t.myMark)}
      </p>

      {t.error && (
        <div className="piece bg-bad text-surface p-3.5 text-center">
          <p className="text-[13px] font-bold">{t.error}</p>
        </div>
      )}

      <AwayNotice players={players} userId={userId} now={now} />

      {g.phase !== "over" && <EndMatchLink onQuit={() => void t.quit()} />}

      {g.phase === "over" && (
        <OverPanel
          headline={g.winner === "draw" ? "Draw"
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
