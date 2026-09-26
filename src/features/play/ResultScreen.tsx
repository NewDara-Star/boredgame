import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { popIn } from "@/shared/ui/motion";
import type { MatchCard } from "@/shared/card/frame";
import { ShareButtons } from "@/shared/card/ShareButtons";
import { TurnBanner } from "./PlaySurface";
import { useFocusMode } from "@/app/layout/focus";

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
  /** the tally as it should read: "3–1" */
  score: string;
  tone: "win" | "loss" | "draw";
  card: MatchCard | null;
  alt: string;
  /** what to do next, under Share and Story */
  children?: ReactNode;
}) {
  // #30, from the drawing's code: one .turn banner with the flower and the
  // score (gold for a win, white otherwise; it used to be a red slab for a
  // loss), the card as big as the phone allows, Share and Story, then what's next.
  useFocusMode(true);
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
    <motion.div variants={popIn} initial="hidden" animate="show" className="play-surface play-focus">
      <TurnBanner title={headline} tone={tone === "win" ? "petal" : "white"}
        flower={tone === "win" ? "bloom" : tone === "loss" ? "bored" : "awake"}
        end={<b className="font-mono font-bold text-[24px] shrink-0 tabular-nums">{score}</b>} />

      {/* the card, as big as the screen will allow and no bigger */}
      {/* #30's column: the card straight under the banner, the buttons straight
          under the card. The card shrinks on a short phone rather than pushing
          them off: the screen less the banner, the buttons and the gaps. */}
      <div className="min-h-0 grid place-items-center">
        {card ? (
          <img src={card.url} alt={alt}
            className="max-h-[calc(100dvh-330px)] w-auto max-w-full rounded-[18px] shadow-lift" />
        ) : (
          <div className="card grid place-items-center h-full aspect-square bg-board p-6 text-center">
            <p className="text-sm font-bold text-soft">
              {slow ? "Couldn't draw the result card — your score is shown above." : "Drawing the result…"}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 grid gap-[9px]">
        <ShareButtons card={card} className="gap-[9px]! grid-cols-[1.35fr_1fr]!" />
        {children && <div className="grid grid-cols-1 gap-[9px]">{children}</div>}
      </div>
    </motion.div>
  );
}
