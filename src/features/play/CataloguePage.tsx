import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { stagger, riseIn } from "@/shared/ui/motion";
import { useCounts } from "./counts";
import { GAMES } from "./registry";

/** Past this many, scanning a list stops working and you need to search it. */
const SEARCH_AT = 8;

export function CataloguePage() {
  const counts = useCounts();
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GAMES;
    return GAMES.filter((g) =>
      `${g.name} ${g.tagline} ${g.badge}`.toLowerCase().includes(needle));
  }, [q]);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.h1 variants={riseIn} className="font-display text-[32px] leading-none font-semibold">
        All games
      </motion.h1>
      <motion.p variants={riseIn} className="text-soft text-sm font-semibold mt-2">
        {GAMES.length} to play, on your own or against someone.
      </motion.p>

      {GAMES.length > SEARCH_AT && (
        <motion.input variants={riseIn} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search games" type="search"
          className="w-full mt-4 bg-surface border-[2.5px] border-ink rounded-2xl px-4 py-3
            font-bold text-ink placeholder:text-soft/60 outline-none
            focus:shadow-[0_5px_0_var(--color-ink)] transition-shadow" />
      )}

      <div className="grid gap-3 mt-5 sm:grid-cols-2">
        {shown.map((g) => {
          // A pure board game has no bank and is always playable; only a game
          // that WANTS content and has none should be greyed out here rather
          // than letting you walk into an empty round.
          const live = g.bank ? counts[g.bank] ?? 0 : null;
          const playable = live === null || live > 0;
          const card = (
            <div className={`piece ${playable ? "press" : ""} p-4 h-full flex items-center gap-4
              ${playable ? "" : "opacity-55"}`}>
              <g.Art size={62} />
              <div className="min-w-0">
                <span className={`inline-block text-[9px] font-black uppercase tracking-widest
                  rounded-full px-2 py-0.5 ${g.chip}`}>{g.badge}</span>
                <h2 className="font-display text-xl font-semibold mt-1">{g.name}</h2>
                <p className="text-[13px] text-soft font-semibold leading-snug">{g.tagline}</p>
                <p className="text-[11px] font-bold text-soft/70 mt-1 tabular-nums">
                  {live === null ? "Head-to-head" : playable ? `${live} in the bank` : "Nothing live yet"}
                  {g.room && playable && live !== null && " · head-to-head"}
                </p>
              </div>
            </div>
          );
          return (
            <motion.div key={g.slug} variants={riseIn}>
              {playable ? <Link to={g.path} className="block h-full">{card}</Link> : card}
            </motion.div>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-soft font-bold mt-6">Nothing matches “{q}”.</p>
      )}
    </motion.div>
  );
}
