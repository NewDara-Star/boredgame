import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCounts } from "@/features/play/counts";
import { GAMES } from "@/features/play/registry";
import { useProgress } from "@/features/play/useProgress";
import { useAuth } from "@/app/providers/AuthProvider";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { Starburst } from "@/shared/ui/Wordmark";

export function HomePage() {
  const { user, offline } = useAuth();
  const p = useProgress();
  const counts = useCounts();
  const { current, next, progress } = rankFor(p.answered);

  return (
    <motion.div variants={stagger(0.09)} initial="hidden" animate="show">
      <motion.div variants={riseIn} className="relative">
        <Starburst size={52} fill="var(--color-hot)"
          className="absolute -top-3 right-1 rotate-12" />
        <h1 className="text-[42px] leading-[0.95] font-semibold relative">
          {GAMES.length === 3 ? "Three games." : `${GAMES.length} games.`}<br />
          <span className="text-hot">Pick your poison.</span>
        </h1>
      </motion.div>
      <motion.p variants={riseIn} className="text-soft mt-3 text-[15px] max-w-sm font-semibold">
        Short rounds, no ads, no feed. Built to be opened for four minutes and closed again.
      </motion.p>

      <motion.div variants={stagger(0.07)} className="grid gap-4 mt-7 sm:grid-cols-3">
        {GAMES.slice(0, 3).map((g) => (
          <motion.div key={g.slug} variants={riseIn}>
            <Link to={g.path} className="piece press block p-5 h-full">
              <div className="mb-4 flex justify-center"><g.Art size={92} /></div>
              <span className={`sticker inline-block text-[10px] font-black uppercase
                tracking-widest px-2.5 py-1 ${g.chip}`}>{g.badge}</span>
              <h2 className="text-2xl font-semibold mt-2">{g.name}</h2>
              <p className="text-sm text-soft mt-1 font-semibold">{g.tagline}</p>
              <p className="text-xs text-soft/70 mt-3 font-bold tabular-nums">
                {counts[g.bank] ?? 0} in the bank
              </p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {GAMES.length > 3 && (
        <motion.div variants={riseIn} className="mt-3">
          <Link to="/play"
            className="piece press block p-3.5 text-center font-display font-semibold">
            All {GAMES.length} games →
          </Link>
        </motion.div>
      )}

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
