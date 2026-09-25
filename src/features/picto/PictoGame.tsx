import { useEffect, useRef, useState } from "react";
import { useSeenHeight } from "@/shared/lib/useSeenHeight";
import { RAMPS } from "@/shared/brand/tokens";
import { Dealing } from "@/shared/ui/Note";
import { AnimatePresence, motion } from "framer-motion";
import { useRound } from "@/features/play/useRound";
import { CategoryBar } from "@/features/play/CategoryBar";
import { readFilter, writeFilter } from "@/features/play/filters";
import { Hud, HintBar, Reveal, Summary, Burst } from "@/features/play/RoundChrome";
import { PictoRenderer, PICTURE_ALT } from "./PictoRenderer";
import { SPRING, shake } from "@/shared/ui/motion";

export function PictoGame() {
  const [cats, setCats] = useState<string[]>(() => readFilter("picto"));
  const r = useRound("picto", 8, cats);
  const chooseCats = (next: string[]) => { setCats(next); writeFilter("picto", next); };
  const filterBar = (
    <CategoryBar categories={r.categories} selected={cats} onChange={chooseCats} />
  );
  const [guess, setGuess] = useState("");
  const pictureRef = useRef<HTMLDivElement>(null);
  const seen = useSeenHeight();

  // The picture comes first (talk item 6): the keyboard waits for a tap on the
  // box. Putting the cursor there on every picture opened the keyboard over
  // the picture on Android (iPhones ignore a focus that isn't from a tap).
  useEffect(() => {
    if (r.phase === "playing") setGuess("");
  }, [r.phase, r.index, r.current?.id]);   // a skip keeps the index, not the picture

  if (r.phase === "loading") return <>{filterBar}<Dealing what="the puzzles" /></>;
  if (r.phase === "empty") return (
    <>{filterBar}<p className="text-soft font-bold">
      {cats.length ? "Nothing live in those categories yet — widen the filter." : "No picto puzzles are live yet."}
    </p></>
  );

  if (r.phase === "done") {
    return (
      <>
      {filterBar}
      <Summary score={r.score} results={r.results} outcome={r.outcome} onAgain={r.restart} title="PICTO PHRASE">
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
      </>
    );
  }

  const item = r.current;
  if (!item) return null;
  const wrong = r.phase === "revealed" && !r.last?.correct;

  return (
    <div>
      <Hud index={r.index} total={r.items.length} score={r.score} streak={r.streak} accent={RAMPS.sky.base} />

      <div className="relative mt-4">
        <Burst show={r.phase === "revealed" && !!r.last?.correct} />
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9, rotate: -1.5 }}
            animate={wrong ? { opacity: 1, scale: 1, rotate: 0, ...shake } : { opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={SPRING}
            ref={pictureRef}
            // With the keyboard up, the picture shrinks to share what's left of
            // the screen with the box, instead of being pushed off the top.
            style={{ maxHeight: `min(46vh, ${Math.round(seen * 0.42)}px)` }}
            className="card aspect-square mx-auto w-full grid place-items-center p-7 text-ember scroll-mt-20"
          >
            {item.render === "image" && item.imageUrl
              ? <img src={item.imageUrl} alt={PICTURE_ALT} className="max-h-full object-contain rounded-xl" />
              : item.spec && <PictoRenderer spec={item.spec} animate seed={item.id} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-3 text-[12px] font-black text-soft text-center">
        {item.difficulty}{item.category ? ` · ${item.category}` : ""}
      </p>

      {r.phase === "playing" ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); if (guess.trim()) r.submit(guess); }}
            className="mt-4 flex gap-2.5">
            <input value={guess} onChange={(e) => setGuess(e.target.value)}
              aria-label="Your guess" placeholder="What phrase is this?" autoComplete="off" autoCapitalize="none"
              // Autocorrect "fixed" right answers into wrong ones (Nollywood ->
              // Hollywood); the judge already forgives a slip or two.
              autoCorrect="off" spellCheck={false} enterKeyHint="go"
              onFocus={() => setTimeout(() => pictureRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 350)}
              className="flex-1 bg-board shadow-lift-sm rounded-2xl px-4 py-3.5
                font-bold text-ink placeholder:text-soft/60 outline-none
                focus:shadow-[0_5px_0_var(--color-ink)] transition-shadow" />
            <button type="submit" disabled={!guess.trim()}
              className="cut tap cut-ember text-ink font-display text-lg font-semibold px-6">
              Go
            </button>
          </form>
          <HintBar item={item} used={r.hintsUsed} onUse={r.useHint} />
          {/* Stuck (talk item 5): skip once, then Show me, which counts as a miss. */}
          <button onClick={r.canSkip ? r.skip : r.giveUp}
            className="mt-2 text-[13px] font-bold text-soft underline underline-offset-4 min-h-[44px]">
            {r.canSkip ? "Skip for now: it comes back at the end" : "Show me the answer (counts as a miss)"}
          </button>
        </>
      ) : (
        <Reveal correct={r.last!.correct} near={r.last!.near} answer={item.answer}
          gained={r.last!.gained} parts={r.last!.parts} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
