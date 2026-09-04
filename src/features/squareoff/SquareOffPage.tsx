import { motion } from "framer-motion";
import { stagger, riseIn, popIn, SPRING } from "@/shared/ui/motion";
import { UnlockGate } from "@/features/play/Unlock";
import { Board } from "./Board";
import { QuestionPanel, Timer } from "./QuestionPanel";
import { describe, type Mark } from "./rules";
import { useSquareOff } from "./useSquareOff";

function Side({ mark, name, active }: { mark: Mark; name: string; active: boolean }) {
  return (
    <motion.div
      animate={{ scale: active ? 1 : 0.94, opacity: active ? 1 : 0.5 }}
      transition={SPRING}
      className={`piece flex items-center gap-2 px-3 py-2 ${active ? "bg-pop" : "bg-surface"}`}>
      <span className="font-display text-xl font-semibold leading-none"
        style={{ color: mark === "x" ? "var(--color-picto)" : "var(--color-trivia)" }}>
        {mark === "x" ? "✕" : "◯"}
      </span>
      <span className="text-[13px] font-black uppercase tracking-wide">{name}</span>
    </motion.div>
  );
}

export function SquareOffPage() {
  const s = useSquareOff();
  const g = s.game;

  if (s.loading) return <p className="text-soft font-bold">Dealing questions…</p>;

  const active: Mark = g.phase === "asking" && g.answerer ? g.answerer : g.turn;
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] leading-none font-semibold">Square Off</h1>
        <div className="flex gap-2">
          <Side mark="x" name="You" active={active === "x" && g.phase !== "over"} />
          <Side mark="o" name="Bot" active={active === "o" && g.phase !== "over"} />
        </div>
      </motion.div>

      <motion.div variants={popIn}>
        <Board board={g.board} target={g.target} line={g.line}
          canPick={s.myTurnToPick} compact={g.phase === "asking" || g.phase === "revealed"}
          onPick={s.choose} />
      </motion.div>

      {/* The board cannot say "she missed, so you get one shot at square 5". */}
      <motion.p variants={riseIn}
        className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, s.names, "x")}
      </motion.p>

      {g.phase === "over" ? (
        <motion.div variants={popIn} className={`piece p-6 text-center
          ${g.winner === "x" ? "bg-good text-surface" : g.winner === "o" ? "bg-bad text-surface" : "bg-sand"}`}>
          <p className="font-display text-3xl font-semibold">
            {g.winner === "x" ? "You win" : g.winner === "o" ? "The bot wins" : "Draw"}
          </p>
          <p className="text-sm font-bold mt-1 opacity-80">
            {s.results.filter((r) => r.correct).length} of {s.results.length} questions right
          </p>
          <button onClick={s.restart}
            className="piece press w-full mt-5 py-3.5 font-display text-lg font-semibold bg-surface text-ink">
            Play again
          </button>
        </motion.div>
      ) : s.item && (g.phase === "asking" || g.phase === "revealed") ? (
        <motion.div variants={riseIn} className="space-y-3">
          {s.iAnswer && !revealed && <Timer fraction={s.fraction} />}
          <QuestionPanel
            item={s.item} options={s.options} chosen={s.chosen}
            revealed={revealed} locked={!s.iAnswer || revealed}
            onAnswer={s.submit} />
        </motion.div>
      ) : null}

      <UnlockGate outcome={s.outcome} />
    </motion.div>
  );
}
