import { Link } from "react-router-dom";
import { Dealing } from "@/shared/ui/Note";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRound } from "@/features/play/useRound";
import { Hud, Reveal } from "@/features/play/RoundChrome";
import { QuestionPanel } from "@/features/squareoff/QuestionPanel";
import { Avatar } from "@/shared/ui/Avatar";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { useDaily, type DailyStanding } from "./useDaily";

const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

function Board({ rows, meId }: { rows: DailyStanding[]; meId?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-soft font-bold text-center">Nobody has played today yet. You're first.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const me = r.user_id === meId;
        return (
          <div key={r.user_id} className={`piece flex items-center gap-3 px-3 py-2.5 ${me ? "bg-pop" : ""}`}>
            <span className="w-6 text-center font-display text-lg font-semibold tabular-nums text-soft">
              {i + 1}
            </span>
            <Avatar id={r.user_id} name={r.username} size={32} />
            <span className="flex-1 font-bold text-[15px] truncate">
              {r.username}
              {me && <span className="text-soft font-black text-[12px] uppercase tracking-widest ml-1.5">you</span>}
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

export function DailyPage() {
  const { user, offline } = useAuth();
  const d = useDaily();
  // Only play the round when it is still to be played; otherwise the board.
  const playable = !!d.items && !d.mine;
  const r = useRound("trivia", 10, [], playable ? d.items : null);

  const filed = useRef(false);
  useEffect(() => {
    if (r.phase !== "done" || filed.current || !playable) return;
    filed.current = true;
    const correct = r.results.filter((x) => x.correct).length;
    const ms = r.results.reduce((n, x) => n + x.msTaken, 0);
    void d.submit(r.score, correct, r.results.length, ms);
  }, [r.phase, r.results, r.score, playable, d]);

  if (offline) {
    return <p className="text-sm text-soft font-bold">The daily round needs a database. Single-player works without one.</p>;
  }
  if (!user) {
    return (
      <div className="piece p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Today's round</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          Ten questions, the same ten for everyone, once a day. Sign in to play it and take a place on the board.
        </p>
        <Link to="/profile" className="piece press block mt-5 py-3.5 font-display text-lg font-semibold bg-pop">
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
        {d.error && (
          <motion.p variants={riseIn} className="text-sm text-bad font-bold">{d.error}</motion.p>
        )}
        <motion.div variants={riseIn}>
          <p className="text-[12px] font-black uppercase tracking-widest text-soft">Today's round</p>
          <h1 className="font-display text-[30px] leading-none font-semibold mt-1">
            {d.mine ? `${d.mine.correct} out of 10` : "Round filed"}
          </h1>
          <p className="text-sm text-soft font-semibold mt-1">
            {d.mine ? `In ${secs(d.mine.ms)}. One go a day — back tomorrow.` : "Counting you in…"}
          </p>
        </motion.div>
        <motion.div variants={popIn}><Board rows={d.board} meId={user.id} /></motion.div>
        <motion.p variants={riseIn} className="text-[12px] font-bold text-soft text-center">
          Same ten questions for everyone, so the scores actually mean something.
        </motion.p>
      </motion.div>
    );
  }

  if (d.error) return <p className="text-sm text-bad font-bold">{d.error}</p>;
  if (r.phase === "loading") return <Dealing what="the round" />;
  if (r.phase === "empty") return <p className="text-sm text-soft font-bold">No round today.</p>;

  const item = r.current;
  if (!item) return null;
  const revealed = r.phase === "revealed";

  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
        Today's round · one go
      </p>
      <Hud index={r.index} total={r.items.length} score={r.score} streak={r.streak} accent="#FF2E88" />
      <div className="mt-5">
        <QuestionPanel
          item={item} options={item.choices ?? []} chosen={r.last?.given ?? null}
          revealed={revealed} locked={revealed}
          onAnswer={(opt) => r.submit(opt)} />
      </div>
      {revealed && (
        <Reveal correct={r.last!.correct} near={false} answer={item.answer}
          gained={r.last!.gained} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
