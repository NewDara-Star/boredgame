import { useEffect, useMemo, useState } from "react";
import { RAMPS } from "@/shared/brand/tokens";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Art } from "@/shared/brand/Art";
import { SPRING } from "@/shared/ui/motion";
import { RankBadge } from "./RankBadge";
import { rankFor, RANKS, type Rank } from "./rank";
import { milestoneAt } from "./streak";
import type { RoundOutcome } from "./progress";
import type { MatchCard } from "@/shared/card/frame";
import { rankStory, streakStory } from "@/shared/card/moments";
import { ShareButtons } from "@/shared/card/ShareButtons";

export type Unlock =
  | { kind: "rank"; rank: Rank }
  | { kind: "streak"; days: number; name: string };

/**
 * Crossing a line is the thing worth celebrating, not standing past it — which
 * is why this needs the before/after pair and not just the current totals.
 * A rank beats a streak when both land at once; you only get one moment.
 */
export function unlockFrom(o: RoundOutcome | null): Unlock | null {
  if (!o) return null;
  // The totals can go backwards or arrive missing — a failed RPC, a profile row
  // that is not there yet — and comparing keys alone then fired "NEW RANK:
  // Novice, 0 questions answered" at someone who had just played eight rounds.
  // Only ever celebrate a move UP, and only when the count actually went up.
  if (!(o.answeredAfter > o.answeredBefore)) return null;
  const beforeIdx = RANKS.findIndex((r) => r.key === rankFor(o.answeredBefore).current.key);
  const afterIdx = RANKS.findIndex((r) => r.key === rankFor(o.answeredAfter).current.key);
  if (afterIdx > beforeIdx) return { kind: "rank", rank: RANKS[afterIdx] };
  if (o.streak > o.streakBefore) {
    const m = milestoneAt(o.streak);
    if (m) return { kind: "streak", days: m.days, name: m.name };
  }
  return null;
}

const BITS = [RAMPS.ember.base, RAMPS.sky.base, RAMPS.petal.base, RAMPS.leaf.base, RAMPS.grape.base, RAMPS.gum.base];

/** Paper confetti: flat squares on an ink outline, same as every other piece. */
function Confetti() {
  if (useReducedMotion()) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 26 }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 9) * 0.11;
        const drift = ((i % 5) - 2) * 16;
        return (
          <motion.span key={i}
            className="absolute top-0 w-2.5 h-3 rounded-[3px] shadow-lift-sm"
            style={{ left: `${left}%`, background: BITS[i % BITS.length] }}
            initial={{ y: -30, opacity: 0, rotate: 0 }}
            animate={{ y: 420, opacity: [0, 1, 1, 0], x: drift, rotate: 540 * (i % 2 ? 1 : -1) }}
            transition={{ duration: 1.5 + (i % 4) * 0.2, delay, ease: "easeIn" }} />
        );
      })}
    </div>
  );
}

/** The brand's burst: a seed spiral out from behind the card (each seed 137.5°
    round from the last), turning slowly. The drawings (#6, #7) sketch sun
    rays here; the brand swapped rays for seeds (Daramola). */
function SeedBurst() {
  const still = useReducedMotion();
  const dots = [];
  for (let k = 1; k <= 320; k++) {
    const a = k * 2.39996, r = 11 * Math.sqrt(k), d = 1 + (4.2 * k) / 320;
    dots.push(<circle key={k} cx={(r * Math.cos(a)).toFixed(1)} cy={(r * Math.sin(a)).toFixed(1)} r={d.toFixed(1)} />);
  }
  return (
    <motion.svg aria-hidden viewBox="-210 -210 420 420" className="absolute left-1/2 top-1/2 w-[150vmax] h-[150vmax] -translate-x-1/2 -translate-y-1/2"
      fill="white" opacity={0.35}
      initial={{ scale: 0.2, rotate: 0 }} animate={{ scale: 1, rotate: still ? 0 : 40 }}
      transition={{ scale: { type: "spring", stiffness: 120, damping: 18 }, rotate: { duration: 30, ease: "linear" } }}>
      {dots}
    </motion.svg>
  );
}

/**
 * #6 rank up and #7 streak milestone, from the drawings' code: the whole
 * screen goes gold (a rank) or ember (a streak), the seeds burst behind one
 * white card (.card.center): the label, the badge or the flame, the name, one
 * line, then Share it (gold) and Nice (white); a rank also offers the road.
 */
export function UnlockOverlay({ unlock, onClose }: { unlock: Unlock; onClose: () => void }) {
  // Escape closes it. A celebration you cannot dismiss stops being one.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const isRank = unlock.kind === "rank";
  // Drawn as the overlay opens, so the share tap has a file ready (share.ts).
  const [card, setCard] = useState<MatchCard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (unlock.kind === "rank" ? rankStory(unlock.rank) : streakStory(unlock.days, unlock.name))
      .then((m) => { if (!cancelled) setCard(m); })
      .catch(() => { /* no canvas: the overlay still says it */ });
    return () => { cancelled = true; };
  }, [unlock]);
  const ramp = isRank ? "petal" : "ember";
  const bloom = isRank && unlock.rank.key === "accomplished";
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center px-[18px] overflow-hidden"
      style={{ background: `linear-gradient(var(--color-${ramp}-hi), var(--color-${ramp}-lo))` }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={isRank ? "New rank" : "Streak"}>
      <SeedBurst />
      <Confetti />
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="card relative w-full max-w-[360px] rounded-[20px] shadow-lift px-[18px] py-[22px] grid gap-2 justify-items-center text-center text-ink"
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 20, opacity: 0 }}
        transition={{ ...SPRING, stiffness: 300, damping: 20 }}>
        <span className="text-[12px] font-extrabold text-soft">{isRank ? "New rank" : "Streak"}</span>
        {isRank ? (
          <RankBadge rank={unlock.rank.key} size={120} animate />
        ) : (
          <>
            <motion.span initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <Art name="streak" style={{ width: 96 }} />
            </motion.span>
            <b className="font-display font-normal text-[52px] leading-none tabular-nums">{unlock.days}</b>
          </>
        )}
        <h2 className={`font-display leading-[1.1] ${isRank ? "text-[30px]" : "text-[22px]"}`}>
          {isRank ? unlock.rank.name : unlock.name}
        </h2>
        <p className="text-[14px] font-semibold text-soft">
          {isRank
            ? `${unlock.rank.min.toLocaleString()} questions answered.${bloom ? " Your flower's in bloom." : ""}`
            : `${unlock.days} days in a row. Come back tomorrow to keep it.`}
        </p>
        <div className="grid gap-[9px] w-full">
          <ShareButtons card={card} story={false} label="Share it" />
          <button onClick={onClose} className="cut tap cut-board w-full min-h-[52px] font-display text-[19px]">Nice</button>
        </div>
        {isRank && (
          <Link to="/you/road" onClick={onClose}
            className="text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] grid place-items-center -mb-2">
            See every rank
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Waits for the score to finish counting before interrupting it. */
export function UnlockGate({ outcome }: { outcome: RoundOutcome | null }) {
  const unlock = useMemo(() => unlockFrom(outcome), [outcome]);
  const [open, setOpen] = useState(false);
  // Closed for THIS outcome. A board game keeps the gate on screen from game to
  // game, and a plain "done" flag meant that after closing one celebration, a
  // rank-up earned in a later game on the same visit never opened.
  const [closedFor, setClosedFor] = useState<RoundOutcome | null>(null);
  const done = closedFor !== null && closedFor === outcome;

  useEffect(() => {
    if (!unlock || done) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [unlock, done]);

  return (
    <AnimatePresence>
      {open && unlock && (
        <UnlockOverlay key="unlock" unlock={unlock}
          onClose={() => { setOpen(false); setClosedFor(outcome); }} />
      )}
    </AnimatePresence>
  );
}
