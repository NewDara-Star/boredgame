import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { Avatar } from "@/shared/ui/Avatar";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { drawCard, saveCard, type MatchCard } from "@/shared/card/frame";
import { Board } from "./Board";
import { sortHero } from "./card";
import { useSortSolo, type Standing } from "./useSortSolo";
import type { Level } from "./rules";

const LEVELS: Level[] = ["easy", "medium", "hard"];

/** 0:41.2 — tenths, because a time attack is decided in them. */
export const clock = (ms: number, tenths = true) => {
  const s = Math.floor(ms / 1000);
  const t = tenths ? `.${Math.floor((ms % 1000) / 100)}` : "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}${t}`;
};

/**
 * Today's tubes, against the clock.
 *
 * No bot. In a sort puzzle the opponent is time, and the people who did the
 * same board today: one board per level per day, everyone on it, ranked by
 * the server's stopwatch. The clock starts when the first ball is lifted, not
 * when the page opens, so looking at the board costs nothing.
 */
export function SortSoloPage() {
  const { user } = useAuth();
  const [level, setLevel] = useState<Level>("medium");
  const [practice, setPractice] = useState(false);
  const r = useSortSolo(level, user?.id, practice);
  const running = r.startedAt !== null && !r.result;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (r.startedAt === null || r.result) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [r.startedAt, r.result]);
  const elapsed = r.result ? r.result.ms : r.startedAt === null ? 0 : now - r.startedAt;

  // the result card: the tubes as they finished, and where the time landed
  const [card, setCard] = useState<MatchCard | null>(null);
  const rank = r.mine?.position ?? null;
  useEffect(() => {
    if (!r.result) { setCard(null); return; }
    let cancelled = false;
    const overPar = r.result.moves - r.puzzle.par;
    void drawCard({
      title: "BALL SORT", code: null,
      headline: clock(r.result.ms),
      hero: sortHero(r.me.tubes, r.me.cap),
      caption: `${rank ? `#${rank} today · ` : practice ? "practice · " : ""}${r.result.moves} moves${overPar <= 0 ? ", par" : `, par ${r.puzzle.par}`} · ${level}`,
    }).then((made) => { if (!cancelled) setCard(made); })
      .catch(() => { /* canvas unavailable; the time is still on screen */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.result, rank]);

  const leader = r.board[0] ?? null;
  const overPar = r.me.moves - r.puzzle.par;

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn} className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] leading-none font-semibold whitespace-nowrap">
            {practice ? "Practice" : "Today's tubes"}
          </h1>
          <p className="text-[12px] font-black uppercase tracking-widest text-soft mt-1">
            {practice ? "A random board, off the record" : "Everyone gets this board today"}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
              disabled={running}
              className={`text-[12px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border-2 border-ink
                disabled:opacity-40 ${level === l ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
              {l}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={riseIn} className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Time" value={clock(elapsed)}
          sub={r.startedAt === null ? "on first lift" : practice ? "practice" : "server-timed"} />
        <Stat label="Moves" value={String(r.me.moves)} sub={`par ${r.puzzle.par}`} />
        {practice
          ? <Stat label="Board" value="random" sub="not ranked" />
          : <Stat label="To beat" value={leader ? clock(leader.ms) : "—"} sub={leader ? leader.username : "nobody yet today"} />}
      </motion.div>

      <motion.div variants={popIn} className="piece bg-surface p-3 pt-1">
        <Board tubes={r.me.tubes} cap={r.me.cap} selected={r.selected} refused={r.refused}
          onPick={r.pick} disabled={!!r.result || r.finishing} />
      </motion.div>

      <motion.p variants={riseIn} className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {r.finishing ? "Checking with the referee…"
          : r.result ? (r.result.server ? "On the board." : practice ? "Practice — not ranked." : "Timed here only.")
          : r.selected === null ? "Tap a tube to lift its top ball."
          : "Now tap where it goes."}
      </motion.p>

      {r.error && (
        <motion.p variants={riseIn} className="piece bg-pop p-3 text-[13px] font-bold text-center">{r.error}</motion.p>
      )}

      {r.result ? (
        <motion.div variants={popIn} className="space-y-4">
          <div className="piece p-6 text-center bg-good text-surface">
            <p className="text-[12px] font-black uppercase tracking-widest opacity-70">Sorted</p>
            <p className="font-display text-6xl font-semibold tabular-nums mt-1">{clock(r.result.ms)}</p>
            <p className="text-sm font-bold mt-2 opacity-85">
              {r.result.moves} moves — par {r.puzzle.par}{overPar <= 0 ? ". On the nose." : ` (+${overPar}).`}
              {rank ? ` #${rank} today.` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button onClick={r.again}
                className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
                Go again
              </button>
              <button onClick={() => (practice ? r.shuffle() : setLevel(LEVELS[(LEVELS.indexOf(level) + 1) % 3]))}
                className="piece press py-3.5 font-display text-lg font-semibold bg-surface text-ink">
                {practice ? "New board" : "Next level"}
              </button>
            </div>
            <p className="text-[13px] font-bold opacity-70 mt-2">
              {practice ? "Same board again, or a new one." : "Same board. Your best time stands."}
            </p>
          </div>
          {card ? (
            <>
              <img src={card.url} alt={`Ball Sort: ${clock(r.result.ms)}, ${r.result.moves} moves`}
                className="w-full rounded-2xl border-[3px] border-ink" />
              <button onClick={() => saveCard(card.file)}
                className="piece press w-full py-4 font-display text-lg font-semibold bg-pop">
                Save the image
              </button>
            </>
          ) : (
            <div className="piece grid place-items-center aspect-square bg-surface">
              <p className="text-sm font-bold text-soft">Drawing the result…</p>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={riseIn} className="grid grid-cols-2 gap-2.5">
          <button onClick={r.takeBack} disabled={r.me.history.length === 0 || r.finishing}
            className="piece press py-3 font-display font-semibold bg-surface disabled:opacity-50">
            Take it back
          </button>
          {practice ? (
            <button onClick={r.shuffle} disabled={running}
              className="piece press py-3 font-display font-semibold bg-surface disabled:opacity-50">
              New board
            </button>
          ) : (
            <button onClick={() => setPractice(true)} disabled={running}
              className="piece press py-3 font-display font-semibold bg-surface disabled:opacity-50">
              Practice instead
            </button>
          )}
        </motion.div>
      )}

      {practice ? (
        <motion.div variants={riseIn} className="text-center">
          <button onClick={() => setPractice(false)} disabled={running}
            className="text-[13px] font-black uppercase tracking-wider text-soft underline underline-offset-4 disabled:opacity-40">
            Back to today's tubes
          </button>
        </motion.div>
      ) : (
        <Ladder rows={r.board} mine={r.mine} meId={user?.id} level={level} />
      )}
    </motion.div>
  );
}

/** Today's board for this level: the top twenty, and you if you are below them. */
function Ladder({ rows, mine, meId, level }:
  { rows: Standing[]; mine: Standing | null; meId?: string; level: Level }) {
  const offPage = mine && !rows.some((r) => r.user_id === meId);
  return (
    <motion.div variants={riseIn} className="piece bg-surface p-3">
      <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
        Today · {level} · {rows.length === 0 ? "no times yet" : `${rows.length}${rows.length === 20 ? "+" : ""} sorted it`}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-soft">Be the first on the board.</p>
      ) : (
        <ol className="grid gap-1.5">
          {rows.map((s) => <Row key={s.user_id} s={s} me={s.user_id === meId} />)}
          {offPage && <li className="text-center text-[12px] font-black text-soft">···</li>}
          {offPage && <Row s={mine!} me />}
        </ol>
      )}
    </motion.div>
  );
}

function Row({ s, me }: { s: Standing; me: boolean }) {
  return (
    <li className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${me ? "bg-pop" : ""}`}>
      <span className="w-6 text-[13px] font-black tabular-nums text-soft">{s.position}</span>
      <Avatar id={s.user_id} name={s.username} size={26} />
      <span className={`flex-1 truncate text-sm font-bold ${me ? "" : ""}`}>{s.username}</span>
      <span className="text-[12px] font-bold text-soft tabular-nums">{s.moves} mv</span>
      <span className="font-display text-base font-semibold tabular-nums">{clock(s.ms)}</span>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="piece bg-surface px-2 py-2.5">
      <p className="text-[12px] font-black uppercase tracking-widest text-soft">{label}</p>
      <p className="font-display text-2xl font-semibold leading-none mt-1 tabular-nums">{value}</p>
      <p className="text-[12px] font-bold text-soft mt-1 truncate">{sub}</p>
    </div>
  );
}
