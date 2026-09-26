import type { ReactNode } from "react";
import { useMemo } from "react";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { serverToLocal } from "@/shared/lib/serverClock";

/** Two room heartbeats (every 20 s) missed: the other phone has gone quiet. */
export const QUIET_MS = 45_000;
import { Note, Dealing } from "@/shared/ui/Note";
import {
  EndMatchLink, MatchOver, useMatchChrome,
} from "@/features/rooms/matchUi";
import { Board, TUBES_RATIO } from "./Board";
import { PlayBoard, PlaySurface } from "@/features/play/PlaySurface";
import { ballGlyph, sortHero } from "./card";
import { ReplayPlayer } from "./ReplayPlayer";
import { decodeLog, type Replay } from "./rules";
import { useSortRoom } from "./useSortRoom";
import { BetweenGames, NudgeButton, quietPeer, RoomBanner } from "@/features/rooms/RoomBoard";
import { SEAT_RAMP } from "@/shared/brand/seats";
import { StartGate } from "./StartGate";

/** ms -> "12.3s", or "1:04.2" once it runs past a minute. */
function clock(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * The same tubes in Dublin and Manchester — faster solve wins.
 *
 * Her board is small and live beside yours — the point of showing it at all is
 * the moment you glance across and see she is a tube ahead. There is no turn
 * indicator because there are no turns: you are both playing at once.
 *
 * Finishing does not end it. You post your time and then wait: the winner is
 * whoever's clock is lower once both boards are in (or the other gives up), so a
 * clean solve that lands a second late still beats a slower one that arrived
 * first. That is the whole point — the result is a comparison, not a race to the
 * server.
 */
export function SortRaceRoom({
  top, topWith, roomId, code, status, players, userId,
}: {
  /** the room's top bar (code, call) and its notices */
  top?: ReactNode;
  /** the same, with something else at its right-hand end: here, your clock (41) */
  topWith?: (end: ReactNode) => ReactNode;
  roomId: number; code: string; status: RoomStatus;
  players: RoomPlayer[]; userId: string;
}) {
  const r = useSortRoom(roomId, userId);
  const { now, names, sides, card, done } = useMatchChrome(
    code, "BALL SORT", status, players,
    { x: r.row?.x_player ?? null, o: r.row?.o_player ?? null },
    !r.won,
    { hero: () => (r.me ? sortHero(r.me.tubes, r.me.cap) : () => {}), glyph: ballGlyph, me: r.seat ?? null,
      caption: () => r.me && r.row ? `Last race: ${r.me.moves} moves, par ${r.row.par}` : undefined });

  // The winner's solve, as a film, once the referee has kept one.
  //
  // MEMOISED, and that is not an optimisation, and it sits ABOVE the early
  // returns because a hook must run every render. The match clock re-renders
  // this component every second; a fresh `film` object each time is a new
  // identity, and ReplayPlayer restarts playback on `[replay]`. The deps are
  // primitives that stop changing once the race is won.
  const w = r.row?.winner ?? null;
  const wLog = w === "x" ? r.row?.x_log : w === "o" ? r.row?.o_log : null;
  const wDone = w === "x" ? r.row?.x_done_at : w === "o" ? r.row?.o_done_at : null;
  const wMs = w === "x" ? r.row?.x_ms : w === "o" ? r.row?.o_ms : null;
  const startedAt = r.row?.started_at ?? "";
  const rowMoves = w === "x" ? (r.row?.x_moves ?? 0) : w === "o" ? (r.row?.o_moves ?? 0) : 0;
  const par = r.row?.par ?? 0, level = r.row?.level ?? "medium";
  const tubes = r.puzzle?.tubes, capp = r.puzzle?.cap;
  const winnerName = w ? names[w] : "";
  const film: Replay | null = useMemo(
    () => (w && wLog && wDone && tubes ? {
      tubes, cap: capp!, log: decodeLog(wLog),
      // the winner's own recorded time; done_at-started_at only for legacy rows
      ms: wMs ?? Math.max(1, Date.parse(wDone) - Date.parse(startedAt)),
      moves: rowMoves, par, name: winnerName, level, where: `ROOM ${code}`,
    } : null),
    [w, wLog, wDone, wMs, tubes, capp, startedAt, rowMoves, par, level, winnerName, code],
  );

  if (done) return <MatchOver sides={sides} myMark={r.seat ?? "x"} card={card} roomId={roomId} />;
  if (!r.row || !r.me) return <Dealing what="the tubes" />;

  const them = r.seat === "x" ? names.o : names.x;

  // My clock: 0 until my tubes appear (Start, then 3-2-1), then ticking, then frozen on my solve.
  const liveMs = r.startedMs === null ? 0 : Math.max(0, now - r.startedMs);
  const myMs = r.myMs ?? liveMs;

  // Only truly playing (not won, not already finished) shows the board.
  const playing = !r.won && !r.iFinished;

  const total = r.row.colours;
  const quiet = !r.won ? quietPeer(players, userId, now) : null;
  const theirSeat = r.seat === "x" ? "o" : "x";

  return (
    <PlaySurface focus>
      {topWith ? topWith(<b className="font-mono text-[16px] font-bold tabular-nums">{clock(myMs)}</b>) : top}

      {r.won ? (
        <RoomBanner b={{ title: r.iWon ? "You were faster" : `${them} was faster`, tone: r.iWon ? "petal" : "white",
          flower: r.iWon ? "bloom" : "bored",
          sub: `You ${r.myMs != null ? clock(r.myMs) : "—"} · ${them} ${r.theirMs != null ? clock(r.theirMs) : "gave up"}` }} />
      ) : quiet && !r.theyFinished ? (
        <RoomBanner b={{ title: `${them}'s gone quiet`, sub: "Their phone may be locked", tone: "white", flower: "look-right", end: <NudgeButton roomId={roomId} /> }} />
      ) : (
        // Their tubes as a bar of how many are sorted (41): enough to feel the
        // pressure without watching their board.
        <div className="card shrink-0 flex items-center gap-2.5 rounded-[20px] bg-board px-3 py-2.5 text-ink">
          <SeatDot mark={theirSeat} name={them} />
          <div className="min-w-0 flex-1">
            <b className="block text-[14px]">{them} · {r.theyFinished ? `done in ${r.theirMs != null ? clock(r.theirMs) : "—"}` : `${r.theirProgress} of ${total} tubes`}</b>
            <div className="mt-1 h-2 rounded-full bg-mist overflow-hidden">
              <i className="block h-full rounded-full bg-sky" style={{ width: `${Math.min(1, r.theirProgress / Math.max(1, total)) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {playing && (() => {
        const me = r.me;
        return (
          <PlayBoard ratio={TUBES_RATIO} min={0}>
            {(width) => r.revealed ? (
              <div className="card bg-board p-3 pt-1" style={{ width }}>
                <Board tubes={me.tubes} cap={me.cap} selected={r.selected} refused={r.refused}
                  width={width - 26} onPick={r.pick} disabled={!playing} />
              </div>
            ) : (
              <StartGate width={width} onGo={r.go}
                note="Your tubes stay hidden until you start. Your clock runs from the moment they appear." />
            )}
          </PlayBoard>
        );
      })()}

      {!playing && !r.won && (
        <p className="flex-1 grid place-items-center text-center text-[15px] font-bold text-soft">
          {r.finishing ? "Posting your finish…" : `Done in ${clock(myMs)}. Waiting for ${them}.`}
        </p>
      )}

      <Note>{r.error}</Note>
      {/* A dead phone used to leave the finisher waiting for ever (talk item 10). */}
      {(() => {
        if (r.won || !r.iFinished || r.finishing || r.theyFinished) return null;
        const other = players.find((p) => p.user_id !== userId);
        const gone = !other || now - serverToLocal(other.last_seen) > QUIET_MS;
        if (!gone) return null;
        return (
          <button onClick={() => void r.walkover()}
            className="cut tap cut-leaf shrink-0 min-h-[52px] font-display text-[19px]">
            {them}'s phone has gone quiet. Take the win
          </button>
        );
      })()}
      {r.finishDropped && !r.finishing && (
        <button onClick={r.retryFinish} className="cut tap cut-petal shrink-0 min-h-[52px] font-display text-[19px]">
          Send my finish again
        </button>
      )}

      {playing && (
        <div className="shrink-0 grid grid-cols-2 items-center gap-[9px]">
          <button onClick={r.takeBack} disabled={r.me.history.length === 0}
            className="cut tap cut-board min-h-[44px] font-display text-[17px] disabled:opacity-50">
            Take back
          </button>
          <button onClick={() => void r.concede()}
            className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
            Give up
          </button>
        </div>
      )}

      {r.won && (
        <>
          {film && <div className="flex-1 min-h-0 overflow-y-auto"><ReplayPlayer replay={film} /></div>}
          <BetweenGames onRematch={() => void r.rematch()} onQuit={() => void r.quit()} onChangeGame={() => void r.changeGame()} />
        </>
      )}
      {!r.won && !playing && <EndMatchLink onQuit={() => void r.quit()} />}
    </PlaySurface>
  );
}

/** .av, small: a seat's colour and first letter. */
function SeatDot({ mark, name }: { mark: "x" | "o"; name: string }) {
  const c = SEAT_RAMP[mark];
  return (
    <span aria-hidden className="shrink-0 grid place-items-center w-[26px] h-[26px] rounded-full font-display text-[12px] text-ink"
      style={{ background: `radial-gradient(circle at 35% 30%, ${c.hi}, ${c.base} 60%)`, border: "2px solid var(--color-ink-day)", boxShadow: "0 2px 0 var(--color-ink-day)" }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

