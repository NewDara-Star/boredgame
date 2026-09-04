import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { popIn } from "@/shared/ui/motion";
import { Board } from "./Board";
import { QuestionPanel, Timer } from "./QuestionPanel";
import { describe, stallWriter, type Mark } from "./rules";
import { useTttRoom } from "./useTttRoom";
import { drawMatchCard, saveCard, type MatchCard } from "./matchCard";
import { ASK_MS } from "./useSquareOff";

/** How long after a deadline passes before the other player takes over. Long
    enough that a slow network is not mistaken for someone leaving. */
const GRACE_MS = 6000;
/** When a reveal is considered stuck. Must sit above the longest pause in
    useTttRoom (2900ms) or this races the timer it exists to back up. */
const REVEAL_MS = 4500;
/** No heartbeat for this long and we say so on screen. */
const AWAY_MS = 50_000;

export function SquareOffRoom({
  roomId, code, status, categories, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus; categories: string[] | null;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useTttRoom(roomId, userId, categories);
  const [card, setCard] = useState<(MatchCard & { sig: string }) | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const g = t.game;
  const asking = g?.phase === "asking";
  const mine = asking && g.answerer === t.myMark;

  // One clock, derived from when the question was written, so both screens agree.
  // It runs outside a question too, or the "they have gone" notice never appears
  // on the screen most likely to be stuck.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), asking ? 120 : 1000);
    return () => clearInterval(id);
  }, [asking]);

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.steal]);

  // Each phase is written by one client, so a player who goes away takes their
  // half of the game with them unless someone else is allowed to step in.
  // stallWriter names exactly one mark at any instant — unit-checked. The
  // reveal case is the one that actually bit: its pause is a setTimeout in the
  // answerer's tab, which a phone suspends the moment the screen locks.
  const elapsed = now - t.askedAt;
  const left = ASK_MS - elapsed;
  const stall = g ? stallWriter(g, elapsed, { ask: ASK_MS, reveal: REVEAL_MS, grace: GRACE_MS }) : null;
  const fired = useRef<number>(-1);
  useEffect(() => {
    if (!stall || stall.mark !== t.myMark || fired.current === t.askedAt) return;
    if (stall.action === "timeout" && !t.item) return;
    fired.current = t.askedAt;
    if (stall.action === "timeout") t.forceTimeout();
    else t.forceAdvance();
  }, [stall, t]);

  const sides = (["x", "o"] as Mark[]).map((m) => ({
    mark: m,
    name: players.find((p) => p.user_id === t.seats[m])?.username ?? (m === "x" ? "Host" : "Guest"),
    score: players.find((p) => p.user_id === t.seats[m])?.score ?? 0,
  }));

  // Drawn as soon as the match ends and shown on screen, not hidden behind a
  // download. A file you have to save before you can look at it is a file most
  // people never see — and `<a download>` is unreliable on iOS anyway, where the
  // image opens instead of saving. On screen you can always long-press it.
  const done = status === "finished";
  // Seats come from the ttt row and scores from room_players, both of which
  // arrive after the first render. Drawing on "finished" alone produced a card
  // that said Host 0 / Guest 0 while the panel above it read 3-1, and then
  // never redrew. The signature also means a rematch redraws rather than
  // showing a stale scoreline.
  const seated = !!t.seats.x && !!t.seats.o && players.length >= 2;
  const sig = `${code}|${sides[0].name}:${sides[0].score}|${sides[1].name}:${sides[1].score}`;
  useEffect(() => {
    if (!done || !seated || card?.sig === sig) return;
    let cancelled = false;
    void drawMatchCard(code, sides[0], sides[1])
      .then((made) => { if (!cancelled) setCard({ ...made, sig }); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
  }, [done, seated, sig, card?.sig, code, sides]);

  // Quitting ends the session, not the game — the tally survives the rematches
  // that came before it, which is the only reason to keep score at all.
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
            <img src={card.url} alt={`Square Off result: ${a.name} ${a.score}, ${b.name} ${b.score}`}
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

  // Names come from the seat, not from "the other person in the list" — with a
  // spectator or a third join that guess puts the wrong name on the wrong mark.
  const nameOf = (m: Mark) =>
    players.find((p) => p.user_id === t.seats[m])?.username ?? (m === "x" ? "Host" : "Guest");
  const names: Record<Mark, string> = { x: nameOf("x"), o: nameOf("o") };
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {(["x", "o"] as Mark[]).map((m) => {
          const active = g.phase === "asking" ? g.answerer === m : g.turn === m;
          return (
            <motion.div key={m} animate={{ scale: active && g.phase !== "over" ? 1 : 0.94, opacity: active || g.phase === "over" ? 1 : 0.5 }}
              className={`piece flex items-center gap-2 px-3 py-2 ${active && g.phase !== "over" ? "bg-pop" : "bg-surface"}`}>
              <span className="font-display text-xl font-semibold leading-none"
                style={{ color: m === "x" ? "var(--color-picto)" : "var(--color-trivia)" }}>
                {m === "x" ? "✕" : "◯"}
              </span>
              <span className="text-[13px] font-black uppercase tracking-wide">{names[m]}</span>
              <span className="font-display text-lg font-semibold tabular-nums leading-none">
                {players.find((p) => p.user_id === t.seats[m])?.score ?? 0}
              </span>
            </motion.div>
          );
        })}
      </div>

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

      {(() => {
        const gone = players.find((p) =>
          p.user_id !== userId && now - Date.parse(p.last_seen) > AWAY_MS);
        if (!gone) return null;
        const mins = Math.floor((now - Date.parse(gone.last_seen)) / 60_000);
        return (
          <div className="piece bg-pop p-3.5 text-center">
            <p className="text-[13px] font-bold">
              {gone.username} hasn't been seen for {mins < 1 ? "a minute" : `${mins} minutes`}.
              Play carries on without them, or end the match and take the score.
            </p>
          </div>
        );
      })()}

      {/* Reachable at any point. Offering "quit" only after a game ends means a
          match abandoned mid-board can never produce a result card. */}
      {g.phase !== "over" && (
        <button onClick={() => void t.quit()}
          className="block mx-auto text-[11px] font-black uppercase tracking-wider
            text-soft underline underline-offset-4">
          End match and see the score
        </button>
      )}

      {g.phase === "over" ? (
        <motion.div variants={popIn} initial="hidden" animate="show"
          className={`piece p-6 text-center ${
            g.winner === "draw" ? "bg-sand"
              : g.winner === t.myMark ? "bg-good text-surface" : "bg-bad text-surface"}`}>
          <p className="font-display text-3xl font-semibold">
            {g.winner === "draw" ? "Draw" : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <button onClick={() => void t.rematch()}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              Rematch
            </button>
            <button onClick={() => void t.quit()}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              Quit match
            </button>
          </div>
        </motion.div>
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
