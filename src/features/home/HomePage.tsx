import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCounts } from "@/features/play/counts";
import { GAMES } from "@/features/play/registry";
import { useProgress } from "@/features/play/useProgress";
import { readCarry } from "@/features/play/carry";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { useDailyStatus } from "@/features/daily/useDaily";
import { Avatar } from "@/shared/ui/Avatar";
import { Starburst } from "@/shared/ui/Wordmark";
import { Sunflower } from "@/shared/brand/Sunflower";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { WeekStrip } from "./WeekStrip";
import { StatCarousel, type Stat } from "./StatCarousel";
import { Carousel } from "@/shared/ui/Carousel";
import { Invites } from "@/features/friends/Friends";

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
        <Link to={to} className="text-[13px] font-black text-soft
          underline underline-offset-4">{cta}</Link>
      )}
    </div>
  );
}

export function HomePage() {
  const { user, profile, offline } = useAuth();
  const p = useProgress();
  // What an account made now would take with it (F17), not the phone's lifetime tally.
  const kept = user ? 0 : readCarry().rows.length;
  const counts = useCounts();
  const daily = useDailyStatus();
  const { current, next } = rankFor(p.answered);
  const name = profile?.username ?? "there";

  const stats: Stat[] = [
    { label: "Day streak", value: p.streak, bg: p.streak > 0 ? "bg-petal" : "bg-board",
      note: p.streak === 0 ? "one round starts it" : p.playedToday ? "safe until tomorrow" : "play today to keep it" },
    { label: "Answered", value: p.answered, bg: "bg-board",
      note: next ? `${next.min - p.answered} to ${next.name}` : "top rank" },
    { label: "Accuracy", value: p.answered ? `${Math.round((p.correct / p.answered) * 100)}%` : "—",
      bg: "bg-leaf-hi", note: `${p.correct} right` },
    // The badge is the point of a rank, and it cannot overflow.
    { label: "Rank", art: <RankBadge rank={current.key} size={34} />, headline: current.name,
      bg: "bg-sky text-ink", note: `${p.bestStreak}-day best run` },
  ];

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="pb-4">
      <Invites />
      <motion.div variants={riseIn} className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-soft">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-display text-[32px] leading-[1.05] font-semibold truncate">
            {greeting()}{user ? "," : ""}<br />
            {user ? name : "stranger"}
          </h1>
        </div>
        {/* The flower says how the day is going: bored until you've played today. */}
        <Link to="/play" aria-label="Play something" className="shrink-0 -mb-2">
          <Sunflower state={p.playedToday ? "awake" : "bored"} size={74} />
        </Link>
      </motion.div>

      {/* The one thing everyone is doing at the same time. */}
      {daily.signedIn && (
        <motion.div variants={popIn} className="mt-5">
          <Link to="/daily"
            className={`cut tap block p-5 relative overflow-hidden
              ${daily.played === null ? "cut-petal text-ink" : "bg-board"}`}>
            <Starburst size={82}
              className="absolute -right-3 -top-3 rotate-12" />
            <p className="relative text-[12px] font-black opacity-75">
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
      <motion.div variants={stagger(0.06)}>
        <Carousel>
          {GAMES.map((g) => (
            <motion.div key={g.slug} variants={riseIn} className="snap-start shrink-0 w-[168px]">
              <Link to={g.path} className="card tap flex flex-col h-full p-4">
                <div className="h-[72px] grid place-items-center mb-3"><g.Art size={68} /></div>
                {/* nowrap and ordinary tracking: at 12px "WORD PUZZLE" with widest
                    tracking broke over two lines in a carousel card. Letter-spacing
                    is what was costing the width, not the size. */}
                <span className={`chip inline-block self-start whitespace-nowrap text-[12px]
                  font-black px-2 py-0.5 ${g.chip}`}>{g.badge}</span>
                <h3 className="font-display text-[17px] leading-tight font-semibold mt-2">{g.name}</h3>
                <p className="text-[12px] text-soft font-semibold leading-snug line-clamp-3 mt-0.5">
                  {g.tagline}
                </p>
                <span className="flex-1" />
                <p className="text-[13px] text-soft/70 font-bold mt-2 tabular-nums">
                  {g.bank ? `${counts[g.bank] ?? 0} in the bank` : "Head-to-head"}
                </p>
              </Link>
            </motion.div>
          ))}

          {/* Swiping to the end lands somewhere, rather than stopping dead. */}
          <motion.div variants={riseIn} className="snap-start shrink-0 w-[132px]">
            <Link to="/play"
              className="card tap flex flex-col items-center justify-center h-full p-4 bg-mist text-center">
              <span className="font-display text-3xl font-semibold leading-none">→</span>
              <span className="font-display text-[15px] font-semibold mt-2 leading-tight">
                All {GAMES.length} games
              </span>
            </Link>
          </motion.div>
        </Carousel>
      </motion.div>

      {!user && !offline && (
        <motion.div variants={popIn} className="mt-5">
          <Link to="/profile" className="cut tap block cut-ink text-ground p-4">
            <p className="font-display text-lg font-semibold">
              {kept > 0 ? `${kept} answer${kept === 1 ? "" : "s"} on this phone` : "Playing signed out"}
            </p>
            <p className="text-[13px] font-semibold opacity-80 mt-0.5">
              {kept > 0
                ? "Make an account and they come with you, with up to 7 days of streak →"
                : "Make an account to keep your answers and streak, play the daily and take a place on the board →"}
            </p>
          </Link>
        </motion.div>
      )}

      <Head title="Play someone" to="/ranks" cta="Leaderboard" />
      <motion.div variants={popIn}>
        <Link to="/rooms" className="cut tap block p-4 text-center font-display font-semibold cut-petal">
          Start a room →
        </Link>
      </motion.div>
    </motion.div>
  );
}
