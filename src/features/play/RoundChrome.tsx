import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { drawCard, saveCard, type MatchCard } from "@/shared/card/frame";
import { roundHero } from "./roundCard";
import { Counter } from "@/shared/ui/Counter";
import { SPRING, stagger, riseIn, popIn } from "@/shared/ui/motion";
import type { PlayItem } from "./types";
import type { RoundOutcome } from "./progress";
import { UnlockGate } from "./Unlock";

export function Hud({ index, total, score, streak, accent }:
  { index: number; total: number; score: number; streak: number; accent: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5 flex-1">
        {Array.from({ length: total }, (_, i) => (
          <motion.span key={i}
            className="h-2.5 flex-1 rounded-full border-2 border-ink"
            initial={false}
            animate={{ backgroundColor: i <= index ? accent : "#EFE3CB" }}
            transition={{ duration: 0.25 }} />
        ))}
      </div>
      <AnimatePresence>
        {streak >= 2 && (
          <motion.span key="streak" variants={popIn} initial="hidden" animate="show"
            exit={{ opacity: 0, scale: 0.6 }}
            className="text-[13px] font-black uppercase bg-pop border-2 border-ink rounded-full px-2 py-0.5">
            {streak}×
          </motion.span>
        )}
      </AnimatePresence>
      <Counter value={score} className="font-display text-xl font-semibold w-14 text-right" />
    </div>
  );
}

export function HintBar({ item, used, onUse }:
  { item: PlayItem; used: number; onUse: () => void }) {
  // Nothing to offer means no button at all, rather than a dead one.
  const hints = [item.altHint, item.charHint].filter((h): h is string => !!h);
  return (
    <div className="mt-4">
      <AnimatePresence initial={false}>
        {hints.slice(0, used).map((h, i) => (
          <motion.p key={i}
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            className="text-sm text-soft font-semibold mb-1.5 overflow-hidden">
            <span className="text-[12px] font-black uppercase tracking-widest bg-sand
              border-2 border-ink rounded-full px-2 py-0.5 mr-2">
              {i === 0 ? "Clue" : "Letters"}
            </span>
            {h}
          </motion.p>
        ))}
      </AnimatePresence>
      {used < hints.length && (
        <button onClick={onUse}
          className="piece press text-xs font-black uppercase tracking-wider px-3 py-2 rounded-xl bg-sand">
          {used === 0 ? "Need a clue?  −100" : "One more  −100"}
        </button>
      )}
    </div>
  );
}

/** Correct answers get a physical reward. Without one, right and wrong feel the same. */
export function Burst({ show }: { show: boolean }) {
  const still = useReducedMotion();
  if (still) return null;
  const bits = ["#FF5A1F", "#2B4BFF", "#FFD028", "#10A04E", "#FF5A1F", "#FFD028", "#2B4BFF", "#10A04E"];
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
          {bits.map((c, i) => {
            const a = (i / bits.length) * Math.PI * 2;
            return (
              <motion.span key={i}
                className="absolute w-3 h-3 rounded-sm border-2 border-ink"
                style={{ background: c }}
                initial={{ opacity: 1, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  opacity: 0, scale: 1,
                  x: Math.cos(a) * 130, y: Math.sin(a) * 110 - 20,
                  rotate: 220 * (i % 2 ? 1 : -1),
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: "easeOut" }} />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

export function Reveal({ correct, near, answer, gained, onNext, isLast, explanation }:
  { correct: boolean; near: boolean; answer: string; gained: number; onNext: () => void;
    isLast: boolean; explanation?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      className="mt-5">
      <div className={`piece p-4 ${correct ? "bg-good" : near ? "bg-pop" : "bg-bad"}`}>
        <p className={`font-display text-lg font-semibold ${near && !correct ? "text-ink" : "text-surface"}`}>
          {correct ? `Correct  +${gained}` : near ? "So close" : "Missed"}
        </p>
        {!correct && (
          <p className={`text-[15px] font-bold mt-0.5 ${near ? "text-ink" : "text-surface"}`}>
            {answer}
          </p>
        )}
      </div>
      {explanation && (
        <div className="piece p-4 mt-2.5">
          <p className="text-[12px] font-black uppercase tracking-widest text-soft">Why</p>
          <p className="text-[15px] font-semibold mt-1 leading-snug">{explanation}</p>
        </div>
      )}
      <button onClick={onNext} autoFocus
        className="piece press w-full mt-3 py-4 font-display text-lg font-semibold bg-ink text-paper">
        {isLast ? "See the round" : "Next"}
      </button>
    </motion.div>
  );
}

/** The round's result card: drawn once the round is over, kept if you want it. */
function RoundCard({ title, results, score, outcome }:
  { title: string; results: { correct: boolean }[]; score: number; outcome?: RoundOutcome | null }) {
  const [card, setCard] = useState<MatchCard | null>(null);
  const right = results.filter((r) => r.correct).length;
  useEffect(() => {
    let cancelled = false;
    void drawCard({
      title, code: null,
      headline: `${right} of ${results.length}`,
      hero: roundHero(results, score),
      caption: outcome?.streak ? `Day ${outcome.streak} streak` : `${right} right, ${results.length - right} missed`,
    }).then((made) => { if (!cancelled) setCard(made); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
  }, [title, results, score, outcome?.streak, right]);
  if (!card) return null;
  return (
    <motion.div variants={riseIn} className="mt-6 space-y-2.5">
      <img src={card.url} alt={`${title}: ${right} of ${results.length}, ${score} points`}
        className="w-full rounded-2xl border-[3px] border-ink" />
      <button onClick={() => saveCard(card.file)}
        className="piece press w-full py-3.5 font-display text-lg font-semibold bg-pop">
        Save the image
      </button>
    </motion.div>
  );
}

export function Summary({ score, results, outcome, onAgain, children, title }:
  { score: number; results: { correct: boolean }[]; outcome?: RoundOutcome | null;
    onAgain: () => void; children?: ReactNode;
    /** the game's name for the result card; no name, no card */
    title?: string }) {
  const right = results.filter((r) => r.correct).length;
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="text-center">
      <motion.p variants={riseIn}
        className="text-[12px] font-black uppercase tracking-widest text-soft">Round complete</motion.p>
      <motion.div variants={popIn} className="relative py-2">
        <Burst show />
        <Counter value={score} className="font-display text-7xl font-semibold text-picto block" />
      </motion.div>
      <motion.p variants={riseIn} className="text-sm font-bold text-soft">
        {right} of {results.length} correct
      </motion.p>
      {!!outcome?.streak && (
        <motion.p variants={popIn}
          className="inline-block mt-3 text-[13px] font-black uppercase tracking-widest
            bg-pop border-[2.5px] border-ink rounded-full px-3 py-1">
          Day {outcome.streak} streak
        </motion.p>
      )}
      {title && <RoundCard title={title} results={results} score={score} outcome={outcome} />}
      <motion.div variants={riseIn} className="mt-6 text-left">{children}</motion.div>
      <motion.button variants={riseIn} onClick={onAgain}
        className="piece press w-full mt-5 py-4 font-display text-lg font-semibold bg-picto text-surface">
        Play again
      </motion.button>
      <UnlockGate outcome={outcome ?? null} />
    </motion.div>
  );
}
