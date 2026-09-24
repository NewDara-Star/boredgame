import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { sayParts, type ScoreParts } from "./scoring";
import { MIST, RAMPS } from "@/shared/brand/tokens";
import { useEffect, useState, type ReactNode } from "react";
import { drawCard, type MatchCard } from "@/shared/card/frame";
import { ShareButtons } from "@/shared/card/ShareButtons";
import { gameName, gamePath } from "@/shared/card/voice";
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
            className="h-2.5 flex-1 rounded-full shadow-lift-sm"
            initial={false}
            animate={{ backgroundColor: i <= index ? accent : MIST }}
            transition={{ duration: 0.25 }} />
        ))}
      </div>
      <AnimatePresence>
        {streak >= 2 && (
          <motion.span key="streak" variants={popIn} initial="hidden" animate="show"
            exit={{ opacity: 0, scale: 0.6 }}
            className="text-[13px] font-black bg-petal shadow-lift-sm rounded-full px-2 py-0.5">
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
            <span className="text-[12px] font-black bg-mist shadow-lift-sm rounded-full px-2 py-0.5 mr-2">
              {i === 0 ? "Clue" : "Letters"}
            </span>
            {h}
          </motion.p>
        ))}
      </AnimatePresence>
      {used < hints.length && (
        <button onClick={onUse}
          className="card tap text-xs font-black px-4 min-h-[44px] inline-flex items-center rounded-xl bg-mist">
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
  const bits = [RAMPS.ember.base, RAMPS.sky.base, RAMPS.petal.base, RAMPS.leaf.base, RAMPS.grape.base, RAMPS.petal.base, RAMPS.sky.base, RAMPS.gum.base];
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
          {bits.map((c, i) => {
            const a = (i / bits.length) * Math.PI * 2;
            return (
              <motion.span key={i}
                className="absolute w-3 h-3 rounded-sm shadow-lift-sm"
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

export function Reveal({ correct, near, answer, gained, parts, onNext, isLast, explanation }:
  { correct: boolean; near: boolean; answer: string; gained: number; onNext: () => void;
    isLast: boolean; explanation?: string;
    /** what the points were for; the clock is never shown while you answer (talk item 4) */
    parts?: ScoreParts | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      className="mt-5">
      <div className={`card p-4 ${correct ? "bg-leaf" : near ? "bg-petal" : "bg-ember"}`}>
        <p className={`font-display text-lg font-semibold ${near && !correct ? "text-ink" : "text-board"}`}>
          {correct ? `Correct  +${gained}` : near ? "So close" : "Missed"}
        </p>
        {correct && parts && (
          <p className="text-[13px] font-bold text-board opacity-90 mt-0.5 tabular-nums">{sayParts(parts)}</p>
        )}
        {!correct && (
          <p className={`text-[15px] font-bold mt-0.5 ${near ? "text-ink" : "text-board"}`}>
            {answer}
          </p>
        )}
      </div>
      {explanation && (
        <div className="card p-4 mt-2.5">
          <p className="text-[12px] font-black text-soft">Why</p>
          <p className="text-[15px] font-semibold mt-1 leading-snug">{explanation}</p>
        </div>
      )}
      <button onClick={onNext} autoFocus
        className="cut tap w-full mt-3 py-4 font-display text-lg font-semibold cut-ink text-ground">
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
    const n = results.length, game = gameName(title);
    void drawCard({
      title, code: null, path: gamePath(title),
      headline: `${right}/${n} on ${game}`,
      dare: right === n ? "Can you match it?" : `Can you beat ${right}?`,
      flower: right >= n * 0.7 ? "bloom" : right >= n * 0.4 ? "awake" : "bored",
      text: `I got ${right}/${n} on ${game}. ${right === n ? "Can you match it?" : "Can you beat it?"}`,
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
        className="w-full rounded-2xl shadow-lift-sm" />
      <ShareButtons card={card} />
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
        className="text-[12px] font-black text-soft">Round complete</motion.p>
      <motion.div variants={popIn} className="relative py-2">
        <Burst show />
        <Counter value={score} className="font-display text-7xl font-semibold text-ember block" />
      </motion.div>
      <motion.p variants={riseIn} className="text-sm font-bold text-soft">
        {right} of {results.length} correct
      </motion.p>
      {!!outcome?.streak && (
        <motion.p variants={popIn}
          className="inline-block mt-3 text-[13px] font-black
            bg-petal shadow-lift-sm rounded-full px-3 py-1">
          Day {outcome.streak} streak
        </motion.p>
      )}
      {title && <RoundCard title={title} results={results} score={score} outcome={outcome} />}
      <motion.div variants={riseIn} className="mt-6 text-left">{children}</motion.div>
      <motion.button variants={riseIn} onClick={onAgain}
        className="cut tap w-full mt-5 py-4 font-display text-lg font-semibold cut-ember text-ink">
        Play again
      </motion.button>
      <UnlockGate outcome={outcome ?? null} />
    </motion.div>
  );
}
