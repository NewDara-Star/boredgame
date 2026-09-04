import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { popIn } from "@/shared/ui/motion";
import { QuestionPanel, Timer } from "@/features/squareoff/QuestionPanel";
import { drawMatchCard, saveCard, type MatchCard } from "@/features/squareoff/matchCard";
import { ASK_MS } from "@/features/squareoff/useSquareOff";
import { Seats, AwayNotice, OverPanel, EndMatchLink } from "@/features/rooms/matchUi";
import { Board } from "./Board";
import { describe, stallWriter, type Mark } from "./rules";
import { useC4Room } from "./useC4Room";

/** How long after a deadline passes before the other player may take over. */
const GRACE_MS = 6000;
/** When a reveal counts as stuck. Must stay above the longest pause in
    useC4Room (2900ms) or the rescue races the timer it exists to back up. */
const REVEAL_MS = 4500;

export function Connect4Room({
  roomId, code, status, categories, difficulty, players, userId, plain,
}: {
  roomId: number; code: string; status: RoomStatus;
  categories: string[] | null; difficulty: string[] | null;
  players: RoomPlayer[]; userId: string;
  /** Plain Connect 4 drops on tap. Otherwise a column costs a right answer. */
  plain: boolean;
}) {
  const t = useC4Room(roomId, userId, { categories, difficulty }, plain);
  const [card, setCard] = useState<(MatchCard & { sig: string }) | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const g = t.game;
  const asking = g?.phase === "asking";
  const mine = asking && g.turn === t.myMark;

  // One clock, derived from when the question was written, so both screens
  // agree. It runs outside a question too, or the "they have gone" notice never
  // appears on the screen most likely to be stuck.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), asking ? 120 : 1000);
    return () => clearInterval(id);
  }, [asking]);

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.target]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else may step in. stallWriter
  // names exactly one mark at any instant — unit-checked.
  const elapsed = now - t.askedAt;
  const left = ASK_MS - elapsed;
  const stall = g && !plain
    ? stallWriter(g, elapsed, { ask: ASK_MS, reveal: REVEAL_MS, grace: GRACE_MS })
    : null;
  const fired = useRef<number>(-1);
  useEffect(() => {
    if (!stall || stall.mark !== t.myMark || fired.current === t.askedAt) return;
    if (stall.action === "timeout" && !t.item) return;
    fired.current = t.askedAt;
    if (stall.action === "timeout") t.forceTimeout();
    else t.forceAdvance();
  }, [stall, t]);

  const title = plain ? "CONNECT 4" : "CONNECT 4 TRIVIA";
  const nameOf = (m: Mark) =>
    players.find((p) => p.user_id === t.seats[m])?.username ?? (m === "x" ? "Host" : "Guest");
  const scoreOf = (m: Mark) => players.find((p) => p.user_id === t.seats[m])?.score ?? 0;
  const sides = (["x", "o"] as Mark[]).map((m) => ({ mark: m, name: nameOf(m), score: scoreOf(m) }));

  // Seats come from the game row and scores from room_players, both of which
  // arrive after the first render. Drawing on "finished" alone produces a card
  // that says Host 0 / Guest 0 above a real scoreline, and then never redraws.
  const done = status === "finished";
  const seated = !!t.seats.x && !!t.seats.o && players.length >= 2;
  const sig = `${code}|${title}|${sides[0].name}:${sides[0].score}|${sides[1].name}:${sides[1].score}`;
  useEffect(() => {
    if (!done || !seated || card?.sig === sig) return;
    let cancelled = false;
    void drawMatchCard(code, sides[0], sides[1], title)
      .then((made) => { if (!cancelled) setCard({ ...made, sig }); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, seated, sig]);

  if (status === "finished") {
    const [a, b] = sides;
    const winner = a.score === b.score ? null : a.score > b.score ? a : b;
    return (
      <motion.div variants={popIn} initial="hidden" animate="show" className="space-y-4">
        <div className={`piece p-6 text-center ${
          !winner ? "bg-sand" : winner.mark === t.myMark ? "bg-good text-surface" : "bg-surface"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Match over</p>
          <p className="font-display text-3xl font-semibold mt-1">
            {!winner ? "All square" : `${winner.name} takes it`}
          </p>
          <p className="font-display text-6xl font-semibold tabular-nums mt-3">
            {a.score} <span className="opacity-40">—</span> {b.score}
          </p>
          <p className="text-xs font-bold opacity-70 mt-1">{a.name} v {b.name}</p>
        </div>

        {card ? (
          <>
            <img src={card.url} alt={`Result: ${a.name} ${a.score}, ${b.name} ${b.score}`}
              className="w-full rounded-2xl border-[3px] border-ink" />
            <button onClick={() => saveCard(card.file)}
              className="piece press w-full py-4 font-display text-lg font-semibold bg-pop">
              Save the image
            </button>
            <p className="text-[11px] font-bold text-soft text-center">
              On a phone you can also press and hold the picture to save or share it.
            </p>
          </>
        ) : (
          <div className="piece grid place-items-center aspect-square bg-surface">
            <p className="text-sm font-bold text-soft">Drawing the result…</p>
          </div>
        )}

        <Link to="/rooms" className="piece press block w-full py-3.5 text-center font-display font-semibold">
          New room
        </Link>
      </motion.div>
    );
  }

  if (!t.ready) return <p className="text-sm text-soft font-bold">Loading questions…</p>;
  if (!g) return <p className="text-sm text-soft font-bold">Dealing the board…</p>;

  const names: Record<Mark, string> = { x: nameOf("x"), o: nameOf("o") };
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <div className="space-y-4">
      <Seats
        names={names}
        scores={{ x: scoreOf("x"), o: scoreOf("o") }}
        active={g.phase === "over" ? null : g.turn}
        glyph={() => "●"}
        dimmed={g.phase === "over"} />

      <Board board={g.board} target={g.target} line={g.line}
        canPick={g.phase === "picking" && g.turn === t.myMark}
        compact={!plain && (g.phase === "asking" || g.phase === "revealed")}
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

      {g.phase === "over" ? (
        <OverPanel
          headline={g.winner === "draw" ? "Draw"
            : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          mine={g.winner === t.myMark}
          draw={g.winner === "draw"}
          onRematch={() => void t.rematch()}
          onQuit={() => void t.quit()}
          onChangeGame={() => void t.changeGame()} />
      ) : !plain && t.item && (g.phase === "asking" || g.phase === "revealed") ? (
        <div className="space-y-3">
          {asking && <Timer fraction={Math.max(0, left / ASK_MS)} />}
          <QuestionPanel
            // Already permuted by loadContent, seeded on the puzzle id — do NOT
            // shuffle again here, or the two players see different orders.
            item={t.item} options={t.item.choices ?? []} chosen={chosen}
            revealed={revealed} locked={!mine || revealed}
            onAnswer={(opt) => { setChosen(opt); t.submit(opt === t.item!.answer); }} />

          {/* The pause is skippable, and once a reveal is stuck whoever
              stallWriter names gets the same button rather than sitting out the
              grace period. The two conditions are never true on both screens. */}
          {g.phase === "revealed" && g.last && (
            g.last.by === t.myMark ? (
              <button onClick={t.advanceNow}
                className="piece press w-full py-3.5 font-display text-lg font-semibold bg-ink text-paper">
                Next
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
