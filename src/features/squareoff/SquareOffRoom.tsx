import { useEffect, useState } from "react";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Board } from "./Board";
import { QuestionPanel, Timer } from "./QuestionPanel";
import { describe, stallWriter, type Mark } from "./rules";
import { useTttRoom } from "./useTttRoom";
import { ASK_MS } from "./useSquareOff";
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
  roomId, code, status, categories, difficulty, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus;
  categories: string[] | null; difficulty: string[] | null;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useTttRoom(roomId, userId, { categories, difficulty });
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

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.steal]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else is allowed to step in.
  // stallWriter names exactly one mark at any instant — unit-checked. The
  // reveal case is the one that actually bit: its pause is a setTimeout in the
  // answerer's tab, which a phone suspends the moment the screen locks.
  const elapsed = now - t.askedAt;
  const left = ASK_MS - elapsed;
  const stall = g ? stallWriter(g, elapsed, { ask: ASK_MS, reveal: REVEAL_MS, grace: GRACE_MS }) : null;
  useStallRescue(stall, t.myMark, t.askedAt, !!t.item, t);

  // The result card is drawn as soon as the match ends and shown on screen, not
  // hidden behind a download. A file you have to save before you can look at it
  // is a file most people never see — and `<a download>` is unreliable on iOS
  // anyway, where the image opens instead of saving. On screen you can always
  // long-press it. useMatchChrome owns the redraw rules.

  // Quitting ends the session, not the game — the tally survives the rematches
  // that came before it, which is the only reason to keep score at all.
  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} />;

  if (!t.ready) return <p className="text-sm text-soft font-bold">Loading questions…</p>;

  if (!g) return <p className="text-sm text-soft font-bold">Dealing the board…</p>;

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
      {t.error && (
        <div className="piece bg-bad text-surface p-3.5 text-center">
          <p className="text-[13px] font-bold">{t.error}</p>
        </div>
      )}

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
      ) : t.item && (g.phase === "asking" || g.phase === "revealed") ? (
        <div className="space-y-3">
          {asking && <Timer fraction={Math.max(0, left / ASK_MS)} />}
          <QuestionPanel
            // Already permuted by loadContent, seeded on the puzzle id — do NOT
            // shuffle again here, or the two players see different orders.
            item={t.item} options={t.item.choices ?? []} chosen={chosen}
            revealed={revealed} locked={!mine || revealed}
            onAnswer={(opt) => { setChosen(opt); t.submit(opt === t.item!.answer); }} />

          {/* The pause is skippable. A shorter fixed timer is not the same thing
              as being able to move on when you have finished reading. Once the
              reveal is stuck, whoever stallWriter names gets the same button
              rather than sitting out the grace period — the two conditions can
              never be true on both screens at once. */}
          {g.phase === "revealed" && g.last && (
            g.last.by === t.myMark ? (
              <button onClick={t.advanceNow}
                className="piece press w-full py-3.5 font-display text-lg font-semibold bg-ink text-paper">
                {g.last.correct || g.last.steal ? "Next" : "Let them try it"}
              </button>
            ) : stall?.action === "advance" && stall.mark === t.myMark ? (
              <button onClick={t.forceAdvance}
                className="piece press w-full py-3.5 font-display text-lg font-semibold bg-ink text-paper">
                Move it on
              </button>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}
