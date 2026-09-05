import { motion } from "framer-motion";
import { riseIn } from "@/shared/ui/motion";

type Tone = "bad" | "warn" | "good";

const TONE: Record<Tone, string> = {
  bad: "bg-bad text-surface",
  warn: "bg-pop",
  good: "bg-good text-surface",
};

/**
 * Something the player needs to read that is not the game.
 *
 * There were fifteen hand-rolled versions of this, and they had drifted: some
 * animated in and some appeared, some were centred and some were not, and the
 * text ran from 12px to 15px depending on which file you were in. Each one was
 * individually fine, which is why nothing ever flagged it.
 *
 * Renders nothing when there is nothing to say, so a caller can hand it a
 * possibly-null message rather than guarding at every site.
 */
export function Note({ children, tone = "bad", title, animate = false }: {
  children?: React.ReactNode;
  tone?: Tone;
  title?: string;
  /** Rooms show these mid-game, where a thing sliding in is a distraction. */
  animate?: boolean;
}) {
  if (!children) return null;
  const body = (
    <>
      {title && <p className="font-display font-semibold">{title}</p>}
      <p className={`text-[13px] font-bold ${title ? "mt-1" : ""}`}>{children}</p>
    </>
  );
  const cls = `piece p-3.5 text-center ${TONE[tone]}`;
  return animate
    ? <motion.div variants={riseIn} className={cls}>{body}</motion.div>
    : <div className={cls}>{body}</div>;
}

/**
 * Waiting for something.
 *
 * The app had nine different ways of saying this — "Dealing questions…",
 * "Dealing the board…", "Dealing the tiles…", "Dealing…", "Loading questions…",
 * "Finding room…", "Fetching today's round…" — which reads as seven different
 * apps rather than one. The word is "Dealing" and the thing is named after it.
 */
export function Dealing({ what }: { what: string }) {
  return <p className="text-[13px] font-bold text-soft">Dealing {what}…</p>;
}
