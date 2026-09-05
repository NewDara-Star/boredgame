import { useEffect, useState } from "react";
import { Dealing } from "@/shared/ui/Note";
import { motion } from "framer-motion";
import { popIn } from "@/shared/ui/motion";
import { PlayBoard, PlayHead, PlayRow, PlaySurface } from "@/features/play/PlaySurface";
import { UnlockGate } from "@/features/play/Unlock";
import { drawCard, type Glyph, type Hero, type MatchCard } from "@/shared/card/frame";
import { ResultScreen } from "@/features/play/ResultScreen";
import { useSoloBoard } from "@/features/play/useSoloBoard";
import { TurnPanel } from "@/features/rooms/TurnPanel";

/** A sentinel that is never any question's answer, so "wrong" can be expressed
    through the same one-string channel a tapped option uses. */
const NOT_THE_ANSWER = "\u0000";
import type { BoardEngine, BoardRow, BoardState, Mark } from "@/features/rooms/useBoardRoom";

/**
 * How a game draws its own board.
 *
 * It used to be a component with a fixed prop shape, which worked while every
 * board was a grid of marks and broke the moment Memory needed the deck as
 * well. A render function lets each game say what "you may tap this" means for
 * it — Memory's second tap lands during `asking`, where a Square Off board must
 * look untappable.
 */
export type DrawBoard<G> = (p: {
  game: G;
  /** whether it is your turn at all; the phase rule is the game's own business */
  myTurn: boolean;
  /** the width the screen can spare — see PlayBoard. Boards draw to it rather
      than to the width of the phone, so a question is never below the fold. */
  width: number;
  onPick: (i: number) => void;
}) => JSX.Element;

/** how wide each board is for its height: 1 for the square ones, a little
    wider than square for Connect 4's seven columns and its numbers. */
export const BOARD_RATIO = { square: 1, connect4: 1.09 };

/**
 * One player against the bot, whichever board.
 *
 * Square Off had this screen to itself and the other three shipped as rooms
 * only — which meant the games meant for someone's younger sister could not be
 * played unless she was holding a second phone.
 */
export function BoardSoloPage<G extends BoardState & { target: number | null; line: number[] | null },
                              R extends BoardRow>({
  engine, title, board, glyphs, ratio = BOARD_RATIO.square,
  plain = false, challenge = "trivia", score, art,
}: {
  engine: BoardEngine<G, R>;
  title: string;
  board: DrawBoard<G>;
  /** the board's width over its height, so it can be fitted to the space left */
  ratio?: number;
  glyphs: Record<Mark, string>;
  /** the result card's picture: the game draws its final board on it */
  art?: { hero: (g: G) => Hero; glyph?: Glyph; caption?: (g: G) => string | undefined };
  plain?: boolean;
  challenge?: "trivia" | "catapult" | "none";
  /** What the two chips count during play. Defaults to games won this session;
      Memory counts pairs, because that is the number you are playing for. */
  score?: (g: G) => Record<Mark, number>;
}) {
  const s = useSoloBoard(engine, plain, challenge);
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
    const winner = s.wins.x === s.wins.o ? null : s.wins.x > s.wins.o ? sides[0] : sides[1];
    void drawCard({
      title: title.toUpperCase(), code: null,
      headline: winner ? `${winner.name} win${winner.mark === "x" ? "" : "s"}` : "All square",
      hero: art?.hero(g) ?? (() => {}),
      glyph: art?.glyph, caption: art?.caption?.(g),
      sides: [sides[0], sides[1]],
    })
      .then((made) => { if (!cancelled) setCard(made); })
      .catch(() => { /* canvas unavailable; the score is still on screen */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ended, sig]);

  if (s.ended) {
    return (
      <ResultScreen
        headline={s.wins.x === s.wins.o ? "All square"
          : s.wins.x > s.wins.o ? "You take it" : "The bot takes it"}
        score={`${s.wins.x} — ${s.wins.o}`}
        tone={s.wins.x === s.wins.o ? "draw" : s.wins.x > s.wins.o ? "win" : "loss"}
        card={card}
        alt={`${title} session: you ${s.wins.x}, the bot ${s.wins.o}`}>
        <button onClick={s.newSession}
          className="piece press py-3.5 font-display text-lg font-semibold bg-surface">
          New session
        </button>
      </ResultScreen>
    );
  }

  if (s.loading) return <Dealing what="the questions" />;

  const live = score ? score(g) : s.wins;
  const answerer = engine.answerer(g);
  const active: Mark = g.phase === "asking" && answerer ? answerer : g.turn;
  const revealed = g.phase === "revealed" || g.phase === "over";

  const over = g.phase === "over";
  return (
    <PlaySurface>
      <PlayHead title={title} seats={[
        { mark: "x", name: "You", glyph: glyphs.x, score: live.x, active: active === "x" && !over },
        { mark: "o", name: "Bot", glyph: glyphs.o, score: live.o, active: active === "o" && !over },
      ]} />

      {/* The board takes what is left after the fixed parts, and shrinks
          rather than pushing them off the bottom. When a question is up on a
          short phone that can be 100px — small, but the board is reference
          then, and the four answers are the screen. */}
      <PlayBoard ratio={ratio} min={78}>
        {(width) => board({ game: g, myTurn: s.myTurn, width, onPick: s.choose })}
      </PlayBoard>

      {/* The board cannot say "you missed, so the bot gets one shot at it". */}
      <PlayRow>
        <p className="text-center text-[15px] font-bold text-soft">
          {engine.describe(g, s.names, "x")}
        </p>
      </PlayRow>

      {over ? (
        <PlayRow>
        <motion.div variants={popIn} initial="hidden" animate="show" className={`piece p-4 text-center
          ${g.winner === "x" ? "bg-good text-surface"
            : g.winner === "o" ? "bg-bad text-surface" : "bg-sand"}`}>
          <p className="font-display text-2xl font-semibold">
            {g.winner === "x" ? "You win" : g.winner === "o" ? "The bot wins" : "Draw"}
            {s.results.length > 0 && (
              <span className="text-sm font-bold opacity-80">
                {" · "}{s.results.filter((r) => r.correct).length} of {s.results.length} right
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button onClick={s.restart}
              className="piece press py-3 font-display text-lg font-semibold bg-surface text-ink">
              Play again
            </button>
            <button onClick={s.endSession}
              className="piece press py-3 font-display text-lg font-semibold bg-surface text-ink">
              End session
            </button>
          </div>
        </motion.div>
        </PlayRow>
      ) : (g.phase === "asking" || g.phase === "revealed") ? (
        <PlayRow>
          {/* The same panel the rooms draw. It only reached three copies
              because solo advances on a timer and a room can be stuck, so they
              looked different — but the difference is one nullable prop. */}
          <TurnPanel
            challenge={challenge === "catapult" ? "catapult" : "trivia"}
            item={s.item} options={s.options}
            chosen={s.chosen} setChosen={() => {}}
            onAnswer={(correct) => (challenge === "catapult"
              ? s.fire(correct)
              : s.submit(correct ? s.item?.answer ?? null : NOT_THE_ANSWER))}
            asking={g.phase === "asking"} revealed={revealed} mine={s.iAnswer}
            fraction={s.fraction} askedAt={0} target={s.target}
            waitingOn="The bot"
            botShot={s.botFires}
            advanceOwner={null} stall={null} myMark="x"
            onAdvanceNow={() => {}} onForceAdvance={() => {}} nextLabel="Next" />
        </PlayRow>
      ) : null}

      <UnlockGate outcome={s.outcome} />
    </PlaySurface>
  );
}
