import { useMemo, useState } from "react";
import { RAMPS } from "@/shared/brand/tokens";
import { AnswerMark, Tick } from "@/shared/brand/Pieces";
import { Dealing } from "@/shared/ui/Note";
import { AnimatePresence, motion } from "framer-motion";
import { useRound } from "@/features/play/useRound";
import { useLockIn } from "@/features/play/lockIn";
import { CategoryBar } from "@/features/play/CategoryBar";
import { readFilter, writeFilter } from "@/features/play/filters";
import { shuffle } from "@/features/play/content";
import { Hud, Reveal, Summary, Burst } from "@/features/play/RoundChrome";
import { SPRING, stagger, riseIn } from "@/shared/ui/motion";


export function TriviaGame() {
  const [cats, setCats] = useState<string[]>(() => readFilter("trivia"));
  const r = useRound("trivia", 10, cats);
  const lock = useLockIn(r.index);
  const chooseCats = (next: string[]) => { setCats(next); writeFilter("trivia", next); };
  const filterBar = (
    <CategoryBar categories={r.categories} selected={cats} onChange={chooseCats} />
  );

  // Shuffle once per question, not per render, or the options jump around.
  const options = useMemo(
    () => (r.current?.choices ? shuffle(r.current.choices) : []),
    [r.current?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * 50/50 rather than a written hint. On four options a letter count usually
   * identifies the answer outright, so an authored hint is either useless or a
   * giveaway; burning two wrong options is a real cost/benefit choice instead.
   */
  const burned = useMemo(() => {
    if (!r.current || r.hintsUsed === 0) return new Set<string>();
    const wrong = options.filter((o) => o !== r.current!.answer);
    return new Set(shuffle(wrong).slice(0, 2));
  }, [r.current?.id, r.hintsUsed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r.phase === "loading") return <>{filterBar}<Dealing what="the questions" /></>;
  if (r.phase === "empty") return (
    <>{filterBar}<p className="text-soft font-bold">
      {cats.length ? "Nothing live in those categories yet — widen the filter." : "No trivia is live yet."}
    </p></>
  );

  if (r.phase === "done") {
    return (
      <>
      {filterBar}
      <Summary score={r.score} results={r.results} outcome={r.outcome} onAgain={r.restart} title="STAR TRIVIA">
        <div className="grid gap-2.5">
          {r.results.map((res, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: 0.3 + i * 0.04 }}
              className={`card p-3 ${res.correct ? "bg-board" : "bg-mist"}`}>
              <p className="text-sm font-bold">{res.item.prompt}</p>
              <p className="text-xs mt-1 font-bold">
                {res.correct
                  ? <span className="text-leaf-deep inline-flex items-center gap-1"><Tick size={14} />{res.item.answer}</span>
                  : <><span className="text-ember line-through">{res.given}</span>
                      <span className="text-leaf"> → {res.item.answer}</span></>}
              </p>
            </motion.div>
          ))}
        </div>
      </Summary>
      </>
    );
  }

  const item = r.current;
  if (!item) return null;
  const revealed = r.phase === "revealed";

  return (
    <div>
      <Hud index={r.index} total={r.items.length} score={r.score} streak={r.streak} accent={RAMPS.sky.base} />

      <AnimatePresence mode="wait">
        <motion.div key={item.id}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }} transition={SPRING} className="relative">
          <Burst show={revealed && !!r.last?.correct} />

          <span className="inline-block mt-4 text-[12px] font-black
            bg-sky text-board rounded-full px-2.5 py-1">
            {item.category} · {item.difficulty}
          </span>
          <h2 className="mt-2.5 font-display text-[26px] leading-tight font-semibold text-balance">
            {item.prompt}
          </h2>

          <motion.div variants={stagger(0.055, 0.1)} initial="hidden" animate="show"
            className="mt-4 grid gap-2">
            {options.map((opt, i) => {
              const isBurned = burned.has(opt);
              const isAnswer = opt === item.answer;
              const isMine = revealed && r.last?.given === opt;
              const bg = isBurned && !revealed ? "bg-board opacity-25 line-through"
                : !revealed ? (lock.picked === opt ? "bg-petal" : "bg-board")
                : isAnswer ? "bg-leaf text-ink"
                : isMine ? "bg-ember text-ink" : "bg-board opacity-45";
              return (
                <motion.button key={opt} variants={riseIn}
                  disabled={revealed || isBurned || lock.picked !== null}
                  onClick={() => lock.pick(opt, (o, at) => r.submit(o, at))}
                  whileTap={revealed || lock.picked !== null ? undefined : { scale: 0.97 }}
                  className={`card ${revealed ? "" : "tap"} flex items-center gap-3 text-left px-4 py-3.5 ${bg}`}>
                  <span aria-hidden={!(revealed && (isAnswer || isMine))} className="text-base shrink-0"
                    >
                  <AnswerMark index={i} state={revealed && isAnswer ? "right" : revealed && isMine ? "wrong" : "idle"} />
                  </span>
                  {revealed && isAnswer && <span className="sr-only">Correct answer: </span>}
                  {revealed && isMine && !isAnswer && <span className="sr-only">Your incorrect answer: </span>}
                  <span className="text-[15px] font-bold">{opt}</span>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {r.phase === "playing" ? (
        r.hintsUsed === 0 && (
          <button onClick={r.useHint} disabled={lock.picked !== null}
            className="cut tap mt-4 disabled:opacity-50 text-xs font-black px-4 min-h-[44px] inline-flex items-center rounded-xl cut-petal">
            50 / 50 — burn two wrong answers · −100
          </button>
        )
      ) : (
        <Reveal correct={r.last!.correct} near={false} answer={item.answer}
          gained={r.last!.gained} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
