import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { sayParts, type ScoreParts } from "./scoring";
import { RAMPS } from "@/shared/brand/tokens";
import { useEffect, useState, type ReactNode } from "react";
import { drawCard, type MatchCard } from "@/shared/card/frame";
import { ShareButtons } from "@/shared/card/ShareButtons";
import { gameName, gamePath } from "@/shared/card/voice";
import { roundHero } from "./roundCard";
import { Counter } from "@/shared/ui/Counter";
import { SPRING, stagger, riseIn, popIn } from "@/shared/ui/motion";
import type { RoundOutcome } from "./progress";
import { UnlockGate } from "./Unlock";
import { Link } from "react-router-dom";
import { Sunflower } from "@/shared/brand/Sunflower";
import { Art } from "@/shared/brand/Art";
import { useProgress } from "./useProgress";

/**
 * The pieces of a round, from the drawings' own code (#16–#24), not from a
 * screenshot of them: .x, .seeds, .hud, .hint, .pill.
 */

/** Ten seeds, 12px, 4px apart (.seeds, .hud .seeds): green right, red wrong,
    gold for the one in play (1.2x); one still to come is pale with a faint
    ring. `big`: the summary's 22px row inside a card, where a pale seed is mist. */
export function Seeds({ total, index, results, big = false }:
  { total: number; index: number; results: (boolean | undefined)[]; big?: boolean }) {
  const right = results.filter((r) => r === true).length;
  return (
    <div className={`flex items-center ${big ? "gap-[5px]" : "gap-1"}`} role="img"
      aria-label={big ? `${right} of ${total} right` : `Question ${index + 1} of ${total}. ${right} right so far.`}>
      {Array.from({ length: total }, (_, i) => {
        const was = results[i];
        const ramp = was === true ? "leaf" : was === false ? "ember" : i === index ? "petal" : null;
        // An answered seed is a subject: lit from the top left, with the ink
        // ring (BRAND.md rule 1).
        return (
          <i key={i} className={`block rounded-full shrink-0 ${big ? "w-[22px] h-[22px]" : "w-3 h-3"}`} style={ramp ? {
            background: `radial-gradient(circle at 35% 30%, var(--color-${ramp}-hi), var(--color-${ramp}) 65%)`,
            boxShadow: "0 0 0 2px var(--color-ink-day)",
            transform: was === undefined && !big ? "scale(1.2)" : undefined,
          } : big ? { background: "var(--color-mist)" }
            : { background: "rgba(255,255,255,.55)", boxShadow: "inset 0 0 0 2px rgba(35,26,61,.25)" }} />
        );
      })}
    </div>
  );
}

/** The drawing's .x: a 38px white disc with an ink cross, 44px to tap. */
export function LeaveX({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} className="shrink-0 grid place-items-center w-11 h-11 -m-[3px]">
      <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-board shadow-lift-sm">
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
          <path d="M3 3l10 10M13 3L3 13" stroke="var(--color-ink-day)" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
    </Link>
  );
}

/** The top of a round in play (.hud): the X, the seeds, the score in mono at
    16px. No clock: you're never timed on screen while you answer (talk item 4). */
export function RoundHud({ index, total, results, score, leaveTo, leaveLabel }:
  { index: number; total: number; results: (boolean | undefined)[]; score: number; leaveTo: string; leaveLabel: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LeaveX to={leaveTo} label={leaveLabel} />
      <Seeds total={total} index={index} results={results} />
      <Counter value={score} className="ml-auto font-mono text-[16px] font-bold shrink-0" />
    </div>
  );
}

/** The drawing's .hint: a white pill with a bulb, 800 13px. A button when it
    buys something, a plain pill when it shows what you've got. */
export function HintPill({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  const inner = (
    <>
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className="shrink-0">
        <path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="var(--color-petal)" stroke="var(--color-ink-day)" strokeWidth="2" />
        <path d="M9.5 19h5" stroke="var(--color-ink-day)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </>
  );
  const look = "chip inline-flex items-center gap-1.5 bg-board text-ink rounded-[16px] px-3 py-1.5 text-[13px] font-extrabold text-left";
  return onClick
    ? <button onClick={onClick} disabled={disabled} className={`${look} tap min-h-[44px] -my-[7px] disabled:opacity-50`}>{inner}</button>
    : <span className={look}>{inner}</span>;
}

/** The drawing's .pill with the streak: white, mono 14px, the flame. */
export function StreakPill() {
  const { streak } = useProgress();
  if (streak <= 0) return null;
  return (
    <span className="chip inline-flex items-center gap-1 bg-board text-ink rounded-full pl-1.5 pr-2.5 py-1 font-mono text-[14px] font-bold"
      title={`${streak}-day streak`}>
      <Art name="streak" style={{ width: 20 }} />{streak}
    </span>
  );
}

/** Where the typed answer differs from the right one, word by word: the words
    you added or changed, marked (#22: "You wrote 'foot in *my* mouth'"). */
function marked(given: string, answer: string): ReactNode {
  const g = given.trim().split(/\s+/), a = answer.toLowerCase().split(/\s+/);
  // Longest common subsequence of words, so the shared words line up.
  const L = Array.from({ length: g.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = g.length - 1; i >= 0; i--) for (let j = a.length - 1; j >= 0; j--)
    L[i][j] = g[i].toLowerCase() === a[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keep = new Set<number>();
  for (let i = 0, j = 0; i < g.length && j < a.length;) {
    if (g[i].toLowerCase() === a[j]) { keep.add(i); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return g.map((w, i) => <span key={i}>{i ? " " : ""}{keep.has(i) ? w : <b className="font-extrabold text-ember-lo underline decoration-2 underline-offset-2">{w}</b>}</span>);
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

export function Reveal({ correct, near, answer, gained, parts, onNext, isLast, explanation, answerShown = false, given }:
  { correct: boolean; near: boolean; answer: string; gained: number; onNext: () => void;
    isLast: boolean; explanation?: string;
    /** what was typed, for a near miss (#22): the difference gets marked */
    given?: string;
    /** what the points were for; the clock is never shown while you answer (talk item 4) */
    parts?: ScoreParts | null;
    /** the options already show the right one in green, so the card doesn't repeat it */
    answerShown?: boolean }) {
  // One white card, no shouting (#17, #18): the verdict, what the points were
  // for (kept, small: Daramola 26 Sep), and the reason. It used to be a green or
  // red slab saying Correct or Missed, and the reason in a second card.
  // From the drawing's code (.gain, .spacer, .cut): a white card, then the
  // screen's leftover space, then Next at the bottom. In a column that fills
  // the screen (the daily), Next sits at the foot; elsewhere 12px below.
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      className="mt-[11px] flex-1 flex flex-col">
      {near && !correct ? (
        // #22, .gain.miss with the flower: it sighs, the answer shows, and you
        // see exactly what was different. Still a miss (Daramola 26 Sep).
        <div className="card shadow-lift-sm rounded-[20px] px-3.5 py-3 flex items-center gap-2.5" role="status">
          <Sunflower state="bored" stem={false} size={44} className="shrink-0" />
          <div className="grid gap-0.5 min-w-0">
            <p className="font-display text-[21px] leading-tight text-ember-lo">So close</p>
            <p className="text-[14px] leading-[1.4] font-medium">
              It's "{answer}".{given ? <> You wrote "{marked(given, answer)}".</> : null}
            </p>
          </div>
        </div>
      ) : (
        <div className="card shadow-lift-sm rounded-[20px] px-3.5 py-3 grid gap-[3px]" role="status">
          <p className={`font-display text-[21px] leading-tight ${correct ? "text-leaf-deep" : "text-ember-lo"}`}>
            {correct ? `Yes! +${gained}` : "Not this time"}
          </p>
          {correct && parts && (
            <p className="text-[12px] font-bold text-soft tabular-nums">{sayParts(parts)}</p>
          )}
          {!correct && !answerShown && (
            <p className="text-[14px] leading-[1.4] font-bold">The answer: {answer}</p>
          )}
          {explanation && (
            <p className="text-[14px] leading-[1.4] font-medium">{explanation}</p>
          )}
        </div>
      )}
      <div className="flex-1 min-h-3" />
      <button onClick={onNext} autoFocus
        className="cut tap w-full min-h-[52px] font-display text-[19px] cut-petal">
        {isLast ? "See the round" : "Next"}
      </button>
    </motion.div>
  );
}

/** The round's result card: drawn once the round is over, kept if you want it. */
function useRoundCard(title: string | undefined, results: { correct: boolean }[], score: number, outcome?: RoundOutcome | null) {
  const [card, setCard] = useState<MatchCard | null>(null);
  const right = results.filter((r) => r.correct).length;
  useEffect(() => {
    if (!title) return;
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
  return card;
}

/**
 * The round summary (#23), from the drawing's code: the X and the streak pill;
 * a card with the game, the score counting up at 48px, the round in 22px seeds
 * and "8 of 10 right"; the share card; then Share (gold) and Play again (white,
 * second). The question list is folded behind "See your answers" (Daramola 26 Sep).
 */
export function Summary({ score, results, outcome, onAgain, children, title, name, leaveTo = "/play" }:
  { score: number; results: { correct: boolean }[]; outcome?: RoundOutcome | null;
    onAgain: () => void; children?: ReactNode;
    /** the game's name for the result card; no name, no card */
    title?: string;
    /** the game's name as the summary says it: "Star Trivia" */
    name: string;
    leaveTo?: string }) {
  const right = results.filter((r) => r.correct).length;
  const card = useRoundCard(title, results, score, outcome);
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="grid gap-[11px]">
      <div className="flex items-center justify-between gap-2.5 min-h-10">
        <LeaveX to={leaveTo} label="Back to the games" />
        <StreakPill />
      </div>
      <motion.div variants={popIn}
        className="card shadow-lift-sm rounded-[20px] p-3.5 grid gap-2 justify-items-center text-center relative">
        <Burst show={right > 0} />
        <p className="text-[12px] font-extrabold text-soft">{name} · round done</p>
        <Counter from={0} value={score} className="font-display text-[48px] leading-none" />
        <Seeds big total={results.length} index={-1} results={results.map((r) => r.correct)} />
        <p className="text-[14px] font-semibold text-soft">{right} of {results.length} right</p>
      </motion.div>
      {card && (
        <motion.img variants={riseIn} src={card.url} alt={`${name}: ${right} of ${results.length}, ${score} points`}
          className="w-full rounded-[18px] shadow-lift" />
      )}
      <motion.div variants={riseIn} className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
        {title ? <ShareButtons card={card} story={false} className="contents" /> : <span />}
        <button onClick={onAgain} className="cut tap cut-board min-h-[52px] font-display text-[19px]">Play again</button>
      </motion.div>
      {children && (
        <motion.details variants={riseIn} className="group">
          <summary className="list-none cursor-pointer text-center text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] grid place-items-center">
            <span className="group-open:hidden">See your answers</span><span className="hidden group-open:inline">Hide your answers</span>
          </summary>
          <div className="mt-1">{children}</div>
        </motion.details>
      )}
      <UnlockGate outcome={outcome ?? null} />
    </motion.div>
  );
}
