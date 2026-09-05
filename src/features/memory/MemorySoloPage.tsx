import { motion } from "framer-motion";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { useSoloBoard } from "@/features/play/useSoloBoard";
import { Board } from "./Board";
import { MEMORY } from "./useMemoryRoom";
import { describe, scoreOf, type Mark } from "./rules";

/**
 * Memory against the bot. Its recall is a span of the last six tiles it was
 * shown — enough that it plays like someone paying attention, short enough that
 * paying MORE attention beats it, which is the only reason this is worth
 * playing against a machine at all.
 */
export function MemorySoloPage() {
  const s = useSoloBoard(MEMORY, false, "none");
  const g = s.game;
  const names: Record<Mark, string> = { x: "You", o: "The bot" };
  const mine = g.turn === "x";

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[26px] leading-none font-semibold whitespace-nowrap">
          Memory Match
        </h1>
        <div className="flex gap-2 shrink-0">
          {(["x", "o"] as Mark[]).map((m) => (
            <div key={m} className={`piece flex items-center gap-2 px-3 py-2
              ${g.turn === m && g.phase !== "over" ? "bg-pop" : "bg-surface"}`}>
              <span className="text-[13px] font-black uppercase tracking-wide">
                {m === "x" ? "You" : "Bot"}
              </span>
              <span className="font-display text-lg font-semibold tabular-nums leading-none">
                {scoreOf(g, m)}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={popIn}>
        <Board game={g} canFlip={mine && (g.phase === "picking" || g.phase === "asking")}
          onFlip={s.choose} />
      </motion.div>

      <motion.p variants={riseIn}
        className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, names, "x")}
      </motion.p>

      {g.phase === "over" && (
        <motion.div variants={popIn} className={`piece p-6 text-center
          ${g.winner === "x" ? "bg-good text-surface"
            : g.winner === "o" ? "bg-bad text-surface" : "bg-sand"}`}>
          <p className="font-display text-3xl font-semibold">
            {g.winner === "x" ? "You win" : g.winner === "o" ? "The bot wins" : "Draw"}
          </p>
          <p className="text-sm font-bold mt-1 opacity-80">
            {scoreOf(g, "x")} pairs to {scoreOf(g, "o")}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <button onClick={s.restart}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              Play again
            </button>
            <button onClick={s.endSession}
              className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              End session
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
