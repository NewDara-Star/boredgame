import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PICTO_SEED } from "@/shared/data/picto";
import { TRIVIA_SEED } from "@/shared/data/trivia";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { readLocal } from "@/features/play/progress";
import { rankFor } from "@/features/play/rank";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";

export function HomePage() {
  const p = readLocal();
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

      <div className="grid gap-4 mt-7 sm:grid-cols-2">
        <motion.div variants={riseIn}>
          <Link to="/picto" className="piece press block p-5 h-full">
            <div className="h-28 text-picto mb-4">
              <PictoRenderer spec={{ items: teaser.items }} animate seed={teaser.slug} />
            </div>
            <span className="inline-block text-[10px] font-black uppercase tracking-widest
              bg-picto text-surface rounded-full px-2.5 py-1">Word puzzle</span>
            <h2 className="text-2xl font-semibold mt-2">Picto Phrase</h2>
            <p className="text-sm text-soft mt-1 font-semibold">Read the picture, name the phrase.</p>
            <p className="text-xs text-soft/70 mt-3 font-bold">{PICTO_SEED.length} puzzles</p>
          </Link>
        </motion.div>

        <motion.div variants={riseIn}>
          <Link to="/trivia" className="piece press block p-5 h-full">
            <div className="h-28 mb-4 grid place-items-center">
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
            <p className="text-xs text-soft/70 mt-3 font-bold">{TRIVIA_SEED.length} questions</p>
          </Link>
        </motion.div>
      </div>

      <motion.div variants={riseIn} className="piece mt-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-soft">Your rank</span>
          <span className="text-xs font-bold text-soft tabular-nums">{p.answered} answered</span>
        </div>
        <p className="font-display text-3xl font-semibold mt-1">{current.name}</p>
        <div className="h-4 bg-sand rounded-full mt-3 overflow-hidden border-2 border-ink">
          <motion.div className="h-full bg-pop"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.4 }} />
        </div>
        <p className="text-xs text-soft mt-2 font-bold">
          {next ? `${next.min - p.answered} more to ${next.name}` : "Top rank reached"}
        </p>
      </motion.div>

      <motion.div variants={popIn} className="mt-4">
        <Link to="/rooms"
          className="piece press block p-4 text-center font-display font-semibold bg-pop">
          Head-to-head — race someone on the same puzzle →
        </Link>
      </motion.div>
    </motion.div>
  );
}
