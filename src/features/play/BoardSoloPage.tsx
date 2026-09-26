import { useEffect, useState } from "react";
import type { PieceKind } from "@/shared/brand/Pieces";
import { Dealing } from "@/shared/ui/Note";
import { useNavigate } from "react-router-dom";
import { PlayBoard, PlayRow, PlaySurface, TurnBanner, Seats, GameChip } from "@/features/play/PlaySurface";
import { LeaveX } from "@/features/play/RoundChrome";
import { useFocusMode } from "@/app/layout/focus";
import { useAuth } from "@/app/providers/AuthProvider";
import type { FlowerState } from "@/shared/brand/Sunflower";
import { UnlockGate } from "@/features/play/Unlock";
import { drawCard, type Glyph, type Hero, type MatchCard } from "@/shared/card/frame";
import { botVoice, gamePath } from "@/shared/card/voice";
import { ResultScreen } from "@/features/play/ResultScreen";
import { useSoloBoard } from "@/features/play/useSoloBoard";
import { LEVELS, toggle } from "@/features/play/levels";
import { TurnPanel } from "@/features/rooms/TurnPanel";

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
  plain = false, challenge = "trivia", score, art, youAre, banner, counting = "wins",
}: {
  /** under "Your move": "You're crosses" (#25), "You're gold" (#27) */
  youAre?: string;
  /** a game's own banner for a moment the shared one can't word, e.g. Memory's
      "Pick one more / Is there another heart?" (#29) */
  banner?: (g: G, mine: boolean) => { title: string; sub?: string } | null;
  /** what the seats count: games won, or (Memory) pairs */
  counting?: "wins" | "pairs";

  engine: BoardEngine<G, R>;
  title: string;
  board: DrawBoard<G>;
  /** the board's width over its height, so it can be fitted to the space left */
  ratio?: number;
  glyphs: Record<Mark, PieceKind>;
  /** the result card's picture: the game draws its final board on it */
  art?: { hero: (g: G) => Hero; glyph?: Glyph; caption?: (g: G) => string | undefined };
  plain?: boolean;
  challenge?: "trivia" | "catapult" | "none";
  /** What the two chips count during play. Defaults to games won this session;
      Memory counts pairs, because that is the number you are playing for. */
  score?: (g: G) => Record<Mark, number>;
}) {
  useFocusMode(true);
  const s = useSoloBoard(engine, plain, challenge);
  const g = s.game;
  const nav = useNavigate();
  const { profile } = useAuth();
  const [card, setCard] = useState<MatchCard | null>(null);

  const sides = [
    { mark: "x" as Mark, name: "You", score: s.wins.x },
    { mark: "o" as Mark, name: "The bot", score: s.wins.o },
  ];
  const sig = `${title}|${s.wins.x}-${s.wins.o}`;
  useEffect(() => {
    if (!s.ended) { setCard(null); return; }
    let cancelled = false;
    const v = botVoice(title, s.wins.x, s.wins.o);
    void drawCard({
      title: title.toUpperCase(), code: null, path: gamePath(title),
      headline: v.headline, dare: v.dare, flower: v.flower, text: v.text,
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
    const tone = s.wins.x === s.wins.o ? "draw" : s.wins.x > s.wins.o ? "win" : "loss";
    return (
      <ResultScreen
        headline={tone === "draw" ? "All square with the bot" : tone === "win" ? "You beat the bot" : "The bot beat you"}
        score={`${s.wins.x}–${s.wins.o}`}
        tone={tone}
        card={card}
        alt={`${title} session: you ${s.wins.x}, the bot ${s.wins.o}`}>
        <button onClick={s.newSession}
          className="cut tap cut-board min-h-[52px] font-display text-[19px]">
          New session
        </button>
        <button onClick={() => nav("/play")}
          className="justify-self-center text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px]">
          Back to the games
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
  const mine = active === "x";
  const question = !plain && challenge === "trivia" && (g.phase === "asking" || g.phase === "revealed");
  const shot = challenge === "catapult" && (g.phase === "asking" || g.phase === "revealed");
  const last = (g as unknown as { last: { by: Mark; correct: boolean } | null }).last;
  const said = engine.describe(g, s.names, "x");
  const you = youAre ?? (glyphs.x === "cross" ? "You're crosses" : glyphs.x === "disc" ? "You're gold" : undefined);

  // The banner (.turn), from the drawings: gold when it's yours to do something,
  // white while you wait; the flower turns to whoever is on.
  const own = !over ? banner?.(g, mine) ?? null : null;
  const b: { title: string; sub?: string; tone: "petal" | "white"; flower: FlowerState; end?: string } | null =
    over ? (g.winner === "x" ? { title: "You win this one", tone: "petal", flower: "bloom", end: `${s.wins.x}–${s.wins.o}` }
      : g.winner === "o" ? { title: "The bot wins this one", tone: "white", flower: "bored", end: `${s.wins.x}–${s.wins.o}` }
      : { title: "A draw", sub: said, tone: "white", flower: "awake", end: `${s.wins.x}–${s.wins.o}` })
    : own ? { ...own, tone: mine ? "petal" : "white", flower: mine ? "awake" : "look-right" }
    : g.phase === "revealed" && last ? {
        title: last.by === "x" ? (last.correct ? "Got it" : "Not this time") : (last.correct ? "The bot got it" : "The bot missed"),
        sub: said, tone: "white", flower: last.correct === (last.by === "x") ? "bloom" : "bored" }
    : g.phase === "asking" && shot ? (mine
        ? { title: "Land it in the ring", sub: `For ${said.replace(/^You're going for /, "").replace(/\.$/, "")}`, tone: "petal", flower: "awake" }
        : { title: "The bot's shot", sub: said, tone: "white", flower: "look-right" })
    : g.phase === "asking" && question ? null     // the question sheet says it (#26)
    : g.phase === "asking" ? (mine ? { title: "Your move", sub: said, tone: "petal", flower: "awake" }
        : { title: "The bot's thinking", sub: said, tone: "white", flower: "look-right" })
    : mine ? { title: "Your move", sub: you ?? said, tone: "petal", flower: "awake" }
    : { title: "The bot's thinking", sub: you, tone: "white", flower: "look-right" };

  const count = (n: number) => counting === "pairs" ? `${n} pair${n === 1 ? "" : "s"}` : `${n} win${n === 1 ? "" : "s"}`;
  const me = profile?.username ?? "You";

  // The X (Daramola 26 Sep): with a game finished, it ends the session so the
  // score and its card aren't lost; with none, it's straight back to the games.
  const leave = () => (s.played > 0 ? s.endSession() : nav("/play"));

  return (
    <PlaySurface focus>
      <PlayRow className="flex items-center justify-between gap-2.5 min-h-10">
        <LeaveX onClick={leave} label={s.played > 0 ? "End the session" : "Back to the games"} />
        <GameChip title={title} />
      </PlayRow>

      {b && (
        <TurnBanner title={b.title} sub={b.sub} tone={b.tone} flower={b.flower}
          end={b.end && <b className="font-mono font-bold text-[24px] shrink-0">{b.end}</b>} />
      )}

      {/* How hard (talk item 9): before the first question of each game, so
          it never takes board space mid-game. The phone remembers the pick. */}
      {!plain && challenge === "trivia" && g.phase === "picking" && s.results.length === 0 && (
        <PlayRow>
          <div className="flex items-center gap-1.5" role="group" aria-label="How hard are the questions?">
            <span className="text-[13px] font-extrabold text-soft mr-1">Questions</span>
            {LEVELS.map((l) => {
              const on = s.levels.includes(l);
              return (
                <button key={l} aria-pressed={on} onClick={() => s.setLevels(toggle(s.levels, l))}
                  className="min-h-[44px] -my-[7px] grid place-items-center">
                  <span className={`chip rounded-full px-[11px] py-[5px] text-[13px] font-extrabold text-ink capitalize ${on ? "bg-petal" : "bg-board"}`}>{l}</span>
                </button>
              );
            })}
          </div>
        </PlayRow>
      )}

      {shot ? (
        // #28: the shot takes the middle of the screen in place of the board.
        <div className="flex-1 min-h-0 grid content-center">
          <TurnPanel
            challenge="catapult" item={s.item} options={s.options}
            chosen={s.chosen} setChosen={() => {}}
            onAnswer={(correct) => s.fire(correct)}
            asking={g.phase === "asking"} revealed={revealed} mine={s.iAnswer}
            fraction={s.fraction} askedAt={0} target={s.target}
            waitingOn="The bot" botShot={s.botFires}
            advanceOwner={null} stall={null} myMark="x"
            onAdvanceNow={() => {}} onForceAdvance={() => {}} nextLabel="Next" />
        </div>
      ) : (
        // The drawings' column (.scr): the board straight under the banner and
        // the seats straight under the board, the space left over below them.
        <PlayBoard ratio={ratio} min={78} top reserve={question || over ? 0 : 69}>
          {(width) => (
            <>
              {board({ game: g, myTurn: s.myTurn, width, onPick: s.choose })}
              {!question && !over && (
                <div className="w-full">
                  <Seats seats={[
                    { mark: "x", name: "You", initial: me, count: count(live.x), active: active === "x" },
                    { mark: "o", name: "Bot", initial: "Bot", count: count(live.o), active: active === "o" },
                  ]} />
                </div>
              )}
            </>
          )}
        </PlayBoard>
      )}

      {over ? (
        // Between games (Daramola 26 Sep): the banner says who won; the finished
        // board stays up, and the next step is under it.
        <PlayRow className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
          <button onClick={s.restart} className="cut tap cut-petal min-h-[52px] font-display text-[19px]">Next game</button>
          <button onClick={s.endSession} className="cut tap cut-board min-h-[52px] font-display text-[19px]">End session</button>
        </PlayRow>
      ) : question ? (
        // #26: the question comes up as a sheet from the foot of the screen.
        <PlayRow className="card -mx-4 -mb-[calc(14px+env(safe-area-inset-bottom))] bg-board text-ink rounded-t-[26px] rounded-b-none
          px-4 pt-3.5 pb-[calc(18px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(14,74,176,.25)]">
          {/* The same panel the rooms draw. It only reached three copies
              because solo advances on a timer and a room can be stuck, so they
              looked different — but the difference is one nullable prop. */}
          <TurnPanel sheet
            challenge="trivia"
            item={s.item} options={s.options}
            chosen={s.chosen} setChosen={() => {}}
            // The option you tapped, as tapped: it is what the reveal marks as
            // yours and what the server judges. (It used to be a null character
            // for any wrong pick, which Postgres refuses, so a game with a miss
            // filed nothing.)
            onAnswer={(_correct, given) => s.submit(given ?? null)}
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
