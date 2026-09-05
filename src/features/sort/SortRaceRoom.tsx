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

/**
 * The same tubes in Dublin and Manchester, first to sort them.
 *
 * Her board is small and live beside yours — the point of showing it at all is
 * the moment you glance across and see she is a tube ahead. There is no turn
 * indicator because there are no turns: you are both playing at once, which is
 * the only room in here that works that way.
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

  if (done) return <MatchOver sides={sides} myMark={r.seat ?? "x"} card={card} />;
  if (!r.row || !r.me) return <Dealing what="the tubes" />;

  const seconds = Math.max(0, Math.floor(
    ((r.won ? new Date(r.row.updated_at).getTime() : now) -
      new Date(r.row.started_at).getTime()) / 1000));
  const them = r.seat === "x" ? names.o : names.x;
  const overPar = r.me.moves - r.row.par;

  // the winner's solve, as a film, once the referee has kept one
  const w = r.row.winner;
  const wLog = w === "x" ? r.row.x_log : w === "o" ? r.row.o_log : null;
  const wDone = w === "x" ? r.row.x_done_at : w === "o" ? r.row.o_done_at : null;
  const film: Replay | null = w && wLog && wDone && r.puzzle ? {
    tubes: r.puzzle.tubes, cap: r.puzzle.cap, log: decodeLog(wLog),
    ms: Math.max(1, Date.parse(wDone) - Date.parse(r.row.started_at)),
    moves: w === "x" ? r.row.x_moves : r.row.o_moves, par: r.row.par,
    name: names[w], level: r.row.level, where: `ROOM ${code}`,
  } : null;

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
        <Stat label="Time"
          value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          sub="first to sort" />
        <Stat label="Tubes home" value={String(r.myProgress)}
          sub={`${them} ${r.theirProgress}`} />
      </div>
      </PlayRow>

      {!r.won && (() => {
        const me = r.me;
        return (
          <PlayBoard ratio={TUBES_RATIO} min={120}>
            {(width) => (
              <div className="piece bg-surface p-3 pt-1" style={{ width }}>
                <Board tubes={me.tubes} cap={me.cap} selected={r.selected} refused={r.refused}
                  width={width - 26} onPick={r.pick} disabled={!!r.won} />
              </div>
            )}
          </PlayBoard>
        );
      })()}

      <PlayRow className="space-y-3">
      <p className="text-center text-[15px] font-bold text-soft">
        {r.won ? (r.iWon ? "You sorted it first." : `${them} got there first.`)
          : r.finishing ? "Checking that finish…"
          : r.selected === null ? "Tap a tube to lift its top ball."
          : "Now tap where it goes."}
      </p>

      <Note>{r.error}</Note>

      {!r.won && (
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

      <AwayNotice players={players} userId={userId} now={now} />

      {!r.won && <EndMatchLink onQuit={() => void r.quit()} />}
      </PlayRow>

      {r.won && (
        <>
          <PlayRow>
            <p className="text-center text-[13px] font-bold text-soft">
              {r.iWon
                ? `Solved in ${r.me.moves} — par ${r.row.par}${overPar <= 0 ? ". On the nose." : ` (+${overPar}).`}`
                : `You were ${r.myProgress} of ${r.row.colours} tubes home.`}
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
