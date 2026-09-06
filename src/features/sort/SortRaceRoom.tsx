import { useMemo } from "react";
import type { RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import {
  Seats, AwayNotice, OverPanel, EndMatchLink, MatchOver, useMatchChrome,
} from "@/features/rooms/matchUi";
import { Board, TUBES_RATIO } from "./Board";
import { PlayBoard, PlayRow, PlaySurface } from "@/features/play/PlaySurface";
import { ballGlyph, sortArt } from "./card";
import { ReplayPlayer } from "./ReplayPlayer";
import { decodeLog, type Replay } from "./rules";
import { useSortRoom } from "./useSortRoom";

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
  roomId, code, status, players, userId,
}: {
  roomId: number; code: string; status: RoomStatus;
  players: RoomPlayer[]; userId: string;
}) {
  const r = useSortRoom(roomId, userId);
  const { now, names, sides, card, done } = useMatchChrome(
    code, "BALL SORT", status, players,
    { x: r.row?.x_player ?? null, o: r.row?.o_player ?? null },
    !r.won,
    { hero: () => sortArt("BALL SORT"), glyph: ballGlyph,
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

  if (done) return <MatchOver sides={sides} myMark={r.seat ?? "x"} card={card} />;
  if (!r.row || !r.me) return <Dealing what="the tubes" />;

  const them = r.seat === "x" ? names.o : names.x;

  // My clock: 0 until my first lift, then ticking from it, then frozen on my solve.
  const liveMs = r.startedMs === null ? 0 : Math.max(0, now - r.startedMs);
  const myMs = r.myMs ?? liveMs;

  // Only truly playing (not won, not already finished) shows the board.
  const playing = !r.won && !r.iFinished;

  return (
    <PlaySurface>
      <PlayRow className="space-y-3">
      <Seats
        names={names}
        scores={{ x: r.seat === "x" ? r.myProgress : r.theirProgress,
                  o: r.seat === "o" ? r.myProgress : r.theirProgress }}
        active={r.seat ?? "x"}
        dimmed={!!r.won}
        glyph={(m) => (m === "x" ? "◆" : "●")} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Moves" value={String(r.me.moves)} sub={`par ${r.row.par}`} />
        <Stat label="Your time" value={clock(myMs)} sub="lower time wins" />
        <Stat label="Tubes home" value={String(r.myProgress)}
          sub={`${them} ${r.theirProgress}`} />
      </div>
      </PlayRow>

      {playing && (() => {
        const me = r.me;
        return (
          <PlayBoard ratio={TUBES_RATIO} min={0}>
            {(width) => (
              <div className="piece bg-surface p-3 pt-1" style={{ width }}>
                <Board tubes={me.tubes} cap={me.cap} selected={r.selected} refused={r.refused}
                  width={width - 26} onPick={r.pick} disabled={!playing} />
              </div>
            )}
          </PlayBoard>
        );
      })()}

      <PlayRow className="space-y-3">
      <p className="text-center text-[15px] font-bold text-soft">
        {r.won
          ? (r.iWon ? "You were faster." : `${them} was faster.`)
          : r.iFinished
            ? (r.finishing ? "Posting your finish…"
               : `Done in ${clock(myMs)} — waiting for ${them}.`)
            : r.theyFinished
              ? `${them} finished in ${r.theirMs != null ? clock(r.theirMs) : "—"}. Beat it or give up.`
              : r.selected === null ? "Tap a tube to lift its top ball."
              : "Now tap where it goes."}
      </p>

      <Note>{r.error}</Note>

      {playing && (
        <div className="flex items-center gap-3">
          {r.theirTubes && (
            <div className="piece bg-sand p-2 shrink-0" style={{ width: 150 }}>
              <p className="text-[12px] font-black uppercase tracking-widest text-soft text-center mb-1">
                {them} · {r.theirMoves}
              </p>
              <Board tubes={r.theirTubes} cap={r.row.cap} size="mini" />
            </div>
          )}
          <button onClick={r.takeBack} disabled={r.me.history.length === 0}
            className="piece press flex-1 py-3 font-display font-semibold bg-surface">
            Take it back
          </button>
        </div>
      )}

      {playing && (
        <button onClick={() => void r.concede()}
          className="block mx-auto text-[13px] font-black uppercase tracking-wider
            text-bad underline underline-offset-4 pt-1">
          Give up this race
        </button>
      )}

      <AwayNotice players={players} userId={userId} now={now} />

      {!r.won && <EndMatchLink onQuit={() => void r.quit()} />}
      </PlayRow>

      {r.won && (
        <>
          <PlayRow>
            <p className="text-center text-[13px] font-bold text-soft">
              You {r.myMs != null ? clock(r.myMs) : "—"} · {them} {r.theirMs != null ? clock(r.theirMs) : "gave up"}
            </p>
          </PlayRow>
          {film && <div className="flex-1 min-h-0 overflow-y-auto"><ReplayPlayer replay={film} /></div>}
          <PlayRow>
          <OverPanel
            headline={r.iWon ? "You win" : `${them} wins`}
            mine={r.iWon}
            draw={false}
            onRematch={() => void r.rematch()}
            onQuit={() => void r.quit()}
            onChangeGame={() => void r.quit()} />
          </PlayRow>
        </>
      )}
    </PlaySurface>
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
