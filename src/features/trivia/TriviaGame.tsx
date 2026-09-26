import { useMemo, useState } from "react";
import { Tick } from "@/shared/brand/Pieces";
import { Dealing } from "@/shared/ui/Note";
import { AnimatePresence, motion } from "framer-motion";
import { useRound } from "@/features/play/useRound";
import { useLockIn } from "@/features/play/lockIn";
import { readFilter, writeFilter } from "@/features/play/filters";
import { readLevels, writeLevels, quizKey, LEVELS, type Level } from "@/features/play/levels";
import { shuffle, shuffleSeeded } from "@/features/play/content";
import { RoundHud, Reveal, Summary, Burst, HintPill, LeaveX } from "@/features/play/RoundChrome";
import { QuizChips, NothingMatches } from "@/features/play/QuizChips";
import { QuestionPanel } from "@/features/squareoff/QuestionPanel";
import { useFocusMode } from "@/app/layout/focus";
import { SPRING } from "@/shared/ui/motion";

const HINTS = 2;

/**
 * Star Trivia, solo (#20, #23, #24), built from the drawings' code. The whole
 * round has the phone (no header or tab bar); an X goes back to the games.
 */
export function TriviaGame() {
  useFocusMode(true);
  const [cats, setCats] = useState<string[]>(() => readFilter("trivia"));
  const [levels, setLevels] = useState<Level[]>(() => readLevels(quizKey("trivia")));
  const r = useRound("trivia", 10, cats, null, levels);
  const lock = useLockIn(r.index);
  const chooseCats = (next: string[]) => { setCats(next); writeFilter("trivia", next); };
  const chooseLevels = (next: Level[]) => { setLevels(next); writeLevels(next, quizKey("trivia")); };
  const chips = (
    <QuizChips levels={levels} onLevels={chooseLevels}
      categories={r.categories.map((c) => c.name)} selected={cats} onCategories={chooseCats} />
  );

  // Shuffle once per question, not per render, or the options jump around.
  const options = useMemo(
    () => (r.current?.choices ? shuffle(r.current.choices) : []),
    [r.current?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * A hint takes one wrong answer away (#20, Daramola 26 Sep): two per
   * question, −100 each. The order they go in is fixed per question, so the
   * second hint takes a second one rather than reshuffling the first.
   */
  const out = useMemo(() => {
    if (!r.current) return new Set<string>();
    const wrong = shuffleSeeded(options.filter((o) => o !== r.current!.answer), r.current.id);
    return new Set(wrong.slice(0, r.hintsUsed));
  }, [r.current?.id, r.hintsUsed, options]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r.phase === "loading") return <><div className="min-h-10 flex items-center"><LeaveX to="/play" label="Back to the games" /></div><Dealing what="the questions" /></>;
  if (r.phase === "empty") return (
    <div className="grid gap-[11px]">
      <div className="min-h-10 flex items-center"><LeaveX to="/play" label="Back to the games" /></div>
      {chips}
      <NothingMatches levels={levels} selected={cats}
        onClear={() => { chooseCats([]); chooseLevels([...LEVELS]); }} />
    </div>
  );

  if (r.phase === "done") {
    return (
      <Summary name="Star Trivia" score={r.score} results={r.results} outcome={r.outcome} onAgain={r.restart} title="STAR TRIVIA">
        <div className="grid gap-2">
          {r.results.map((res, i) => (
            <div key={i} className={`card shadow-lift-sm rounded-2xl p-3 ${res.correct ? "bg-board" : "bg-mist"}`}>
              <p className="text-sm font-bold">{res.item.prompt}</p>
              <p className="text-xs mt-1 font-bold">
                {res.correct
                  ? <span className="text-leaf-deep inline-flex items-center gap-1"><Tick size={14} />{res.item.answer}</span>
                  : <><span className="text-ember-lo line-through">{res.given || "—"}</span>
                      <span className="text-leaf-deep"> → {res.item.answer}</span></>}
              </p>
            </div>
          ))}
        </div>
      </Summary>
    );
  }

  const item = r.current;
  if (!item) return null;
  const revealed = r.phase === "revealed";
  const first = r.index === 0 && !revealed && lock.picked === null;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-20px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      <RoundHud index={r.index} total={r.items.length} score={r.score}
        results={r.results.map((x) => x.correct)} leaveTo="/play" leaveLabel="Back to the games. This round won't count." />
      {first && <div className="mt-[4px]">{chips}</div>}

      <AnimatePresence mode="wait">
        <motion.div key={item.id}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }} transition={SPRING} className="relative mt-[11px]">
          <Burst show={revealed && !!r.last?.correct} />
          <QuestionPanel item={item} options={options}
            chosen={revealed ? r.last?.given ?? null : lock.picked} revealed={revealed}
            locked={revealed || lock.picked !== null} out={out} chip={!first}
            onAnswer={(opt) => lock.pick(opt, (o, at) => r.submit(o, at))} />
        </motion.div>
      </AnimatePresence>

      {r.phase === "playing" ? (
        r.hintsUsed < HINTS && (
          <div className="mt-[11px]">
            <HintPill onClick={r.useHint} disabled={lock.picked !== null}>Hint · {HINTS - r.hintsUsed} left</HintPill>
          </div>
        )
      ) : (
        <Reveal correct={r.last!.correct} near={false} answer={item.answer} answerShown
          gained={r.last!.gained} parts={r.last!.parts} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
