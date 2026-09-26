import { BankTrouble } from "@/features/rooms/BankTrouble";
import { ownersFor } from "@/features/play/board";
import { useEffect, useState } from "react";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { challengeName, isShot, levelOf, SHOT_MS, type Challenge } from "@/features/challenge/kinds";
import { RoomShot } from "@/features/challenge/RoomShot";
import { TurnPanel } from "@/features/rooms/TurnPanel";
import { Note, Dealing } from "@/shared/ui/Note";
import { askMs } from "@/features/play/clock";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink,
  MatchOver, useMatchChrome, useStallRescue,
} from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { BOARD_RATIO } from "@/features/play/BoardSoloPage";
import { PlayBoard, PlayRow, PlaySurface } from "@/features/play/PlaySurface";
import { c4Hero } from "./card";
import { describe, stallWriter, columnName, type Mark } from "./rules";
import { useC4Room } from "./useC4Room";

/** How long after a deadline passes before the other player may take over. */
const GRACE_MS = 6000;
/** When a reveal counts as stuck. Must stay above the longest pause in
    useC4Room (2900ms) or the rescue races the timer it exists to back up. */
const REVEAL_MS = 4500;

export function Connect4Room({
  roomId, code, status, categories, difficulty, challenge, players, userId, plain,
}: {
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
  const mine = asking && g.turn === t.myMark;
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

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!t.ready) return t.bankTrouble
    ? <BankTrouble message={t.bankTrouble} onRetry={t.retryBank} />
    : <Dealing what="the questions" />;
  if (!g) return <Dealing what="the board" />;

  const other: Mark = g.turn === "x" ? "o" : "x";
  const revealed = g.phase === "revealed" || g.phase === "over";
  // who owes the shot, and each seat's shot level where shots are in play
  const shooter: Mark = g.turn;
  const shots = challenge !== "trivia" && challenge !== "none";
  const tags = shots ? { x: levelOf(t.play, "x") === "easy" ? "Easy shots" : null, o: levelOf(t.play, "o") === "easy" ? "Easy shots" : null } : undefined;

  return (
    <PlaySurface>
      <PlayRow>
        <Seats
          names={names}
          scores={{ x: scoreOf("x"), o: scoreOf("o") }}
          tags={tags}
          active={g.phase === "over" ? null : g.turn}
          glyph={() => "disc"}
          dimmed={g.phase === "over"} />
      </PlayRow>

      <PlayBoard ratio={BOARD_RATIO.connect4} min={78}>
        {(width) => (
          <Board owners={ownersFor(names, t.myMark)} board={g.board} target={g.target} line={g.line} width={width}
            canPick={g.phase === "picking" && g.turn === t.myMark}
            compact={!plain && (g.phase === "asking" || g.phase === "revealed")}
            onPick={t.choose} />
        )}
      </PlayBoard>

      <PlayRow className="space-y-3">
        <p className="text-center text-[15px] font-bold text-soft">
          {describe(g, names, t.myMark)}
          {/* Mix names the turn's challenge before the pick, so it's never a surprise. */}
          {challenge === "mix" && g.phase === "picking" && t.kind && ` This one's ${challengeName(t.kind).toLowerCase()}.`}
        </p>

        <Note>{t.error}</Note>

        <AwayNotice players={players} userId={userId} now={now} />

        {g.phase === "picking" && <EndMatchLink onQuit={() => void t.quit()} />}
      </PlayRow>

      {g.phase === "over" ? (
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
      ) : !plain && !shotTurn && (g.phase === "asking" || g.phase === "revealed") ? (
        <PlayRow>
        <TurnPanel
          challenge="trivia"
          item={t.item} options={t.item?.choices ?? []}
          chosen={chosen} setChosen={setChosen}
          onAnswer={(correct: boolean, given?: string) => t.submit(correct, given)}
          asking={asking} revealed={revealed} mine={!!mine}
          fraction={Math.max(0, left / ask)} askedAt={t.askedSeed}
          waitingOn={names[other]}
          advanceOwner={g.phase === "revealed" && g.last ? g.last.by : null}
          stall={stall} myMark={t.myMark}
          onAdvanceNow={t.advanceNow} onForceAdvance={t.forceAdvance}
          nextLabel="Next" />
        </PlayRow>
      ) : null}

      {/* A shot takes the whole phone on both screens: the thrower's sheet, and
          the same scene on the other phone, which plays the throw back. */}
      {shotTurn && t.kind && isShot(t.kind) && (
        <RoomShot active={g.phase === "asking"} kind={t.kind} seed={t.askedSeed}
          level={levelOf(t.play, shooter)} by={shooter} myMark={t.myMark} names={names}
          board={g.board} target={g.target} spot={(i) => (i === null ? "" : columnName(i))}
          askedAt={t.askedAt} now={now} flight={t.shot}
          onSettle={(hit, rec) => t.submitShot(hit, rec)} onFly={setFlying} />
      )}
    </PlaySurface>
  );
}
