import { useEffect, useRef, useState } from "react";
import { useSeenHeight } from "@/shared/lib/useSeenHeight";
import { Dealing } from "@/shared/ui/Note";
import { AnimatePresence, motion } from "framer-motion";
import { useRound } from "@/features/play/useRound";
import { QuizChips, NothingMatches } from "@/features/play/QuizChips";
import { readLevels, writeLevels, quizKey, LEVELS, type Level } from "@/features/play/levels";
import { useFocusMode } from "@/app/layout/focus";
import { readFilter, writeFilter } from "@/features/play/filters";
import { RoundHud, HintPill, LeaveX, Reveal, Summary, Burst } from "@/features/play/RoundChrome";
import { PictoRenderer, PICTURE_ALT } from "./PictoRenderer";
import { SPRING, shake } from "@/shared/ui/motion";

export function PictoGame() {
  // The whole round has the phone (#21–#23): no header or tab bar.
  useFocusMode(true);
  const [cats, setCats] = useState<string[]>(() => readFilter("picto"));
  const [levels, setLevels] = useState<Level[]>(() => readLevels(quizKey("picto")));
  const r = useRound("picto", 8, cats, null, levels);
  const chooseCats = (next: string[]) => { setCats(next); writeFilter("picto", next); };
  const chooseLevels = (next: Level[]) => { setLevels(next); writeLevels(next, quizKey("picto")); };
  const chips = (
    <QuizChips levels={levels} onLevels={chooseLevels}
      categories={r.categories.map((c) => c.name)} selected={cats} onCategories={chooseCats} />
  );
  const back = <div className="min-h-10 flex items-center"><LeaveX to="/play" label="Back to the games" /></div>;
  const [guess, setGuess] = useState("");
  const pictureRef = useRef<HTMLDivElement>(null);
  const seen = useSeenHeight();

  // The picture comes first (talk item 6): the keyboard waits for a tap on the
  // box. Putting the cursor there on every picture opened the keyboard over
  // the picture on Android (iPhones ignore a focus that isn't from a tap).
  useEffect(() => {
    if (r.phase === "playing") setGuess("");
  }, [r.phase, r.index, r.current?.id]);   // a skip keeps the index, not the picture

  if (r.phase === "loading") return <>{back}<Dealing what="the puzzles" /></>;
  if (r.phase === "empty") return (
    <div className="grid gap-[11px]">
      {back}
      {chips}
      <NothingMatches levels={levels} selected={cats}
        onClear={() => { chooseCats([]); chooseLevels([...LEVELS]); }} />
    </div>
  );

  if (r.phase === "done") {
    return (
      <Summary name="Picto Phrase" score={r.score} results={r.results} outcome={r.outcome} onAgain={r.restart} title="PICTO PHRASE">
        <div className="grid gap-2.5">
          {r.results.map((res, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: 0.3 + i * 0.05 }}
              className="card p-3 flex items-center gap-3">
              <div className={`w-14 h-14 shrink-0 rounded-xl shadow-lift-sm p-1
                ${res.correct ? "bg-leaf text-ink" : "bg-mist text-ink"}`}>
                {res.item.spec && <PictoRenderer spec={res.item.spec} />}
              </div>
              <div className="min-w-0">
                <p className="font-display font-semibold truncate">{res.item.answer}</p>
                {!res.correct && (
                  <p className="text-xs text-ember font-bold truncate">you said: {res.given || "—"}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Summary>
    );
  }

  const item = r.current;
  if (!item) return null;
  const wrong = r.phase === "revealed" && !r.last?.correct;
  const revealed = r.phase === "revealed";
  const clues = [item.altHint, item.charHint].filter((h): h is string => !!h);
  const first = r.index === 0 && r.phase === "playing" && r.hintsUsed === 0 && !guess;

  // #21–#22 from the drawings' code: the hud, the picture as the hero (.rebus:
  // white, 22px corners, the full width), the hint pills, then the answer box
  // with Go beside it, sitting on the keyboard.
  return (
    <div className="flex flex-col min-h-[calc(100dvh-20px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      <RoundHud index={r.index} total={r.items.length} score={r.score}
        results={r.results.map((x) => x.correct)} leaveTo="/play" leaveLabel="Back to the games. This round won't count." />
      {first && <div className="mt-[4px]">{chips}</div>}

      <div className="relative mt-[11px]">
        <Burst show={revealed && !!r.last?.correct} />
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9, rotate: -1.5 }}
            animate={wrong ? { opacity: 1, scale: 1, rotate: 0, ...shake } : { opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={SPRING}
            ref={pictureRef}
            // With the keyboard up, the picture shrinks to share what's left of
            // the screen with the box, instead of being pushed off the top (Q11).
            style={{ maxHeight: `min(46vh, ${Math.round(seen * 0.42)}px)` }}
            className="card shadow-lift-sm rounded-[22px] aspect-square mx-auto w-full grid place-items-center p-6 text-ink scroll-mt-20"
          >
            {item.render === "image" && item.imageUrl
              ? <img src={item.imageUrl} alt={PICTURE_ALT} className="max-h-full object-contain rounded-xl" />
              : item.spec && <PictoRenderer spec={item.spec} animate seed={item.id} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {r.phase === "playing" ? (
        <>
          {/* The hints as pills (#21): what it is, each clue bought, and the
              button for the next one (−100 each, as before). */}
          <div className="mt-[11px] flex flex-wrap items-center gap-1.5">
            {item.category && <HintPill>{item.category}</HintPill>}
            {clues.slice(0, r.hintsUsed).map((h, i) => <HintPill key={i}>{h}</HintPill>)}
            {r.hintsUsed < clues.length && (
              <HintPill onClick={r.useHint}>Hint · {clues.length - r.hintsUsed} left</HintPill>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (guess.trim()) r.submit(guess); }}
            className="mt-[11px] flex items-center gap-2.5">
            <input value={guess} onChange={(e) => setGuess(e.target.value)}
              aria-label="Your guess" placeholder="What phrase is this?" autoComplete="off" autoCapitalize="none"
              // Autocorrect "fixed" right answers into wrong ones (Nollywood ->
              // Hollywood); the judge already forgives a slip or two.
              autoCorrect="off" spellCheck={false} enterKeyHint="go"
              onFocus={() => setTimeout(() => pictureRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 350)}
              className="flex-1 min-w-0 bg-board rounded-[14px] px-3.5 py-3 font-semibold text-ink placeholder:text-soft
                outline-none shadow-[inset_0_0_0_2px_var(--color-hair)] focus:shadow-[inset_0_0_0_2.5px_var(--color-sky)] transition-shadow" />
            <button type="submit" disabled={!guess.trim()}
              className="cut tap cut-petal shrink-0 min-h-[42px] px-3 font-display text-[16px]">
              Go
            </button>
          </form>
          {/* Stuck (talk item 5, kept): skip once, then Show me, which counts as a miss. */}
          <button onClick={r.canSkip ? r.skip : r.giveUp}
            className="mt-1 self-center text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px]">
            {r.canSkip ? "Skip for now: it comes back at the end" : "Show me the answer (counts as a miss)"}
          </button>
        </>
      ) : (
        <Reveal correct={r.last!.correct} near={r.last!.near} answer={item.answer} given={r.last!.given}
          gained={r.last!.gained} parts={r.last!.parts} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
