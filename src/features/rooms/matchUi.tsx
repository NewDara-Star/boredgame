import { motion } from "framer-motion";
import { popIn } from "@/shared/ui/motion";
import type { RoomPlayer } from "@/shared/types/db";

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
      <p className="text-[11px] font-bold opacity-70 mt-2">
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
      className="block mx-auto text-[11px] font-black uppercase tracking-wider
        text-soft underline underline-offset-4">
      End match and see the score
    </button>
  );
}
