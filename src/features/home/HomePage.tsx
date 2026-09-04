import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCounts } from "@/features/play/counts";
import { GAMES } from "@/features/play/registry";
import { useProgress } from "@/features/play/useProgress";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { useDailyStatus } from "@/features/daily/useDaily";
import { Avatar } from "@/shared/ui/Avatar";
import { Starburst } from "@/shared/ui/Wordmark";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { WeekStrip } from "./WeekStrip";
import { StatCarousel, type Stat } from "./StatCarousel";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
};

/** A section title with a way through to the whole thing. */
function Head({ title, to, cta = "View all" }: { title: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-baseline justify-between mt-7 mb-3">
      <h2 className="font-display text-[21px] font-semibold">{title}</h2>
      {to && (
        <Link to={to} className="text-[11px] font-black uppercase tracking-wider text-soft
          underline underline-offset-4">{cta}</Link>
      )}
    </div>
  );
}

export function HomePage() {
  const { user, profile, offline } = useAuth();
  const p = useProgress();
  const counts = useCounts();
  const daily = useDailyStatus();
  const { current, next } = rankFor(p.answered);
  const name = profile?.username ?? "there";

  const stats: Stat[] = [
    { label: "Day streak", value: p.streak, bg: p.streak > 0 ? "bg-pop" : "bg-surface",
      note: p.streak === 0 ? "one round starts it" : p.playedToday ? "safe until tomorrow" : "play today to keep it" },
    { label: "Answered", value: p.answered, bg: "bg-surface",
      note: next ? `${next.min - p.answered} to ${next.name}` : "top rank" },
    { label: "Accuracy", value: p.answered ? `${Math.round((p.correct / p.answered) * 100)}%` : "—",
      bg: "bg-acid", note: `${p.correct} right` },
    { label: "Rank", value: current.name, bg: "bg-trivia text-surface",
      note: `${p.bestStreak}-day best run` },
  ];

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="pb-4">
      <motion.div variants={riseIn} className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-soft">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-display text-[32px] leading-[1.05] font-semibold truncate">
            {greeting()}{user ? "," : ""}<br />
            {user ? <span className="text-hot">{name}</span> : <span className="text-hot">stranger</span>}
          </h1>
        </div>
        <Link to="/profile" aria-label="Profile" className="shrink-0">
          {user ? <Avatar id={user.id} name={name} size={52} />
                : <RankBadge rank={current.key} size={46} />}
        </Link>
      </motion.div>

      {/* The one thing everyone is doing at the same time. */}
      {daily.signedIn && (
        <motion.div variants={popIn} className="mt-5">
          <Link to="/daily"
            className={`piece press block p-5 relative overflow-hidden
              ${daily.played === null ? "bg-hot text-surface" : "bg-surface"}`}>
            <Starburst size={82} fill={daily.played === null ? "rgba(255,255,255,.22)" : "var(--color-pop)"}
              className="absolute -right-3 -top-3 rotate-12" />
            <p className="relative text-[10px] font-black uppercase tracking-widest opacity-75">
              Daily challenge
            </p>
            <p className="relative font-display text-[26px] leading-tight font-semibold mt-1">
              {daily.played === null ? "Ten questions, same for everyone"
                : `You got ${daily.played} out of 10`}
            </p>
            <div className="relative flex items-center gap-2 mt-3">
              <div className="flex -space-x-2.5">
                {daily.faces.slice(0, 4).map((f) => (
                  <Avatar key={f.user_id} id={f.user_id} name={f.username} size={30} />
                ))}
              </div>
              {/* Never claim nobody has played while showing their faces: an
                  exact count needs a header that can go missing. */}
              {(() => {
                const n = Math.max(daily.players, daily.faces.length);
                return (
                  <span className={`text-[12px] font-bold ${daily.played === null ? "opacity-90" : "text-soft"}`}>
                    {n === 0 ? "Nobody has played yet — be first"
                      : n === 1 ? "1 person has played"
                      : `${n} have played`}
                  </span>
                );
              })()}
              <span className="flex-1" />
              <span className="font-display text-xl font-semibold">→</span>
            </div>
          </Link>
        </motion.div>
      )}

      <motion.div variants={riseIn} className="mt-3">
        <WeekStrip streak={p.streak} lastPlayed={p.lastPlayed} />
      </motion.div>

      <Head title="Your week" />
      <StatCarousel stats={stats} />

      <Head title="Games" to="/play" />
      <motion.div variants={stagger(0.06)} className="grid gap-3 sm:grid-cols-3">
        {GAMES.slice(0, 3).map((g) => (
          <motion.div key={g.slug} variants={riseIn}>
            <Link to={g.path} className="piece press flex sm:block items-center gap-4 p-4 h-full">
              <div className="shrink-0 sm:mb-3 sm:flex sm:justify-center"><g.Art size={56} /></div>
              <div className="min-w-0">
                <span className={`sticker inline-block text-[9px] font-black uppercase
                  tracking-widest px-2 py-0.5 ${g.chip}`}>{g.badge}</span>
                <h3 className="font-display text-lg font-semibold mt-1.5">{g.name}</h3>
                <p className="text-[12px] text-soft font-semibold leading-snug">{g.tagline}</p>
                <p className="text-[11px] text-soft/70 font-bold mt-1 tabular-nums">
                  {counts[g.bank] ?? 0} in the bank
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {!user && !offline && (
        <motion.div variants={popIn} className="mt-5">
          <Link to="/profile" className="piece press block bg-ink text-paper p-4">
            <p className="font-display text-lg font-semibold">
              {p.answered > 0 ? `${p.answered} answered on this device` : "Playing as a guest"}
            </p>
            <p className="text-[13px] font-semibold opacity-80 mt-0.5">
              Make an account to keep your streak, play the daily and take a place on the board →
            </p>
          </Link>
        </motion.div>
      )}

      <Head title="Play someone" to="/ranks" cta="Leaderboard" />
      <motion.div variants={popIn}>
        <Link to="/rooms" className="piece press block p-4 text-center font-display font-semibold bg-pop">
          Start a room →
        </Link>
      </motion.div>
    </motion.div>
  );
}
