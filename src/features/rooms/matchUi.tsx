import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { popIn } from "@/shared/ui/motion";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { drawCard, ellipsize, HEADLINE_CHARS, type Glyph, type Hero, type MatchCard } from "@/shared/card/frame";
import { ResultScreen } from "@/features/play/ResultScreen";

export type Mark = "x" | "o";

export const SEAT_COLOUR: Record<Mark, string> = {
  x: "var(--color-picto)",
  o: "var(--color-trivia)",
};

/** No heartbeat for this long and we say so on screen. */
export const AWAY_MS = 50_000;

/**
 * The chrome shared by every room game: who is playing, who is away, and how it
 * ended. Square Off predates this and keeps its own copy; these pieces exist so
 * the games added after it do not each grow a third and fourth version.
 */
export function Seats({
  names, scores, active, glyph, dimmed,
}: {
  names: Record<Mark, string>;
  scores: Record<Mark, number>;
  /** whose move it is, or null when nobody owes one */
  active: Mark | null;
  glyph: (m: Mark) => string;
  /** true once the game is over, so neither seat is highlighted */
  dimmed: boolean;
}) {
  return (
    <div className="flex justify-center gap-2">
      {(["x", "o"] as Mark[]).map((m) => {
        const on = active === m && !dimmed;
        return (
          <motion.div key={m}
            animate={{ scale: on ? 1 : 0.94, opacity: on || dimmed ? 1 : 0.5 }}
            className={`piece flex items-center gap-2 px-3 py-2 ${on ? "bg-pop" : "bg-surface"}`}>
            <span className="font-display text-xl font-semibold leading-none"
              style={{ color: SEAT_COLOUR[m] }}>{glyph(m)}</span>
            <span className="text-[13px] font-black uppercase tracking-wide">{names[m]}</span>
            <span className="font-display text-lg font-semibold tabular-nums leading-none">
              {scores[m]}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Presence is a heartbeat on a row both players already subscribe to. */
export function AwayNotice({ players, userId, now }: {
  players: RoomPlayer[]; userId: string; now: number;
}) {
  const gone = players.find((p) => p.user_id !== userId && now - Date.parse(p.last_seen) > AWAY_MS);
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
}

export function OverPanel({
  headline, mine, draw, onRematch, onQuit, onChangeGame,
}: {
  headline: string; mine: boolean; draw: boolean;
  onRematch: () => void; onQuit: () => void;
  /** Back to the lobby, same code. Rematch keeps the tally; this starts a new one. */
  onChangeGame: () => void;
}) {
  return (
    <motion.div variants={popIn} initial="hidden" animate="show"
      className={`piece p-6 text-center ${
        draw ? "bg-sand" : mine ? "bg-good text-surface" : "bg-bad text-surface"}`}>
      <p className="font-display text-3xl font-semibold">{headline}</p>
      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <button onClick={onRematch}
          className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
          Rematch
        </button>
        <button onClick={onQuit}
          className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
          Quit match
        </button>
      </div>
      <button onClick={onChangeGame}
        className="piece press w-full mt-2.5 py-3 font-display text-base font-semibold
          bg-surface text-ink">
        Play something else
      </button>
      <p className="text-[13px] font-bold opacity-70 mt-2">
        Same room, same code. The score starts again.
      </p>
    </motion.div>
  );
}

/** Reachable at any point: offering "quit" only after a game ends means a match
    abandoned mid-board can never produce a result card. */
export function EndMatchLink({ onQuit }: { onQuit: () => void }) {
  return (
    <button onClick={onQuit}
      className="block mx-auto text-[13px] font-black uppercase tracking-wider
        text-soft underline underline-offset-4">
      End match and see the score
    </button>
  );
}

export interface Side { mark: Mark; name: string; score: number }

/**
 * The chrome every room game grew its own copy of: the clock, who is in which
 * seat, and drawing the result card. Three copies scored 0.99-1.00 against each
 * other, which is one bug fixed three times or, more often, once.
 */
/** What the game puts on its result card: its board as it stood, and how a
    seat is drawn. Read when the card is drawn, so it sees the final board. */
export interface CardArt { hero: () => Hero; glyph?: Glyph; caption?: () => string | undefined }

export function useMatchChrome(
  code: string, title: string, status: RoomStatus,
  players: RoomPlayer[], seats: Record<Mark, string | null>,
  /** how often the clock ticks — a question needs a smooth bar, an idle board
      needs only enough to notice somebody has gone */
  fast = false,
  art?: CardArt,
) {
  const [now, setNow] = useState(Date.now());
  const [card, setCard] = useState<(MatchCard & { sig: string }) | null>(null);
  const artRef = useRef(art); artRef.current = art;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), fast ? 120 : 1000);
    return () => clearInterval(id);
  }, [fast]);

  // Names come from the seat, not from "the other person in the list" — with a
  // spectator or a third join that guess puts the wrong name on the wrong mark.
  const nameOf = (m: Mark) =>
    players.find((p) => p.user_id === seats[m])?.username ?? (m === "x" ? "Host" : "Guest");
  const scoreOf = (m: Mark) => players.find((p) => p.user_id === seats[m])?.score ?? 0;
  const sides: Side[] = (["x", "o"] as Mark[])
    .map((m) => ({ mark: m, name: nameOf(m), score: scoreOf(m) }));
  const names: Record<Mark, string> = { x: nameOf("x"), o: nameOf("o") };

  // Seats come from the game row and scores from room_players, both of which
  // arrive after the first render. Drawing on "finished" alone produces a card
  // that says Host 0 / Guest 0 above a real scoreline, and then never redraws.
  const done = status === "finished";
  const seated = !!seats.x && !!seats.o && players.length >= 2;
  const sig = `${code}|${title}|${sides[0].name}:${sides[0].score}|${sides[1].name}:${sides[1].score}`;
  useEffect(() => {
    if (!done || !seated || card?.sig === sig) return;
    let cancelled = false;
    const [a, b] = sides;
    const winner = a.score === b.score ? null : a.score > b.score ? a : b;
    const art = artRef.current;
    void drawCard({
      title, code,
      headline: winner ? `${ellipsize(winner.name, HEADLINE_CHARS)} wins` : "All square",
      hero: art?.hero() ?? (() => {}),
      glyph: art?.glyph, caption: art?.caption?.(),
      sides: [a, b],
    })
      .then((made) => { if (!cancelled) setCard({ ...made, sig }); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, seated, sig]);

  return { now, nameOf, scoreOf, sides, names, card, done };
}

/** The end of a session, as opposed to the end of a game: the tally, the
    shareable card, and a way out. */
export function MatchOver({ sides, myMark, card }: {
  sides: Side[]; myMark: Mark | null; card: (MatchCard & { sig: string }) | null;
}) {
  const [a, b] = sides;
  const winner = a.score === b.score ? null : a.score > b.score ? a : b;
  return (
    <ResultScreen
      headline={!winner ? "All square" : `${winner.name} takes it`}
      score={`${a.score} — ${b.score}`}
      tone={!winner ? "draw" : winner.mark === myMark ? "win" : "loss"}
      card={card}
      alt={`Result: ${a.name} ${a.score}, ${b.name} ${b.score}`}>
      <Link to="/rooms"
        className="piece press py-3.5 text-center font-display text-lg font-semibold bg-surface">
        New room
      </Link>
    </ResultScreen>
  );
}

/** What stallWriter() returns: who may write the stuck transition, and which. */
export interface Stall { mark: Mark; action: "timeout" | "advance" }

/**
 * Take over a transition its owner never wrote.
 *
 * Every phase is written by exactly one client, so a player who locks their
 * phone takes their half of the game with them. The reveal case is the one that
 * actually bit: its pause is a setTimeout in the answerer's tab, and a locked
 * phone suspends it with nothing else running anywhere. stallWriter names
 * exactly one mark at any instant — unit-checked in both rules modules — and
 * this fires it at most once per written state.
 *
 * Both games had a byte-identical copy of this, which is how the reveal case
 * came to be missing from one of them for a fortnight.
 */
export function useStallRescue(
  stall: Stall | null, myMark: Mark | null, askedAt: number,
  /** true once the question this stall refers to is actually on screen */
  haveItem: boolean,
  act: { forceTimeout: () => void; forceAdvance: () => void },
) {
  const fired = useRef<number>(-1);
  useEffect(() => {
    if (!stall || stall.mark !== myMark || fired.current === askedAt) return;
    // Timing out a question this client has not loaded would write a miss for
    // something nobody was shown.
    if (stall.action === "timeout" && !haveItem) return;
    fired.current = askedAt;
    if (stall.action === "timeout") act.forceTimeout();
    else act.forceAdvance();
  }, [stall, myMark, askedAt, haveItem, act]);
}
