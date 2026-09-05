import { useEffect, useState } from "react";
import type { Challenge, RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import { TurnPanel } from "@/features/rooms/TurnPanel";
import { Board } from "./Board";
import { describe, stallWriter, type Mark } from "./rules";
import { useTttRoom } from "./useTttRoom";
import { askMs } from "@/features/play/clock";

/** Long enough to line a shot up without a clock in your face. */
const CATAPULT_ASK_MS = 30_000;
import {
  Seats, AwayNotice, OverPanel, EndMatchLink,
  MatchOver, useMatchChrome, useStallRescue,
} from "@/features/rooms/matchUi";

/** How long after a deadline passes before the other player takes over. Long
    enough that a slow network is not mistaken for someone leaving. */
const GRACE_MS = 6000;
/** When a reveal is considered stuck. Must sit above the longest pause in
    useTttRoom (2900ms) or this races the timer it exists to back up. */
const REVEAL_MS = 4500;

export function SquareOffRoom({
  roomId, code, status, categories, difficulty, challenge, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus;
  categories: string[] | null; difficulty: string[] | null;
  /** what a move costs: a question, or a shot */
  challenge: Challenge;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useTttRoom(roomId, userId, { categories, difficulty }, false, challenge);
  const [chosen, setChosen] = useState<string | null>(null);

  const g = t.game;
  const asking = g?.phase === "asking";
  const mine = asking && g.answerer === t.myMark;

  // One clock, derived from when the question was written, so both screens agree.
  // It runs outside a question too, or the "they have gone" notice never appears
  // on the screen most likely to be stuck — faster while a question is up,
  // because that bar has to look continuous.
  const { now, names, scoreOf, sides, card, done } =
    useMatchChrome(code, "SQUARE OFF", status, players, t.seats, asking);

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.target]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else is allowed to step in.
  // stallWriter names exactly one mark at any instant — unit-checked. The
  // reveal case is the one that actually bit: its pause is a setTimeout in the
  // answerer's tab, which a phone suspends the moment the screen locks.
  // Both clients derive the deadline from the same puzzle, so they agree
  // without another column to keep in step.
  // A shot gets longer than a question and no countdown bar: a timer ticking
  // down while an eight-year-old lines up a catapult is the pressure this mode
  // exists to remove. The deadline stays only so an idle player cannot freeze
  // the board — stallWriter still needs one.
  const ask = challenge === "catapult" ? CATAPULT_ASK_MS : askMs(t.item?.difficulty);
  const elapsed = now - t.askedAt;
  const left = ask - elapsed;
  const stall = g ? stallWriter(g, elapsed, { ask, reveal: REVEAL_MS, grace: GRACE_MS }) : null;
  useStallRescue(stall, t.myMark, t.askedAt, !!t.item, t);

  // The result card is drawn as soon as the match ends and shown on screen, not
  // hidden behind a download. A file you have to save before you can look at it
  // is a file most people never see — and `<a download>` is unreliable on iOS
  // anyway, where the image opens instead of saving. On screen you can always
  // long-press it. useMatchChrome owns the redraw rules.

  // Quitting ends the session, not the game — the tally survives the rematches
  // that came before it, which is the only reason to keep score at all.
  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!t.ready) return <Dealing what="the questions" />;

  if (!g) return <Dealing what="the board" />;

  const other: Mark = (g.answerer ?? g.turn) === "x" ? "o" : "x";
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <div className="space-y-4">
      <Seats
        names={names}
        scores={{ x: scoreOf("x"), o: scoreOf("o") }}
        active={g.phase === "asking" ? g.answerer : g.turn}
        dimmed={g.phase === "over"}
        glyph={(m: Mark) => (m === "x" ? "✕" : "◯")} />

      <Board board={g.board} target={g.target} line={g.line}
        canPick={g.phase === "picking" && g.turn === t.myMark}
        compact={g.phase === "asking" || g.phase === "revealed"}
        onPick={t.choose} />

      <p className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, names, t.myMark)}
      </p>

      {/* A room that cannot serve a question is broken, and saying so beats a
          board that never advances. */}
      <Note>{t.error}</Note>

      <AwayNotice players={players} userId={userId} now={now} />

      {g.phase !== "over" && <EndMatchLink onQuit={() => void t.quit()} />}

      {g.phase === "over" ? (
        <OverPanel
          headline={g.winner === "draw" ? "Draw"
            : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          mine={g.winner === t.myMark}
          draw={g.winner === "draw"}
          onRematch={() => void t.rematch()}
          onQuit={() => void t.quit()}
          onChangeGame={() => void t.changeGame()} />
      ) : (g.phase === "asking" || g.phase === "revealed") ? (
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
      ) : null}
    </div>
  );
}
