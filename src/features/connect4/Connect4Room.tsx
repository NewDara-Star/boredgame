import { useEffect, useState } from "react";
import type { Challenge, RoomPlayer, RoomStatus } from "@/shared/types/db";
import { TurnPanel } from "@/features/rooms/TurnPanel";
import { Note, Dealing } from "@/shared/ui/Note";
import { askMs, AWAY_MS } from "@/features/play/clock";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink,
  MatchOver, useMatchChrome, useStallRescue,
} from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { BOARD_RATIO } from "@/features/play/BoardSoloPage";
import { PlayBoard, PlayRow, PlaySurface } from "@/features/play/PlaySurface";
import { connect4Art } from "./card";
import { describe, stallWriter, type Mark } from "./rules";
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
  /** what a move costs: a question, or a shot */
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
  const title = plain ? "CONNECT 4" : "CONNECT 4 TRIVIA";

  // One clock, derived from when the question was written, so both screens
  // agree. It runs outside a question too, or the "they have gone" notice never
  // appears on the screen most likely to be stuck — faster while a question is
  // up, because that bar has to look continuous.
  const { now, names, scoreOf, sides, card, done } =
    useMatchChrome(code, title, status, players, t.seats, asking,
      { hero: () => connect4Art(title) });

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.target]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else may step in. stallWriter
  // names exactly one mark at any instant — unit-checked.
  // Both clients derive the deadline from the same puzzle, so they agree
  // without another column to keep in step.
  // A shot has no clock at all — no bar, and no deadline anyone could play
  // against. A timer ticking down while an eight-year-old lines up a catapult
  // is the pressure this mode exists to remove, and the 30s it used to get was
  // a reading-a-question number that a careful child can spend, with nothing on
  // screen to warn them. What is left is only the away deadline, which is not a
  // rule: it is how long before a silent client is assumed to be gone.
  const ask = challenge === "catapult" ? AWAY_MS : askMs(t.item?.difficulty);
  const elapsed = now - t.askedAt;
  const left = ask - elapsed;
  const stall = g && !plain
    ? stallWriter(g, elapsed, { ask, reveal: REVEAL_MS, grace: GRACE_MS })
    : null;
  useStallRescue(stall, t.myMark, t.askedAt, !!t.item, t);

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!t.ready) return <Dealing what="the questions" />;
  if (!g) return <Dealing what="the board" />;

  const other: Mark = g.turn === "x" ? "o" : "x";
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <PlaySurface>
      <PlayRow>
        <Seats
          names={names}
          scores={{ x: scoreOf("x"), o: scoreOf("o") }}
          active={g.phase === "over" ? null : g.turn}
          glyph={() => "●"}
          dimmed={g.phase === "over"} />
      </PlayRow>

      <PlayBoard ratio={BOARD_RATIO.connect4} min={78}>
        {(width) => (
          <Board board={g.board} target={g.target} line={g.line} width={width}
            canPick={g.phase === "picking" && g.turn === t.myMark}
            compact={!plain && (g.phase === "asking" || g.phase === "revealed")}
            onPick={t.choose} />
        )}
      </PlayBoard>

      <PlayRow className="space-y-3">
        <p className="text-center text-[15px] font-bold text-soft">
          {describe(g, names, t.myMark)}
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
      ) : !plain && (g.phase === "asking" || g.phase === "revealed") ? (
        <PlayRow>
        <TurnPanel
          challenge={challenge === "catapult" ? "catapult" : "trivia"}
          item={t.item} options={t.item?.choices ?? []}
          chosen={chosen} setChosen={setChosen}
          onAnswer={(correct: boolean) => t.submit(correct)}
          asking={asking} revealed={revealed} mine={!!mine}
          fraction={Math.max(0, left / ask)} askedAt={t.askedAt}
          waitingOn={names[other]}
          advanceOwner={g.phase === "revealed" && g.last ? g.last.by : null}
          stall={stall} myMark={t.myMark}
          onAdvanceNow={t.advanceNow} onForceAdvance={t.forceAdvance}
          nextLabel="Next" />
        </PlayRow>
      ) : null}
    </PlaySurface>
  );
}
