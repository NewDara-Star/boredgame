import { Link } from "react-router-dom";
import { RAMPS } from "@/shared/brand/tokens";
import { Dealing } from "@/shared/ui/Note";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { Hud, Reveal } from "@/features/play/RoundChrome";
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
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const me = r.user_id === meId;
        return (
          <div key={r.user_id} className={`card flex items-center gap-3 px-3 py-2.5 ${me ? "bg-petal" : ""}`}>
            <span className="w-6 text-center font-display text-lg font-semibold tabular-nums text-soft">
              {i + 1}
            </span>
            <Avatar id={r.user_id} name={r.username} size={32} />
            <span className="flex-1 font-bold text-[15px] truncate">
              {r.username}
              {me && <span className="text-soft font-black text-[12px] ml-1.5">you</span>}
            </span>
            <span className="text-right">
              <b className="block font-display text-lg font-semibold tabular-nums leading-none">
                {r.correct}<span className="text-soft text-sm">/10</span>
              </b>
              <span className="text-[12px] font-bold text-soft tabular-nums">{secs(r.ms)}</span>
            </span>
          </div>
        );
      })}
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
    <div className="space-y-2.5">
      {card && <img src={card.url} alt={`Today's round: ${correct} of 10`} className="w-full rounded-2xl shadow-lift-sm" />}
      <ShareButtons card={card} />
      <button onClick={() => void shareResult({ text, url: linkTo("/daily") })
          .then((r) => { if (r === "copied") { setSaid("Copied"); setTimeout(() => setSaid(""), 2200); } })}
        className="block mx-auto text-[13px] font-black text-soft underline underline-offset-4">
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

  if (offline) {
    return <p className="text-sm text-soft font-bold">The daily round needs a database. Single-player works without one.</p>;
  }
  if (!user) {
    return (
      <div className="card p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Today's round</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          Ten questions, the same ten for everyone, once a day. Sign in to play it and take a place on the board.
        </p>
        <Link to="/profile" className="cut tap block mt-5 py-3.5 font-display text-lg font-semibold cut-petal">
          Sign in
        </Link>
      </div>
    );
  }
  if (d.loading) return <Dealing what="today's round" />;

  // Already played, or just finished: the board is the screen. A submit error
  // must NOT wipe the result the player just earned -- it shows as a banner here,
  // while a genuine load error (no result to show) falls through below.
  if (d.mine || r.phase === "done") {
    return (
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={riseIn}>
          <p className="text-[12px] font-black text-soft">Today's round</p>
          <h1 className="font-display text-[30px] leading-none font-semibold mt-1">
            {d.mine ? `${d.mine.correct} out of 10` : d.filing === "failed" ? "Not saved yet" : "Saving your round…"}
          </h1>
          <p className="text-sm text-soft font-semibold mt-1">
            {d.mine ? `In ${secs(d.mine.ms)}. One go a day — back tomorrow.`
              : d.filing === "failed" ? "Your answers are safe on the server. It just needs filing." : "One moment."}
          </p>
          {/* Only a real failure shows, with the one thing that fixes it. Filing
              again can't change a score: the server keeps the first one. */}
          {!d.mine && d.filing === "failed" && (
            <div className="mt-3 space-y-2">
              {d.error && <p className="text-sm text-ember font-bold">{d.error}</p>}
              <button onClick={() => void d.finalize()}
                className="cut tap w-full py-3.5 font-display text-lg font-semibold cut-petal">
                Try again
              </button>
            </div>
          )}
        </motion.div>
        {d.mine && (
          <motion.div variants={riseIn}>
            <DailyShare day={d.day} correct={d.mine.correct} ms={d.mine.ms} score={d.mine.score} />
          </motion.div>
        )}
        <motion.div variants={popIn}>
          <Board rows={d.board} meId={user.id} error={d.boardError} onRetry={() => void d.refresh()} />
        </motion.div>
        <motion.p variants={riseIn} className="text-[12px] font-bold text-soft text-center">
          Same ten questions for everyone, so the scores actually mean something.
        </motion.p>
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
    <div>
      <p className="text-[12px] font-black text-soft mb-2">
        Today's round · one go
      </p>
      <Hud index={r.index} total={r.total} score={r.score} streak={r.streak} accent={RAMPS.petal.base} />
      <div className="mt-5">
        <QuestionPanel
          item={item} options={item.choices ?? []} chosen={r.chosen ?? null}
          revealed={revealed} locked={revealed || r.pending !== null}
          answer={r.last?.answer} onAnswer={(opt) => void r.submit(opt)} />
      </div>
      {revealed && r.last && (
        <Reveal correct={r.last.correct} near={false} answer={r.last.answer}
          gained={r.last.gained} onNext={() => void r.next()} isLast={r.index + 1 >= r.total}
          explanation={r.last.explanation} />
      )}
    </div>
  );
}
