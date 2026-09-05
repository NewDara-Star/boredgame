import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { stagger, riseIn, popIn, SPRING } from "@/shared/ui/motion";
import { Board } from "./Board";
import { useSortRace } from "./useSortRace";
import type { Level } from "./rules";

const LEVELS: Level[] = ["easy", "medium", "hard"];

/**
 * Ball Sort, raced against the bot.
 *
 * Your board is the big one. The bot's is small and live, so the race is
 * visible without stealing the screen from the thing you are actually doing —
 * the point of showing it at all is the moment you glance up and see it is a
 * tube ahead of you.
 */
export function SortRacePage() {
  const [level, setLevel] = useState<Level>("medium");
  const r = useSortRace(level);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (r.winner) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [r.winner, r.startedAt]);
  const seconds = Math.max(0, Math.floor(((r.finishedAt ?? now) - r.startedAt) / 1000));

  if (r.ended) {
    const lead = r.wins.me === r.wins.bot ? "All square"
      : r.wins.me > r.wins.bot ? "You take the session" : "The bot takes the session";
    return (
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={popIn} className={`piece p-6 text-center ${
          r.wins.me === r.wins.bot ? "bg-sand"
            : r.wins.me > r.wins.bot ? "bg-good text-surface" : "bg-bad text-surface"}`}>
          <p className="text-[12px] font-black uppercase tracking-widest opacity-70">Session over</p>
          <p className="font-display text-3xl font-semibold mt-1">{lead}</p>
          <p className="font-display text-6xl font-semibold tabular-nums mt-3">
            {r.wins.me} <span className="opacity-40">—</span> {r.wins.bot}
          </p>
        </motion.div>
        <button onClick={r.newSession}
          className="piece press w-full py-3.5 font-display font-semibold">
          Start a new session
        </button>
      </motion.div>
    );
  }

  const over = !!r.winner;
  const overPar = r.me.moves - r.puzzle.par;

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[26px] leading-none font-semibold whitespace-nowrap">
          Ball Sort Race
        </h1>
        <div className="flex gap-2 shrink-0">
          <Chip name="You" score={r.wins.me} active={!over} />
          <Chip name="Bot" score={r.wins.bot} active={!over} />
        </div>
      </motion.div>

      {/* the race, at a glance: tubes home, moves, the clock */}
      <motion.div variants={riseIn} className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Moves" value={String(r.me.moves)} sub={`par ${r.puzzle.par}`} />
        <Stat label="Time" value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} sub="first to sort" />
        <Stat label="Tubes home" value={`${r.progress.me}`} sub={`bot ${r.progress.bot}`} />
      </motion.div>

      <motion.div variants={popIn} className="piece bg-surface p-3 pt-1">
        <Board tubes={r.me.tubes} cap={r.me.cap} selected={r.selected} refused={r.refused}
          onPick={r.pick} disabled={over} />
      </motion.div>

      <motion.p variants={riseIn} className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {over ? (r.winner === "me" ? "You sorted it first." : "The bot got there first.")
          : r.selected === null ? "Tap a tube to lift its top ball."
          : "Now tap where it goes."}
      </motion.p>

      {over ? (
        <motion.div variants={popIn}
          className={`piece p-6 text-center ${r.winner === "me" ? "bg-good text-surface" : "bg-bad text-surface"}`}>
          <p className="font-display text-3xl font-semibold">
            {r.winner === "me" ? "You win" : "The bot wins"}
          </p>
          <p className="text-sm font-bold mt-1 opacity-85">
            {r.winner === "me"
              ? `Solved in ${r.me.moves} — par ${r.puzzle.par}${overPar <= 0 ? ". On the nose." : ` (+${overPar}).`}`
              : `The bot finished in ${r.bot.moves}. You were ${r.progress.me} of ${r.puzzle.colours} tubes home.`}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <button onClick={r.restart}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              Race again
            </button>
            <button onClick={r.endSession}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              End session
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={riseIn} className="flex items-center gap-3">
          <div className="piece bg-sand p-2 shrink-0" style={{ width: 150 }}>
            <p className="text-[12px] font-black uppercase tracking-widest text-soft text-center mb-1">
              The bot · {r.bot.moves} moves
            </p>
            <Board tubes={r.bot.tubes} cap={r.bot.cap} size="mini" />
          </div>
          <div className="flex-1 grid gap-2">
            <button onClick={r.takeBack} disabled={r.me.history.length === 0}
              className="piece press py-3 font-display font-semibold bg-surface">
              Take it back
            </button>
            <div className="flex gap-1.5 justify-center">
              {LEVELS.map((l) => (
                <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
                  className={`text-[12px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border-2 border-ink
                    ${level === l ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Chip({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <motion.div animate={{ opacity: active ? 1 : 0.6 }} transition={SPRING}
      className="piece flex items-center gap-2 px-3 py-2 bg-surface">
      <span className="text-[12px] font-black uppercase tracking-wider">{name}</span>
      <span className="font-display text-xl font-semibold leading-none tabular-nums">{score}</span>
    </motion.div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="piece bg-surface px-2 py-2.5">
      <p className="text-[12px] font-black uppercase tracking-widest text-soft">{label}</p>
      <p className="font-display text-2xl font-semibold leading-none mt-1 tabular-nums">{value}</p>
      <p className="text-[12px] font-bold text-soft mt-1">{sub}</p>
    </div>
  );
}
