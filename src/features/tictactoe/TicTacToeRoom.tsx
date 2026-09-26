import type { ReactNode } from "react";
import { ownersFor } from "@/features/play/board";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Dealing } from "@/shared/ui/Note";
import { Board } from "@/features/squareoff/Board";
import { describe, squareName } from "@/features/squareoff/rules";
import { gridHero } from "@/features/squareoff/card";
import { useTttRoom } from "@/features/squareoff/useTttRoom";
import { MatchOver, useMatchChrome } from "@/features/rooms/matchUi";
import { BoardRoomBody } from "@/features/rooms/RoomBoard";

/**
 * Plain Tic Tac Toe. The board, the reducer and the synced-row hook are all
 * Square Off's, with the questions switched off — there is no asking phase, so
 * no clock, no reveal and nothing that can stall. A player who wanders off just
 * leaves their turn hanging, which the away notice already covers.
 */
export function TicTacToeRoom({
  top, roomId, code, status, players, userId,
}: {
  /** the room's top bar (code, call) and its notices */
  top?: ReactNode;
  roomId: number; code: string; status: RoomStatus;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useTttRoom(roomId, userId, null, true);
  const { now, names, scoreOf, sides, card, done } =
    useMatchChrome(code, "TIC TAC TOE", status, players, t.seats, false,
      { hero: () => gridHero(t.game?.board, t.game?.line), me: t.myMark });

  const g = t.game;

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} roomId={roomId} />;

  if (!g) return <Dealing what="the board" />;


  return (
    <BoardRoomBody top={top} roomId={roomId} userId={userId} players={players} now={now}
      names={names} scores={{ x: scoreOf("x"), o: scoreOf("o") }}
      game={{ ...g, target: null }} myMark={t.myMark} answerer={g.turn}
      plain challenge="none" kind={null} play={null}
      unit="square" spot={(i) => (i === null ? "" : squareName(i))}
      said={describe(g, names, t.myMark)} youAre={t.myMark === "o" ? "You're rings" : "You're crosses"}
      ratio={1}
      board={(width) => (
        <Board owners={ownersFor(names, t.myMark)} board={g.board} target={null} line={g.line} width={width}
          canPick={g.phase === "picking" && g.turn === t.myMark}
          onPick={t.choose} />
      )}
      item={null} chosen={null} setChosen={() => {}}
      fraction={0} askedAt={0} askedSeed={0} stall={null} error={t.error} shot={null}
      onAnswer={() => {}} onShot={() => {}} onFly={() => {}}
      onAdvanceNow={() => {}} onForceAdvance={() => {}}
      onRematch={() => void t.rematch()} onQuit={() => void t.quit()} onChangeGame={() => void t.changeGame()} />
  );
}
