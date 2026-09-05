import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Cell } from "@/features/squareoff/rules";
import { stagger, riseIn, popIn, SPRING } from "@/shared/ui/motion";
import { UnlockGate } from "@/features/play/Unlock";
import { QuestionPanel, Timer } from "@/features/squareoff/QuestionPanel";
import { drawMatchCard, saveCard, type MatchCard } from "@/features/squareoff/matchCard";
import { useSoloBoard } from "@/features/play/useSoloBoard";
import type { BoardEngine, BoardRow, BoardState, Mark } from "@/features/rooms/useBoardRoom";

function Side({ mark, name, active, score, glyph }:
  { mark: Mark; name: string; active: boolean; score: number; glyph: string }) {
  return (
    <motion.div
      animate={{ scale: active ? 1 : 0.94, opacity: active ? 1 : 0.5 }}
      transition={SPRING}
      className={`piece flex items-center gap-2 px-3 py-2 ${active ? "bg-pop" : "bg-surface"}`}>
      <span className="font-display text-xl font-semibold leading-none"
        style={{ color: mark === "x" ? "var(--color-picto)" : "var(--color-trivia)" }}>
        {glyph}
      </span>
      <span className="text-[13px] font-black uppercase tracking-wide">{name}</span>
      <span className="font-display text-lg font-semibold tabular-nums leading-none">{score}</span>
    </motion.div>
  );
}

/** Both boards take exactly these props, which is why one page can draw either. */
export interface BoardProps {
  board: Cell[];
  target: number | null;
  line: number[] | null;
  canPick: boolean;
  compact?: boolean;
  onPick: (i: number) => void;
}

/**
 * One player against the bot, whichever board.
 *
 * Square Off had this screen to itself and the other three shipped as rooms
 * only — which meant the games meant for someone's younger sister could not be
 * played unless she was holding a second phone.
 */
export function BoardSoloPage<G extends BoardState & { target: number | null; line: number[] | null },
                              R extends BoardRow>({
  engine, title, Board, glyphs, plain = false,
}: {
  engine: BoardEngine<G, R>;
  title: string;
  Board: (p: BoardProps) => JSX.Element;
  glyphs: Record<Mark, string>;
  plain?: boolean;
}) {
  const s = useSoloBoard(engine, plain);
  const g = s.game;
  const [card, setCard] = useState<MatchCard | null>(null);

  const sides = [
    { mark: "x" as Mark, name: "You", score: s.wins.x },
    { mark: "o" as Mark, name: "The bot", score: s.wins.o },
  ];
  const sig = `${title}|${s.wins.x}-${s.wins.o}`;
  useEffect(() => {
    if (!s.ended) { setCard(null); return; }
    let cancelled = false;
    void drawMatchCard(null, sides[0], sides[1], title.toUpperCase())
      .then((made) => { if (!cancelled) setCard(made); })
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
          <p className="text-[12px] font-black uppercase tracking-widest opacity-70">Session over</p>
          <p className="font-display text-3xl font-semibold mt-1">{lead}</p>
          <p className="font-display text-6xl font-semibold tabular-nums mt-3">
            {s.wins.x} <span className="opacity-40">—</span> {s.wins.o}
          </p>
        </motion.div>
        {card ? (
          <>
            <img src={card.url} alt={`${title} session: you ${s.wins.x}, the bot ${s.wins.o}`}
              className="w-full rounded-2xl border-[3px] border-ink" />
            <button onClick={() => saveCard(card.file)}
              className="piece press w-full py-4 font-display text-lg font-semibold bg-pop">
              Save the image
            </button>
            <p className="text-[13px] font-bold text-soft text-center">
              On a phone you can also press and hold the picture to save or share it.
            </p>
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

  const answerer = engine.answerer(g);
  const active: Mark = g.phase === "asking" && answerer ? answerer : g.turn;
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      {/* Wraps rather than squeezing: "Connect 4 Trivia" beside two score chips
          does not fit 390px, and letting the h1 break put "Connect" on one line
          and "4" on the next. */}
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[26px] leading-none font-semibold whitespace-nowrap">
          {title}
        </h1>
        <div className="flex gap-2 shrink-0">
          <Side mark="x" name="You" glyph={glyphs.x} score={s.wins.x}
            active={active === "x" && g.phase !== "over"} />
          <Side mark="o" name="Bot" glyph={glyphs.o} score={s.wins.o}
            active={active === "o" && g.phase !== "over"} />
        </div>
      </motion.div>

      <motion.div variants={popIn}>
        <Board board={g.board} target={g.target} line={g.line}
          canPick={s.myTurnToPick} compact={g.phase === "asking" || g.phase === "revealed"}
          onPick={s.choose} />
      </motion.div>

      {/* The board cannot say "you missed, so the bot gets one shot at it". */}
      <motion.p variants={riseIn}
        className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {engine.describe(g, s.names, "x")}
      </motion.p>

      {g.phase === "over" ? (
        <motion.div variants={popIn} className={`piece p-6 text-center
          ${g.winner === "x" ? "bg-good text-surface"
            : g.winner === "o" ? "bg-bad text-surface" : "bg-sand"}`}>
          <p className="font-display text-3xl font-semibold">
            {g.winner === "x" ? "You win" : g.winner === "o" ? "The bot wins" : "Draw"}
          </p>
          {s.results.length > 0 && (
            <p className="text-sm font-bold mt-1 opacity-80">
              {s.results.filter((r) => r.correct).length} of {s.results.length} questions right
            </p>
          )}
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
