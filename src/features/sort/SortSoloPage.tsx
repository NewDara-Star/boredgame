import { Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useFocusMode } from "@/app/layout/focus";
import { ReplayPlayer } from "./ReplayPlayer";
import type { Replay } from "./replay";
import { clock, decodeLog, type Level } from "./rules";
import { Avatar } from "@/shared/ui/Avatar";
import { Note } from "@/shared/ui/Note";
import { popIn } from "@/shared/ui/motion";
import { Board, TUBES_RATIO, TubesCard } from "./Board";
import { PlayBoard, PlayRow, PlaySurface, GameChip, TurnBanner } from "@/features/play/PlaySurface";
import { LeaveX } from "@/features/play/RoundChrome";
import { StartGate } from "./StartGate";
import { useSortSolo, type Standing } from "./useSortSolo";

const LEVELS: Level[] = ["easy", "medium", "hard"];

/**
 * Today's tubes, against the clock, from the drawings' code (#31 sorting,
 * #32 solved).
 *
 * No bot. In a sort puzzle the opponent is time, and the people who did the
 * same board today: one board per level per day, everyone on it, ranked by
 * the server's stopwatch. The tubes stay hidden until Start (talk item 13).
 *
 * #31 has the whole phone: the X and the game's chip, three small numbers
 * (time, moves, par), the tubes in a white card taking the rest, and Take back
 * and Start over. What to play (level, today's or practice) isn't drawn: it
 * sits in the card where the tubes will be, before Start, so it never takes
 * room from a board in play.
 */
export function SortSoloPage() {
  useFocusMode(true);
  const { user, profile } = useAuth();
  const [level, setLevel] = useState<Level>("medium");
  const [practice, setPractice] = useState(false);
  const r = useSortSolo(level, user?.id, practice);
  // The clock stops at the solve (r.solvedMs), not when the referee replies.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (r.startedAt === null || r.result || r.solvedMs !== null) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [r.startedAt, r.result, r.solvedMs]);
  const elapsed = r.result ? r.result.ms
    : r.solvedMs !== null ? r.solvedMs
    : r.startedAt === null ? 0 : now - r.startedAt;

  const rank = r.mine?.position ?? null;
  const where = practice ? "PRACTICE" : "TODAY'S TUBES";
  const film: Replay | null = r.result ? {
    tubes: r.puzzle.tubes, cap: r.puzzle.cap, log: r.me.log, ms: r.result.ms, moves: r.result.moves,
    par: r.puzzle.par, name: profile?.username ?? "You", level, where, rank,
  } : null;

  if (r.result && film) {
    const atPar = r.result.moves <= r.puzzle.par;
    const tail = practice ? " · practice"
      : !r.counts ? " · for fun"
      : rank ? ` · #${rank} today` : r.result.server ? "" : " · timed here";
    const next = LEVELS[(LEVELS.indexOf(level) + 1) % 3];
    return (
      <motion.div variants={popIn} initial="hidden" animate="show" className="grid gap-[11px] pb-2">
        <TurnBanner title={`Sorted in ${clock(r.result.ms)}`} tone="petal" flower={atPar ? "bloom" : "awake"}
          sub={`${r.result.moves} moves · par ${r.puzzle.par}${tail}`} />
        <Note>{r.error}</Note>
        <ReplayPlayer replay={film} premake>
          <button onClick={r.again} className="cut tap cut-board min-h-[52px] font-display text-[19px]">Go again</button>
        </ReplayPlayer>
        {practice ? (
          <div className="flex justify-center gap-5">
            <button onClick={r.shuffle} className={LINK}>New board</button>
            <button onClick={() => setPractice(false)} className={LINK}>Today's tubes</button>
          </div>
        ) : (
          <>
            <Ladder rows={r.board} mine={r.mine} meId={user?.id}
              failed={r.boardFailed} onRetry={() => void r.refreshBoard()}
              film={(s) => ({
                tubes: r.puzzle.tubes, cap: r.puzzle.cap, log: decodeLog(s.log ?? ""), ms: s.ms, moves: s.moves,
                par: r.puzzle.par, name: s.username, level, where: "TODAY'S TUBES", rank: s.position,
              })} />
            <button onClick={() => setLevel(next)} className={`${LINK} justify-self-center`}>Try today's {next} tubes</button>
          </>
        )}
      </motion.div>
    );
  }

  const running = r.startedAt !== null;
  const leader = r.board[0] ?? null;
  const note = practice ? "A random board, off the record. Tap a tube to lift its top ball, then tap where it goes."
    : r.mine ? `You're #${r.mine.position} today in ${clock(r.mine.ms)}. Only your first finish counts, so this one's for fun.`
    : leader ? `Everyone gets this board today. Best so far: ${leader.username}, ${clock(leader.ms)}. Your first finish is the one that counts.`
    : "Everyone gets this board today. Your first finish is the one that counts.";

  return (
    <PlaySurface focus>
      <PlayRow className="flex items-center justify-between gap-2.5 min-h-10">
        <LeaveX to="/play" label="Back to the games" />
        <GameChip title="Ball Sort" label={`Ball Sort · ${level}${practice ? " · practice" : ""}`} />
      </PlayRow>

      <PlayRow className="grid grid-cols-3 gap-2">
        <Stat label="Time" value={clock(elapsed)} />
        <Stat label="Moves" value={String(r.me.moves)} />
        <Stat label="Par" value={String(r.puzzle.par)} />
      </PlayRow>

      <TubesCard>
        {running ? (
          <>
            <PlayBoard ratio={TUBES_RATIO} min={120}>
              {(width) => (
                <Board tubes={r.me.tubes} cap={r.me.cap} selected={r.selected} refused={r.refused}
                  width={width} onPick={r.pick} disabled={r.finishing} />
              )}
            </PlayBoard>
            {r.finishing && <p role="status" className="shrink-0 text-center text-[13px] font-extrabold text-soft">Checking with the referee…</p>}
          </>
        ) : (
          <StartGate onGo={r.go} note={note}>
            <Choice label="Board" options={[["today", "Today's"], ["practice", "Practice"]]}
              value={practice ? "practice" : "today"} onPick={(v) => setPractice(v === "practice")} />
            <Choice label="Level" options={LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)] as [string, string])}
              value={level} onPick={(v) => setLevel(v as Level)} />
          </StartGate>
        )}
      </TubesCard>

      <Note>{r.error}</Note>

      <PlayRow className="grid grid-cols-2 gap-[9px]">
        <button onClick={r.takeBack} disabled={!running || r.me.history.length === 0 || r.finishing}
          className={SM}>Take back</button>
        <button onClick={r.startOver} disabled={!running || r.me.history.length === 0 || r.finishing}
          className={SM}>Start over</button>
      </PlayRow>
    </PlaySurface>
  );
}

const LINK = "min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4";
/** .cut.board.sm */
const SM = "cut tap cut-board min-h-[42px] px-3 font-display text-[16px] disabled:opacity-50";

/** .stats .stat: a small white card, the label over the number in mono (#31). */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-2xl shadow-lift-sm bg-board text-ink px-[10px] py-[9px]">
      <small className="block text-[12px] font-extrabold text-soft">{label}</small>
      <b className="block font-mono font-normal text-[20px] leading-none mt-1 tabular-nums">{value}</b>
    </div>
  );
}

/** A row of chips, one of them on: before Start only. */
function Choice({ label, options, value, onPick }:
  { label: string; options: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onPick(v)}
          className="min-h-[44px] -my-[7px] grid place-items-center">
          <span className={`chip rounded-full px-[11px] py-[5px] text-[13px] font-extrabold text-ink ${value === v ? "bg-petal" : "bg-mist"}`}>{text}</span>
        </button>
      ))}
    </div>
  );
}

/** Today's board for this level (#32's .list): the top twenty, and you if
    you're below them, in gold. A row with a replay opens its film on a tap. */
function Ladder({ rows, mine, meId, film, failed, onRetry }:
  { rows: Standing[]; mine: Standing | null; meId?: string; film: (s: Standing) => Replay;
    failed?: boolean; onRetry?: () => void }) {
  const offPage = mine && !rows.some((r) => r.user_id === meId);
  const [open, setOpen] = useState<string | null>(null);
  // Today's times are for members only, so a signed-out ladder is empty
  // whether or not anyone has played: say why, not "you're first".
  if (!meId) return <Line><Link to="/you" className="underline underline-offset-4">Sign in</Link> to see today's times.</Line>;
  if (failed) return <Line>Couldn't load today's times. {onRetry && <button onClick={onRetry} className="underline underline-offset-4 min-h-[44px]">Try again</button>}</Line>;
  if (rows.length === 0) return <Line>Your time goes up on today's board when the referee has it.</Line>;
  const row = (s: Standing) => (
    <Row key={s.user_id} s={s} me={s.user_id === meId} open={open === s.user_id}
      onOpen={s.log ? () => setOpen(open === s.user_id ? null : s.user_id) : undefined}>
      {open === s.user_id && s.log && <ReplayPlayer replay={film(s)} />}
    </Row>
  );
  return (
    <ol className="grid gap-2" aria-label="Today's times">
      {rows.map(row)}
      {offPage && <li className="text-center text-[12px] font-extrabold text-soft" aria-hidden>···</li>}
      {offPage && row(mine!)}
    </ol>
  );
}

const Line = ({ children }: { children: ReactNode }) =>
  <p className="card rounded-2xl shadow-lift-sm bg-board px-3 py-2.5 text-[13px] font-bold text-soft">{children}</p>;

/** .li: the disc, "1  Tobi" over "0:48 · 21 moves". Yours is gold (.li.me). */
function Row({ s, me, open, onOpen, children }:
  { s: Standing; me: boolean; open: boolean; onOpen?: () => void; children?: ReactNode }) {
  return (
    <li className={`card rounded-2xl shadow-lift-sm text-ink ${me ? "bg-petal" : "bg-board"}`}>
      <button onClick={onOpen} disabled={!onOpen} aria-expanded={onOpen ? open : undefined}
        className="flex w-full min-h-[44px] items-center gap-2.5 px-3 py-[9px] text-left disabled:cursor-default">
        <Avatar id={s.user_id} name={s.username} size={26} tone={me ? "petal" : undefined} />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] leading-[1.2] truncate"><span className="tabular-nums">{s.position}</span>{" "}{me ? "You" : s.username}</b>
          <small className={`block text-[12px] font-semibold tabular-nums ${me ? "text-ink" : "text-soft"}`}>{clock(s.ms)} · {s.moves} moves</small>
        </span>
        {onOpen && <span className={`shrink-0 text-[12px] font-extrabold underline underline-offset-4 ${me ? "text-ink" : "text-soft"}`}>{open ? "Close" : "Watch"}</span>}
      </button>
      {children && <div className="px-2 pb-2">{children}</div>}
    </li>
  );
}
