import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/lib/supabase";
import type { FlowerState } from "@/shared/brand/Sunflower";
import { TurnBanner, Seats, PlayBoard, PlaySurface } from "@/features/play/PlaySurface";
import { challengeName, isShot, levelOf, type Challenge, type Play, type TurnKind } from "@/features/challenge/kinds";
import { SHOT_NAMES, type ShotRec } from "@/features/challenge/shots";
import type { RoomPlayer } from "@/shared/types/db";
import { serverToLocal } from "@/shared/lib/serverClock";
import { AWAY_MS, EndMatchLink } from "./matchUi";
import { AnimatePresence } from "framer-motion";
import { ChallengeSheet, MiniBoard } from "@/features/challenge/ChallengeSheet";
import { RoomShot } from "@/features/challenge/RoomShot";
import { Note } from "@/shared/ui/Note";
import { TurnPanel } from "./TurnPanel";
import type { PlayItem } from "@/features/play/types";
import type { Stall } from "@/features/play/board";
import type { RoomShotRec } from "./useBoardRoom";

type Mark = "x" | "o";
const other = (m: Mark): Mark => (m === "x" ? "o" : "x");

/** The other player, if their phone has gone quiet: no heartbeat for 50 s (#39). */
export function quietPeer(players: RoomPlayer[], userId: string, now: number): RoomPlayer | null {
  return players.find((p) => p.user_id !== userId && now - serverToLocal(p.last_seen) > AWAY_MS) ?? null;
}

export interface BannerProps { title: string; sub?: string; tone: "petal" | "white"; flower: FlowerState; end?: ReactNode }

/**
 * The room's .turn banner (drawings 38, 39), in the solo boards' words: gold
 * when it's yours to do something, white while you wait, the flower turned to
 * whoever is on. Between games it says who took it and the running score.
 */
export function roomBanner(o: {
  g: { phase: "picking" | "asking" | "revealed" | "over"; turn: Mark; target: number | null;
       last: { by: Mark; correct: boolean } | null; winner: Mark | "draw" | null };
  me: Mark | null; names: Record<Mark, string>; scores: Record<Mark, number>;
  /** who owes the pending answer or shot */
  answerer: Mark;
  challenge: Challenge; kind: TurnKind | null;
  unit: "square" | "column";
  spot: (i: number | null) => string;
  said: string;
  youAre?: string;
  quiet: RoomPlayer | null;
  nudge?: ReactNode;
}): BannerProps | null {
  const { g, me, names, scores, answerer, challenge, kind, unit, spot, said, quiet } = o;
  const you = me ?? "x", them = other(you), name = names[them];
  const tally = <b className="font-mono font-bold text-[24px] shrink-0">{scores[you]}–{scores[them]}</b>;
  if (g.phase === "over") {
    return g.winner === you ? { title: "You win this one", tone: "petal", flower: "bloom", end: tally }
      : g.winner === them ? { title: `${name} wins this one`, tone: "white", flower: "bored", end: tally }
      : { title: "A draw", sub: said, tone: "white", flower: "awake", end: tally };
  }
  const onThem = g.phase === "asking" ? answerer === them : g.phase === "picking" ? g.turn === them : false;
  if (quiet && onThem) {
    return { title: `${name}'s gone quiet`, sub: "Their phone may be locked", tone: "white", flower: "look-right", end: o.nudge };
  }
  if (g.phase === "revealed" && g.last) {
    const mine = g.last.by === you;
    return {
      title: mine ? (g.last.correct ? "Got it" : "Not this time") : (g.last.correct ? `${name} got it` : `${name} missed`),
      sub: said, tone: "white", flower: g.last.correct === mine ? "bloom" : "bored",
    };
  }
  if (g.phase === "asking") {
    if (kind && kind !== "trivia" && kind !== "none") {
      const what = `${SHOT_NAMES[kind]} for ${spot(g.target)}`;
      return answerer === you ? { title: "Your shot", sub: what, tone: "petal", flower: "awake" }
        : { title: `${name}'s shot`, sub: what, tone: "white", flower: "look-right" };
    }
    return answerer === you ? { title: "Your question", sub: said, tone: "petal", flower: "awake" }
      : { title: `${name}'s answering`, sub: said, tone: "white", flower: "look-right" };
  }
  const mixing = challenge === "mix" && kind;
  return g.turn === you
    ? { title: "Your move", sub: mixing ? `Pick a ${unit}. This one's ${challengeName(kind).toLowerCase()}.` : `${name} is waiting`, tone: "petal", flower: "awake" }
    : { title: `${name}'s move`, sub: mixing ? `Their turn is ${challengeName(kind).toLowerCase()}` : o.youAre, tone: "white", flower: "look-right" };
}

export function RoomBanner({ b }: { b: BannerProps | null }) {
  if (!b) return null;
  return <TurnBanner title={b.title} sub={b.sub} tone={b.tone} flower={b.flower} end={b.end} />;
}

/** .seats in a room: you and them with wins, the one on ringed, a quiet seat faded, "Easy shots" where it applies. */
export function RoomSeatRow({ me, names, scores, active, quiet, play, shots, counting = "wins" }: {
  me: Mark | null; names: Record<Mark, string>; scores: Record<Mark, number>;
  active: Mark | null; quiet: boolean; play?: Play | null; shots?: boolean;
  counting?: "wins" | "pairs";
}) {
  const you = me ?? "x", them = other(you);
  const count = (n: number) => counting === "pairs" ? `${n} pair${n === 1 ? "" : "s"}` : `${n} win${n === 1 ? "" : "s"}`;
  const tag = (m: Mark) => (shots && levelOf(play, m) === "easy" ? "Easy shots" : undefined);
  return (
    <Seats seats={[
      { mark: you, name: "You", initial: names[you], count: count(scores[you]), active: active === you, tag: tag(you) },
      { mark: them, name: names[them], initial: names[them], count: count(scores[them]), active: active === them, tag: tag(them), away: quiet },
    ]} />
  );
}

/**
 * Nudge (#39, Daramola 26 Sep): a push to the quiet player's phone, at most
 * once a minute (the server holds the minute). It only reaches someone who has
 * notifications on, and says so when it can't.
 */
export function NudgeButton({ roomId }: { roomId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "off" | "soon">("idle");
  useEffect(() => {
    if (state !== "sent" && state !== "soon" && state !== "off") return;
    const t = setTimeout(() => setState("idle"), state === "off" ? 5000 : 60_000);
    return () => clearTimeout(t);
  }, [state]);
  const nudge = async () => {
    if (!supabase || state !== "idle") return;
    setState("sending");
    const { data, error } = await supabase.functions.invoke("notify-invite", { body: { kind: "nudge", room: roomId } });
    const r = (data ?? {}) as { sent?: number; reason?: string };
    if (error) setState(/429|too soon/i.test(String(error.message)) ? "soon" : "idle");
    else setState(r.sent ? "sent" : r.reason === "too soon" ? "soon" : "off");
  };
  const label = state === "sending" ? "Nudging…" : state === "sent" || state === "soon" ? "Nudged"
    : state === "off" ? "Notifications off" : "Nudge";
  return (
    <button onClick={() => void nudge()} disabled={state !== "idle"}
      className="cut tap cut-sky shrink-0 min-h-[44px] px-3.5 font-display text-[16px] disabled:opacity-70">
      {label}
    </button>
  );
}

/**
 * Between games: the banner says who took it; under the board, Rematch (the
 * score carries on) or End match (the result and its card). Something else
 * goes back to the lobby with the same code, and the score starts again.
 */
export function BetweenGames({ onRematch, onQuit, onChangeGame }: {
  onRematch: () => void; onQuit: () => void; onChangeGame: () => void;
}) {
  return (
    <div className="shrink-0 grid gap-2">
      <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
        <button onClick={onRematch} className="cut tap cut-petal min-h-[52px] font-display text-[19px]">Rematch</button>
        <button onClick={onQuit} className="cut tap cut-board min-h-[52px] font-display text-[19px]">End match</button>
      </div>
      <button onClick={onChangeGame} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
        Play something else (the score starts again)
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- the body */

/** What a room's board game hands the shared body (drawings 38, 39). */
export interface BoardRoomProps {
  top: ReactNode;
  roomId: number; userId: string; players: RoomPlayer[]; now: number;
  names: Record<Mark, string>; scores: Record<Mark, number>;
  game: { phase: "picking" | "asking" | "revealed" | "over"; turn: Mark; target: number | null;
          last: { by: Mark; correct: boolean } | null; winner: Mark | "draw" | null; board: (Mark | null)[] };
  myMark: Mark | null;
  /** who owes the pending answer or shot */
  answerer: Mark;
  plain: boolean; challenge: Challenge; kind: TurnKind | null; play: Play | null;
  unit: "square" | "column"; spot: (i: number | null) => string;
  said: string; youAre: string;
  ratio: number;
  board: (width: number) => ReactNode;
  /** the question, when a turn asks one */
  item: PlayItem | null; chosen: string | null; setChosen: (o: string | null) => void;
  fraction: number; askedAt: number; askedSeed: number;
  stall: Stall | null;
  error: string | null;
  shot: RoomShotRec | null;
  onAnswer: (correct: boolean, given?: string) => void;
  onShot: (hit: boolean, rec?: ShotRec) => void;
  onFly: (flying: boolean) => void;
  onAdvanceNow: () => void; onForceAdvance: () => void;
  onRematch: () => void; onQuit: () => void; onChangeGame: () => void;
  counting?: "wins" | "pairs";
}

/**
 * A board game in a room, laid out as the solo boards are (38): the top bar,
 * the banner, the board straight under it and the seats under the board. A
 * question or a shot takes the sheet (26), on both phones. Between games the
 * banner says who took it and Rematch / End match sit under the board.
 */
export function BoardRoomBody(p: BoardRoomProps) {
  const g = p.game, you = p.myMark ?? "x";
  const quiet = g.phase !== "over" ? quietPeer(p.players, p.userId, p.now) : null;
  const over = g.phase === "over";
  const question = !p.plain && p.kind === "trivia" && !!p.item && (g.phase === "asking" || g.phase === "revealed");
  const shotTurn = !p.plain && !!p.kind && isShot(p.kind);
  const banner = roomBanner({
    g, me: p.myMark, names: p.names, scores: p.scores, answerer: p.answerer,
    challenge: p.challenge, kind: p.kind, unit: p.unit, spot: p.spot, said: p.said, youAre: p.youAre,
    quiet, nudge: <NudgeButton roomId={p.roomId} />,
  });
  const active: Mark | null = over ? null : g.phase === "asking" ? p.answerer : g.turn;
  const shots = p.challenge !== "trivia" && p.challenge !== "none" && !p.plain;
  return (
    <PlaySurface focus>
      {p.top}
      <RoomBanner b={banner} />
      {/* 39: the board, the seats straight under it, and the way out straight under them */}
      <PlayBoard ratio={p.ratio} min={78} top reserve={g.phase === "picking" ? 113 : 69}>
        {(width) => (
          <>
            {p.board(width)}
            <div className="w-full">
              <RoomSeatRow me={p.myMark} names={p.names} scores={p.scores} active={active}
                quiet={!!quiet} play={p.play} shots={shots} counting={p.counting} />
            </div>
            {g.phase === "picking" && <EndMatchLink onQuit={p.onQuit} />}
          </>
        )}
      </PlayBoard>
      <Note>{p.error}</Note>
      {over && <BetweenGames onRematch={p.onRematch} onQuit={p.onQuit} onChangeGame={p.onChangeGame} />}

      <AnimatePresence>
        {question && (
          <ChallengeSheet key={`q-${p.askedSeed}`}
            title={g.target !== null ? (p.answerer === you ? `For ${p.spot(g.target)}` : `${p.names[p.answerer]}'s going for ${p.spot(g.target)}`)
              : g.last?.by === you ? (g.last.correct ? "Yours" : "Stays open") : `${p.names[other(you)]}'s question`}
            sub={g.phase === "asking" ? (p.answerer === you ? "Answer it" : `${p.names[p.answerer]} is answering`) : undefined}
            mini={<MiniBoard board={g.board} target={g.target} />}>
            <div className="min-h-0 overflow-y-auto">
              <TurnPanel sheet challenge="trivia"
                item={p.item} options={p.item?.choices ?? []}
                chosen={p.chosen} setChosen={p.setChosen}
                onAnswer={p.onAnswer}
                asking={g.phase === "asking"} revealed={g.phase === "revealed"} mine={g.phase === "asking" && p.answerer === you}
                fraction={p.fraction} askedAt={p.askedSeed}
                waitingOn={p.names[other(you)]}
                advanceOwner={g.phase === "revealed" && g.last ? g.last.by : null}
                stall={p.stall} myMark={p.myMark}
                onAdvanceNow={p.onAdvanceNow} onForceAdvance={p.onForceAdvance}
                nextLabel="Back to the board" />
            </div>
          </ChallengeSheet>
        )}
      </AnimatePresence>

      {shotTurn && p.kind && isShot(p.kind) && (
        <RoomShot active={g.phase === "asking"} kind={p.kind} seed={p.askedSeed}
          level={levelOf(p.play, p.answerer)} by={p.answerer} myMark={p.myMark} names={p.names}
          board={g.board} target={g.target} spot={p.spot}
          askedAt={p.askedAt} now={p.now} flight={p.shot}
          onSettle={p.onShot} onFly={p.onFly} />
      )}
    </PlaySurface>
  );
}
