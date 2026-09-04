import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { stagger, riseIn, popIn, SPRING } from "@/shared/ui/motion";
import { UnlockGate } from "@/features/play/Unlock";
import { Board } from "./Board";
import { QuestionPanel, Timer } from "./QuestionPanel";
import { describe, type Mark } from "./rules";
import { useSquareOff } from "./useSquareOff";
import { drawMatchCard, downloadCard } from "./matchCard";

function Side({ mark, name, active, score }:
  { mark: Mark; name: string; active: boolean; score: number }) {
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
      <span className="font-display text-lg font-semibold tabular-nums leading-none">{score}</span>
    </motion.div>
  );
}

export function SquareOffPage() {
  const s = useSquareOff();
  const g = s.game;
  const [card, setCard] = useState<string | null>(null);

  const sides = [
    { mark: "x" as Mark, name: "You", score: s.wins.x },
    { mark: "o" as Mark, name: "The bot", score: s.wins.o },
  ];
  const sig = `${s.wins.x}-${s.wins.o}`;
  useEffect(() => {
    if (!s.ended) { setCard(null); return; }
    let cancelled = false;
    void drawMatchCard(null, sides[0], sides[1])
      .then((url) => { if (!cancelled) setCard(url); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ended, sig]);

  if (s.ended) {
    const lead = s.wins.x === s.wins.o ? "All square"
      : s.wins.x > s.wins.o ? "You take the session" : "The bot takes the session";
    return (
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={popIn} className={`piece p-6 text-center ${
          s.wins.x === s.wins.o ? "bg-sand"
            : s.wins.x > s.wins.o ? "bg-good text-surface" : "bg-bad text-surface"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Session over</p>
          <p className="font-display text-3xl font-semibold mt-1">{lead}</p>
          <p className="font-display text-6xl font-semibold tabular-nums mt-3">
            {s.wins.x} <span className="opacity-40">—</span> {s.wins.o}
          </p>
        </motion.div>
        {card ? (
          <>
            <img src={card} alt={`Square Off session: you ${s.wins.x}, the bot ${s.wins.o}`}
              className="w-full rounded-2xl border-[3px] border-ink" />
            <button onClick={() => downloadCard(card, null)}
              className="piece press w-full py-4 font-display text-lg font-semibold bg-pop">
              Save the image
            </button>
          </>
        ) : (
          <div className="piece grid place-items-center aspect-square bg-surface">
            <p className="text-sm font-bold text-soft">Drawing the result…</p>
          </div>
        )}
        <button onClick={s.newSession}
          className="piece press w-full py-3.5 font-display font-semibold">
          Start a new session
        </button>
      </motion.div>
    );
  }

  if (s.loading) return <p className="text-soft font-bold">Dealing questions…</p>;

  const active: Mark = g.phase === "asking" && g.answerer ? g.answerer : g.turn;
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] leading-none font-semibold">Square Off</h1>
        <div className="flex gap-2">
          <Side mark="x" name="You" score={s.wins.x} active={active === "x" && g.phase !== "over"} />
          <Side mark="o" name="Bot" score={s.wins.o} active={active === "o" && g.phase !== "over"} />
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
