import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PICTO_SEED } from "@/shared/data/picto";
import { useCounts } from "@/features/play/counts";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { useProgress } from "@/features/play/useProgress";
import { useAuth } from "@/app/providers/AuthProvider";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";

export function HomePage() {
  const { user, offline } = useAuth();
  const p = useProgress();
  const counts = useCounts();
  const { current, next, progress } = rankFor(p.answered);
  const teaser = PICTO_SEED[Math.floor(Math.random() * PICTO_SEED.length)];

  return (
    <motion.div variants={stagger(0.09)} initial="hidden" animate="show">
      <motion.h1 variants={riseIn} className="text-[42px] leading-[0.95] font-semibold">
        Two games.<br />
        <span className="text-picto">Pick your poison.</span>
      </motion.h1>
      <motion.p variants={riseIn} className="text-soft mt-3 text-[15px] max-w-sm font-semibold">
        Short rounds, no ads, no feed. Built to be opened for four minutes and closed again.
      </motion.p>

      <div className="grid gap-4 mt-7 sm:grid-cols-3">
        <motion.div variants={riseIn}>
          <Link to="/picto" className="piece press block p-5 h-full">
            <div className="h-24 text-picto mb-4">
              <PictoRenderer spec={{ items: teaser.items }} animate seed={teaser.slug} />
            </div>
            <span className="inline-block text-[10px] font-black uppercase tracking-widest
              bg-picto text-surface rounded-full px-2.5 py-1">Word puzzle</span>
            <h2 className="text-2xl font-semibold mt-2">Picto Phrase</h2>
            <p className="text-sm text-soft mt-1 font-semibold">Read the picture, name the phrase.</p>
            <p className="text-xs text-soft/70 mt-3 font-bold">{counts.picto} puzzles</p>
          </Link>
        </motion.div>

        <motion.div variants={riseIn}>
          <Link to="/trivia" className="piece press block p-5 h-full">
            <div className="h-24 mb-4 grid place-items-center">
              <motion.span
                className="text-6xl leading-none text-trivia"
                animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
              >★</motion.span>
            </div>
            <span className="inline-block text-[10px] font-black uppercase tracking-widest
              bg-trivia text-surface rounded-full px-2.5 py-1">Quiz</span>
            <h2 className="text-2xl font-semibold mt-2">Star Trivia</h2>
            <p className="text-sm text-soft mt-1 font-semibold">Four options, one right, ten questions.</p>
            <p className="text-xs text-soft/70 mt-3 font-bold">{counts.trivia} questions</p>
          </Link>
        </motion.div>

        <motion.div variants={riseIn}>
          <Link to="/squareoff" className="piece press block p-5 h-full">
            <div className="h-24 mb-4 grid place-items-center">
              <motion.svg viewBox="0 0 100 100" className="h-full"
                animate={{ rotate: [0, 4, -4, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}>
                <g stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round">
                  <path d="M36 12 V88 M64 12 V88 M12 36 H88 M12 64 H88" />
                </g>
                <g strokeWidth="8" strokeLinecap="round" fill="none">
                  <path d="M18 18 L30 30 M30 18 L18 30" stroke="var(--color-picto)" />
                  <circle cx="50" cy="50" r="9" stroke="var(--color-trivia)" />
                  <path d="M70 70 L82 82 M82 70 L70 82" stroke="var(--color-picto)" />
                </g>
              </motion.svg>
            </div>
            <span className="inline-block text-[10px] font-black uppercase tracking-widest
              bg-ink text-paper rounded-full px-2.5 py-1">Board game</span>
            <h2 className="text-2xl font-semibold mt-2">Square Off</h2>
            <p className="text-sm text-soft mt-1 font-semibold">Answer right to claim a square.</p>
            <p className="text-xs text-soft/70 mt-3 font-bold">Solo or head-to-head</p>
          </Link>
        </motion.div>
      </div>

      <motion.div variants={riseIn} className="piece mt-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-soft">Your rank</span>
          <span className="text-xs font-bold text-soft tabular-nums">{p.answered} answered</span>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <RankBadge rank={current.key} size={56} animate />
          <p className="font-display text-3xl font-semibold">{current.name}</p>
        </div>
        <div className="h-4 bg-sand rounded-full mt-3 overflow-hidden border-2 border-ink">
          <motion.div className="h-full bg-pop"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.4 }} />
        </div>
        <p className="text-xs text-soft mt-2 font-bold">
          {next ? `${next.min - p.answered} more to ${next.name}` : "Top rank reached"}
        </p>

        {/* The streak line is the one that decides whether today gets a round,
            so it sits under the rank rather than on a page nobody opens. */}
        <div className="flex items-center gap-2.5 mt-4 pt-4 border-t-2 border-sand">
          <span className={`grid place-items-center h-9 w-9 rounded-full border-[2.5px] border-ink
            font-display font-semibold tabular-nums text-sm shrink-0
            ${p.streak > 0 ? "bg-pop" : "bg-sand text-soft"}`}>
            {p.streak}
          </span>
          <p className="text-xs font-bold text-soft">
            {p.streak === 0
              ? "No streak going. One round today starts one."
              : p.playedToday
                ? `${p.streak}-day streak, safe until tomorrow.`
                : `${p.streak}-day streak — play today to keep it.`}
          </p>
        </div>
      </motion.div>

      {/* The moment someone has something to lose is the moment to mention an
          account. Before that it is just a form in the way. */}
      {!user && !offline && p.answered > 0 && (
        <motion.div variants={popIn} className="mt-4">
          <Link to="/profile" className="piece press block bg-ink text-paper p-4">
            <p className="font-display text-lg font-semibold">
              {p.answered} answered on this device
            </p>
            <p className="text-[13px] font-semibold opacity-80 mt-0.5">
              Create an account to keep them, and to take a place on the leaderboard →
            </p>
          </Link>
        </motion.div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        <motion.div variants={popIn}>
          <Link to="/rooms"
            className="piece press block p-4 text-center font-display font-semibold bg-pop h-full">
            Head-to-head →
          </Link>
        </motion.div>
        <motion.div variants={popIn}>
          <Link to="/ranks"
            className="piece press block p-4 text-center font-display font-semibold h-full">
            Leaderboard →
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
