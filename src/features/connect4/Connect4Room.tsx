import type { ReactNode } from "react";
import { BankTrouble } from "@/features/rooms/BankTrouble";
import { ownersFor } from "@/features/play/board";
import { useEffect, useState } from "react";
import { BoardRoomBody } from "@/features/rooms/RoomBoard";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { isShot, SHOT_MS, type Challenge } from "@/features/challenge/kinds";
import { Dealing } from "@/shared/ui/Note";
import { askMs } from "@/features/play/clock";
import {
  MatchOver, useMatchChrome, useStallRescue,
} from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { BOARD_RATIO } from "@/features/play/BoardSoloPage";
import { c4Hero } from "./card";
import { describe, stallWriter, columnName, type Mark } from "./rules";
import { useC4Room } from "./useC4Room";

/** How long after a deadline passes before the other player may take over. */
const GRACE_MS = 6000;
/** When a reveal counts as stuck. Must stay above the longest pause in
    useC4Room (2900ms) or the rescue races the timer it exists to back up. */
const REVEAL_MS = 4500;

export function Connect4Room({
  top, roomId, code, status, categories, difficulty, challenge, players, userId, plain,
}: {
  /** the room's top bar (code, call) and its notices */
  top?: ReactNode;
  roomId: number; code: string; status: RoomStatus;
  categories: string[] | null; difficulty: string[] | null;
  /** what a move costs (Play it with): a question, a shot, or Mix */
  challenge: Challenge;
  players: RoomPlayer[]; userId: string;
  /** Plain Connect 4 drops on tap. Otherwise a column costs a right answer. */
  plain: boolean;
}) {
  const t = useC4Room(roomId, userId, { categories, difficulty }, plain, challenge);
  const [chosen, setChosen] = useState<string | null>(null);

  const g = t.game;
  const asking = g?.phase === "asking";
  const title = plain || challenge !== "trivia" ? "CONNECT 4" : "CONNECT 4 TRIVIA";

  // One clock, derived from when the question was written, so both screens
  // agree. It runs outside a question too, or the "they have gone" notice never
  // appears on the screen most likely to be stuck — faster while a question is
  // up, because that bar has to look continuous.
  const { now, names, scoreOf, sides, card, done } =
    useMatchChrome(code, title, status, players, t.seats, asking,
      { hero: () => c4Hero(t.game?.board, t.game?.line), me: t.myMark });

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.target]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else may step in. stallWriter
  // names exactly one mark at any instant — unit-checked.
  // Both clients derive the deadline from the same puzzle, so they agree
  // without another column to keep in step.
  // A shot has 30 seconds (Daramola, 26 Sep), the bar on its sheet; a
  // question keeps its own clock.
  const shotTurn = !!t.kind && isShot(t.kind);
  const ask = shotTurn ? SHOT_MS : askMs(t.item?.difficulty);
  const elapsed = now - t.askedAt;
  const left = ask - elapsed;
  const stall = g && !plain
    ? stallWriter(g, elapsed, { ask, reveal: REVEAL_MS + (shotTurn ? t.flightMs : 0), grace: GRACE_MS })
    : null;
  // A ball in the air at the buzzer still lands: this phone doesn't time
  // itself out mid-flight (the other one waits out the grace first).
  const [flying, setFlying] = useState(false);
  useStallRescue(flying && stall?.mark === t.myMark ? null : stall, t.myMark, t.askedAt, shotTurn || !!t.item, t);

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} roomId={roomId} />;

  if (!t.ready) return t.bankTrouble
    ? <BankTrouble message={t.bankTrouble} onRetry={t.retryBank} />
    : <Dealing what="the questions" />;
  if (!g) return <Dealing what="the board" />;

  // who owes the answer or the shot
  const shooter: Mark = g.turn;

  return (
    <BoardRoomBody top={top} roomId={roomId} userId={userId} players={players} now={now}
      names={names} scores={{ x: scoreOf("x"), o: scoreOf("o") }}
      game={g} myMark={t.myMark} answerer={shooter}
      plain={plain} challenge={challenge} kind={t.kind} play={t.play}
      unit="column" spot={(i) => (i === null ? "" : columnName(i))}
      said={describe(g, names, t.myMark)} youAre={t.myMark === "o" ? "You're blue" : "You're gold"}
      ratio={BOARD_RATIO.connect4}
      board={(width) => (
        <Board owners={ownersFor(names, t.myMark)} board={g.board} target={g.target} line={g.line} width={width}
            canPick={g.phase === "picking" && g.turn === t.myMark}
            onPick={t.choose} />
      )}
      item={t.item} chosen={chosen} setChosen={setChosen}
      fraction={Math.max(0, left / ask)} askedAt={t.askedAt} askedSeed={t.askedSeed}
      stall={stall} error={t.error} shot={t.shot}
      onAnswer={(correct, given) => t.submit(correct, given)}
      onShot={(hit, rec) => t.submitShot(hit, rec)} onFly={setFlying}
      onAdvanceNow={t.advanceNow} onForceAdvance={t.forceAdvance}
      onRematch={() => void t.rematch()} onQuit={() => void t.quit()} onChangeGame={() => void t.changeGame()} />
  );
}
