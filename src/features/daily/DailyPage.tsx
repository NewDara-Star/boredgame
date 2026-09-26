import { Link } from "react-router-dom";
import { partsOf } from "@/features/play/scoring";
import { Dealing } from "@/shared/ui/Note";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { Reveal } from "@/features/play/RoundChrome";
import { QuestionPanel } from "@/features/squareoff/QuestionPanel";
import { Avatar } from "@/shared/ui/Avatar";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { useDaily, type DailyStanding } from "./useDaily";
import { useDailyPlay } from "./useDailyPlay";
import { readGrid } from "./grid";
import { useEffect, useState } from "react";
import { drawCard, shareResult, type MatchCard } from "@/shared/card/frame";
import { ShareButtons } from "@/shared/card/ShareButtons";
import { linkTo } from "@/shared/card/voice";
import { roundHero } from "@/features/play/roundCard";
import { GuestCard } from "@/features/profile/GuestCard";
import { Sunflower } from "@/shared/brand/Sunflower";
import { Counter } from "@/shared/ui/Counter";
import { useFocusMode } from "@/app/layout/focus";

const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

function Board({ rows, meId, error, onRetry }:
  { rows: DailyStanding[]; meId?: string; error?: boolean; onRetry?: () => void }) {
  if (error) {
    return (
      <p className="text-sm text-soft font-bold text-center">
        Couldn't load today's board.{" "}
        {onRetry && <button onClick={onRetry} className="underline underline-offset-4 font-black">Try again</button>}
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-soft font-bold text-center">Nobody has played today yet. You're first.</p>;
  }
  // From the drawing's code (.list, .li, .li.me): 8px apart, white rows with
  // the place and name on one line and the detail under it; you in gold, as
  // "You". The points stay in the detail: the board ranks by them (talk item 8).
  return (
    <div className="grid gap-2">
      {rows.map((r, i) => {
        const me = r.user_id === meId;
        return (
          <div key={r.user_id}
            className={`card shadow-lift-sm rounded-2xl flex items-center gap-2.5 px-3 py-[9px] ${me ? "bg-petal" : ""}`}>
            <Avatar id={r.user_id} name={r.username} size={34} />
            <div className="min-w-0 flex-1">
              <b className="block text-[15px] leading-[1.2] font-bold truncate">
                <span className="tabular-nums">{i + 1}</span>{"\u00A0\u00A0"}{me ? "You" : r.username}
                {r.guest && !me && <span className="text-soft font-extrabold text-[12px] ml-1.5">guest</span>}
              </b>
              <small className={`block text-[12px] font-semibold tabular-nums ${me ? "text-ink" : "text-soft"}`}>
                {r.correct}/10 · {r.score.toLocaleString("en-GB")} pts · {secs(r.ms)}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The top of a round in play (#16): an X out, a seed for each question (green
    right, red wrong, gold for this one), and the points. No clock: you're never
    timed on screen while you answer (talk item 4, kept 26 Sep). */
function DailyHud({ index, total, grid, score }:
  { index: number; total: number; grid: boolean[]; score: number }) {
  const right = grid.filter(Boolean).length;
  // From the drawing's code (.hud, .x, .seeds, .score): a 38px white X, ten
  // 12px seeds 4px apart, the score in mono at 16px pushed to the right.
  return (
    <div className="flex items-center gap-2.5">
      {/* Nothing is lost by leaving: every answer is already filed, and the round
          carries on from the next question when you come back. 44px to tap, 38 to see. */}
      <Link to="/" aria-label="Leave. Your answers count and the round waits for you."
        className="shrink-0 grid place-items-center w-11 h-11 -m-[3px]">
        <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-board shadow-lift-sm">
          <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
            <path d="M3 3l10 10M13 3L3 13" stroke="var(--color-ink-day)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </span>
      </Link>
      <div className="flex items-center gap-1" role="img"
        aria-label={`Question ${index + 1} of ${total}. ${right} right so far.`}>
        {Array.from({ length: total }, (_, i) => {
          const was = grid[i];
          const ramp = was === true ? "leaf" : was === false ? "ember" : i === index ? "petal" : null;
          // An answered seed is a subject: lit from the top left, with the ink ring
          // (BRAND.md rule 1). One still to come is pale, with a faint ring.
          return (
            <i key={i} className="block w-3 h-3 rounded-full shrink-0" style={ramp ? {
              background: `radial-gradient(circle at 35% 30%, var(--color-${ramp}-hi), var(--color-${ramp}) 65%)`,
              boxShadow: "0 0 0 2px var(--color-ink-day)",
              transform: was === undefined ? "scale(1.2)" : undefined,
            } : { background: "rgba(255,255,255,.55)", boxShadow: "inset 0 0 0 2px rgba(35,26,61,.25)" }} />
          );
        })}
      </div>
      <Counter value={score} className="ml-auto font-mono text-[16px] font-bold shrink-0" />
    </div>
  );
}

const RIGHT = "\u{1F7E9}", WRONG = "\u{1F7E5}"; // green and red squares, for the text grid only

/** The day, spoiler-free: the text grid (Wordle's trick) and the card. The grid
    only appears when this phone saw the order of the answers. */
function DailyShare({ day, correct, ms, score }: { day: string; correct: number; ms: number; score: number }) {
  const [card, setCard] = useState<MatchCard | null>(null);
  const [said, setSaid] = useState("");
  const grid = readGrid(day);
  const date = new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  // Squares only when all ten are known (the server's grid, kept at filing): half
  // a grid from one phone of two looks like half a round.
  const full = grid && grid.length === 10 ? grid : null;
  const rows = full ? [full.slice(0, 5), full.slice(5)].map((r) => r.map((ok) => (ok ? RIGHT : WRONG)).join("")).join("\n") : "";
  const dare = correct === 10 ? "Can you match it?" : `Can you beat ${correct}?`;   // the card's words
  const text = `BoredGame daily, ${date}\n${correct}/10 in ${secs(ms)}${rows ? `\n${rows}` : ""}\n${dare}`;
  useEffect(() => {
    let cancelled = false;
    const results = full?.map((ok) => ({ correct: ok }))
      ?? Array.from({ length: 10 }, (_, i) => ({ correct: i < correct }));
    void drawCard({
      title: "TODAY'S ROUND", code: null, path: "/daily", where: `Today's round · ${date}`,
      headline: `${correct}/10 on today's round`, hero: roundHero(results, score),
      caption: `Today's round · ${date} · ${secs(ms)}`,
      dare,
      flower: correct >= 7 ? "bloom" : correct >= 4 ? "awake" : "bored", text,
    }).then((m) => { if (!cancelled) setCard(m); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, correct, ms, score]);
  return (
    <div className="grid gap-[11px]">
      {card && <img src={card.url} alt={`Today's round: ${correct} of 10`} className="w-full rounded-[18px] shadow-lift" />}
      <ShareButtons card={card} />
      <button onClick={() => void shareResult({ text, url: linkTo("/daily") })
          .then((r) => { if (r === "copied") { setSaid("Copied"); setTimeout(() => setSaid(""), 2200); } })}
        className="justify-self-center text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] -my-2.5">
        {said || "Share as text"}
      </button>
    </div>
  );
}

export function DailyPage() {
  const { user, offline } = useAuth();
  const d = useDaily();
  // Play only when the round is still to be played; otherwise show the board.
  const enabled = !d.loading && !d.mine;
  const r = useDailyPlay(d, enabled);
  // A round in play gets the whole phone (#16): no header, no tab bar.
  useFocusMode(!!user && enabled && !d.error && (r.phase === "playing" || r.phase === "revealed"));

  if (offline) {
    return <p className="text-sm text-soft font-bold">The daily round needs a database. Single-player works without one.</p>;
  }
  // Everyone can play it (talk item 8): a name makes a guest, as a room
  // invite does. It used to say "Sign in", as if an account were needed.
  if (!user) {
    // #15, from the drawing's code (.ttl, .card.center padding 20, .field, .cut,
    // .link): one card, a name and Play. The board needs a name, not a login.
    return (
      <div className="grid gap-[11px]">
        <h1 className="font-display text-[29px] leading-none min-h-10 flex items-center">Today's round</h1>
        <div className="card shadow-lift-sm rounded-[20px] p-5 grid gap-2 justify-items-center text-center">
          <Sunflower state="awake" size={96} />
          <h3 className="font-display text-[22px] leading-[1.1]">One go a day</h3>
          <p className="text-[14px] font-semibold text-soft">
            Ten questions, the same for everyone. Pick a name to get on today's board.
          </p>
          <div className="w-full text-left"><GuestCard bare /></div>
          {/* Not in the drawing: the one place a new guest hears about the 30 days. */}
          <p className="text-[12px] font-semibold text-soft">No password. Kept for 30 days after you last play.</p>
          <Link to="/you" className="text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] grid place-items-center">
            I have an account
          </Link>
        </div>
      </div>
    );
  }
  if (d.loading) return <Dealing what="today's round" />;

  // Already played, or just finished: the board is the screen. A submit error
  // must NOT wipe the result the player just earned -- it shows as a banner here,
  // while a genuine load error (no result to show) falls through below.
  if (d.mine || r.phase === "done") {
    return (
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-[11px]">
        {/* #19: your card first, then Share and Story, then everyone on the
            board with you in gold. The card already says the score, so the
            score heading above it went. */}
        <motion.h1 variants={riseIn} className="font-display text-[29px] leading-none min-h-10 flex items-center">Today's round</motion.h1>
        {!d.mine && (
          <motion.div variants={riseIn}>
            <p className="font-display text-[22px] leading-tight font-semibold">
              {d.filing === "failed" ? "Not saved yet" : "Saving your round…"}
            </p>
            <p className="text-sm text-soft font-semibold mt-1">
              {d.filing === "failed" ? "Your answers are safe on the server. It just needs filing." : "One moment."}
            </p>
            {/* Only a real failure shows, with the one thing that fixes it. Filing
                again can't change a score: the server keeps the first one. */}
            {d.filing === "failed" && (
              <div className="mt-3 space-y-2">
                {d.error && <p className="text-sm text-ember font-bold">{d.error}</p>}
                <button onClick={() => void d.finalize()}
                  className="cut tap w-full py-3.5 font-display text-lg font-semibold cut-petal">
                  Try again
                </button>
              </div>
            )}
          </motion.div>
        )}
        {d.mine && (
          <motion.div variants={riseIn}>
            <DailyShare day={d.day} correct={d.mine.correct} ms={d.mine.ms} score={d.mine.score} />
          </motion.div>
        )}
        <motion.div variants={popIn}>
          <Board rows={d.board} meId={user.id} error={d.boardError} onRetry={() => void d.refresh()} />
        </motion.div>
      </motion.div>
    );
  }

  if (d.error) {
    return (
      <div className="card p-5 space-y-3">
        <p className="text-sm text-ember font-bold">{d.error}</p>
        <button onClick={r.retry} className="cut tap w-full py-3.5 font-display text-lg font-semibold cut-petal">
          Try again
        </button>
      </div>
    );
  }
  if (r.phase === "loading") return <Dealing what="the round" />;
  if (r.phase === "empty") return <p className="text-sm text-soft font-bold">No round today.</p>;

  const item = r.current;
  if (!item) return null;
  const revealed = r.phase === "revealed";

  return (
    // The drawing's screen is a column that fills the phone (.scr), so Next
    // lands at the foot of it rather than straight under the card.
    <div className="flex flex-col min-h-[calc(100dvh-20px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      <DailyHud index={r.index} total={r.total} score={r.score}
        grid={r.grid.length ? r.grid : readGrid(d.day) ?? []} />
      <div className="mt-[11px]">
        <QuestionPanel
          item={item} options={item.choices ?? []} chosen={r.chosen ?? null}
          revealed={revealed} locked={revealed || r.pending !== null}
          answer={r.last?.answer} onAnswer={(opt) => void r.submit(opt)} />
      </div>
      {revealed && r.last && (
        <Reveal correct={r.last.correct} near={false} answer={r.last.answer}
          gained={r.last.gained} parts={r.last.correct ? partsOf(r.last.gained, r.last.streak) : null}
          onNext={() => void r.next()} isLast={r.index + 1 >= r.total}
          explanation={r.last.explanation} answerShown />
      )}
    </div>
  );
}
