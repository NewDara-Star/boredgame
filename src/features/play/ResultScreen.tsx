import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { popIn } from "@/shared/ui/motion";
import { saveCard, type MatchCard } from "@/shared/card/frame";

/**
 * The end of a session, on one screen.
 *
 * The card already says the game, both names and the score, in bigger type
 * than the page can — so the page says it once, in a line, and then shows the
 * card. It used to say it three times: a panel with the headline, a panel with
 * the score, and the card with both, which put the card itself 296px below the
 * fold of a phone in Safari. You could not see the thing you were being
 * offered to save.
 */
export function ResultScreen({ headline, score, tone, card, alt, children }: {
  headline: string;
  /** the tally as it should read — "3 — 1" */
  score: string;
  tone: "win" | "loss" | "draw";
  card: MatchCard | null;
  alt: string;
  /** what to do next: one or two buttons, side by side with Save */
  children?: ReactNode;
}) {
  const bg = tone === "draw" ? "bg-sand" : tone === "win" ? "bg-good text-surface" : "bg-bad text-surface";
  // `card` is null while the canvas draws -- but drawCard can fail and swallow
  // the error, leaving this null for good. Rather than sit on "Drawing..." forever,
  // fall back to a plain note after a few seconds (the score is shown above anyway).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (card) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [card]);
  return (
    <motion.div variants={popIn} initial="hidden" animate="show" className="play-surface">
      <div className={`piece shrink-0 px-4 py-3 flex items-baseline justify-between gap-3 ${bg}`}>
        <p className="font-display text-xl font-semibold truncate">{headline}</p>
        <p className="font-display text-2xl font-semibold tabular-nums shrink-0">{score}</p>
      </div>

      {/* the card, as big as the screen will allow and no bigger */}
      <div className="flex-1 min-h-0 grid place-items-center">
        {card ? (
          <img src={card.url} alt={alt}
            className="max-h-full w-auto max-w-full rounded-2xl border-[3px] border-ink" />
        ) : (
          <div className="piece grid place-items-center h-full aspect-square bg-surface p-6 text-center">
            <p className="text-sm font-bold text-soft">
              {slow ? "Couldn't draw the result card — your score is shown above." : "Drawing the result…"}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-2.5">
        <button onClick={() => card && saveCard(card.file)} disabled={!card}
          className="piece press py-3.5 font-display text-lg font-semibold bg-pop disabled:opacity-50">
          Save the image
        </button>
        {children}
      </div>
    </motion.div>
  );
}
