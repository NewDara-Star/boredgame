import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import { Board } from "@/features/squareoff/Board";
import { describe, type Mark } from "@/features/squareoff/rules";
import { TIC_TAC_TOE_ART } from "@/features/squareoff/card";
import { useTttRoom } from "@/features/squareoff/useTttRoom";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink, MatchOver, useMatchChrome,
} from "@/features/rooms/matchUi";
import { PlayBoard, PlayRow, PlaySurface } from "@/features/play/PlaySurface";

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
    useMatchChrome(code, "TIC TAC TOE", status, players, t.seats, false,
      { hero: () => TIC_TAC_TOE_ART });

  const g = t.game;

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!g) return <Dealing what="the board" />;


  return (
    <PlaySurface>
      <PlayRow>
        <Seats
          names={names}
          scores={{ x: scoreOf("x"), o: scoreOf("o") }}
          active={g.phase === "over" ? null : g.turn}
          glyph={(m) => (m === "x" ? "✕" : "◯")}
          dimmed={g.phase === "over"} />
      </PlayRow>

      <PlayBoard min={78}>
        {(width) => (
          <Board board={g.board} target={null} line={g.line} width={width}
            canPick={g.phase === "picking" && g.turn === t.myMark}
            onPick={t.choose} />
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
          headline={g.winner === "draw" ? "Draw"
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
