import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { SPRING } from "@/shared/ui/motion";
import { RankBadge } from "./RankBadge";
import { rankFor, RANKS, type Rank } from "./rank";
import { milestoneAt } from "./streak";
import type { RoundOutcome } from "./progress";

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

const BITS = ["#FF5A1F", "#2B4BFF", "#FFD028", "#10A04E"];

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
            className="absolute top-0 w-2.5 h-3 rounded-[3px] border-2 border-ink"
            style={{ left: `${left}%`, background: BITS[i % BITS.length] }}
            initial={{ y: -30, opacity: 0, rotate: 0 }}
            animate={{ y: 420, opacity: [0, 1, 1, 0], x: drift, rotate: 540 * (i % 2 ? 1 : -1) }}
            transition={{ duration: 1.5 + (i % 4) * 0.2, delay, ease: "easeIn" }} />
        );
      })}
    </div>
  );
}

export function UnlockOverlay({ unlock, onClose }: { unlock: Unlock; onClose: () => void }) {
  // Escape closes it. A celebration you cannot dismiss stops being one.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const isRank = unlock.kind === "rank";
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-5 bg-ink/60"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} role="dialog" aria-modal="true">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="piece relative overflow-hidden w-full max-w-[320px] p-7 text-center"
        initial={{ scale: 0.7, y: 30, rotate: -3, opacity: 0 }}
        animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 20, opacity: 0 }}
        transition={{ ...SPRING, stiffness: 300, damping: 20 }}>
        <Confetti />

        <p className="relative z-10 text-[10px] font-black uppercase tracking-widest text-soft">
          {isRank ? "New rank" : "Streak milestone"}
        </p>

        <div className="relative z-10 grid place-items-center h-[104px] my-1">
          {isRank ? (
            <RankBadge rank={unlock.rank.key} size={96} animate />
          ) : (
            <motion.div
              className="piece bg-pop w-[96px] h-[96px] grid place-items-center"
              style={{ borderRadius: 999 }}
              initial={{ scale: 0.3, rotate: -25 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <span className="font-display text-4xl font-semibold tabular-nums leading-none">
                {unlock.days}
              </span>
            </motion.div>
          )}
        </div>

        <motion.h2 className="relative z-10 font-display text-[28px] leading-tight font-semibold"
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.18 }}>
          {isRank ? unlock.rank.name : unlock.name}
        </motion.h2>
        <motion.p className="relative z-10 text-sm text-soft font-semibold mt-1"
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.24 }}>
          {isRank
            ? `${unlock.rank.min} questions answered`
            : `${unlock.days} days in a row. Come back tomorrow to keep it.`}
        </motion.p>

        <motion.div className="relative z-10 mt-6 space-y-2"
          initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.3 }}>
          <button onClick={onClose}
            className="piece press w-full py-3.5 font-display text-lg font-semibold bg-pop">
            Nice
          </button>
          <Link to="/profile" onClick={onClose}
            className="block text-xs font-bold text-soft underline underline-offset-4 py-1">
            See everything you've unlocked
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Waits for the score to finish counting before interrupting it. */
export function UnlockGate({ outcome }: { outcome: RoundOutcome | null }) {
  const unlock = unlockFrom(outcome);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!unlock || done) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [unlock, done]);

  return (
    <AnimatePresence>
      {open && unlock && (
        <UnlockOverlay key="unlock" unlock={unlock}
          onClose={() => { setOpen(false); setDone(true); }} />
      )}
    </AnimatePresence>
  );
}
