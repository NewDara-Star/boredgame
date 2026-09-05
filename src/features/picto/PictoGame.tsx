import { useEffect, useRef, useState } from "react";
import { Dealing } from "@/shared/ui/Note";
import { AnimatePresence, motion } from "framer-motion";
import { useRound } from "@/features/play/useRound";
import { CategoryBar } from "@/features/play/CategoryBar";
import { readFilter, writeFilter } from "@/features/play/filters";
import { Hud, HintBar, Reveal, Summary, Burst } from "@/features/play/RoundChrome";
import { PictoRenderer } from "./PictoRenderer";
import { SPRING, shake } from "@/shared/ui/motion";

export function PictoGame() {
  const [cats, setCats] = useState<string[]>(() => readFilter("picto"));
  const r = useRound("picto", 8, cats);
  const chooseCats = (next: string[]) => { setCats(next); writeFilter("picto", next); };
  const filterBar = (
    <CategoryBar categories={r.categories} selected={cats} onChange={chooseCats} />
  );
  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (r.phase === "playing") { setGuess(""); inputRef.current?.focus(); }
  }, [r.phase, r.index]);

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
              className="piece p-3 flex items-center gap-3">
              <div className={`w-14 h-14 shrink-0 rounded-xl border-2 border-ink p-1
                ${res.correct ? "bg-good text-surface" : "bg-sand text-ink"}`}>
                {res.item.spec && <PictoRenderer spec={res.item.spec} />}
              </div>
              <div className="min-w-0">
                <p className="font-display font-semibold truncate">{res.item.answer}</p>
                {!res.correct && (
                  <p className="text-xs text-bad font-bold truncate">you said: {res.given || "—"}</p>
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
      <Hud index={r.index} total={r.items.length} score={r.score} streak={r.streak} accent="#FF5A1F" />

      <div className="relative mt-4">
        <Burst show={r.phase === "revealed" && !!r.last?.correct} />
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9, rotate: -1.5 }}
            animate={wrong ? { opacity: 1, scale: 1, rotate: 0, ...shake } : { opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={SPRING}
            className="piece aspect-square max-h-[46vh] mx-auto w-full grid place-items-center p-7 text-picto"
          >
            {item.render === "image" && item.imageUrl
              ? <img src={item.imageUrl} alt={item.altHint} className="max-h-full object-contain rounded-xl" />
              : item.spec && <PictoRenderer spec={item.spec} animate seed={item.id} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-3 text-[12px] font-black uppercase tracking-widest text-soft text-center">
        {item.difficulty}{item.category ? ` · ${item.category}` : ""}
      </p>

      {r.phase === "playing" ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); if (guess.trim()) r.submit(guess); }}
            className="mt-4 flex gap-2.5">
            <input ref={inputRef} value={guess} onChange={(e) => setGuess(e.target.value)}
              placeholder="What phrase is this?" autoComplete="off" autoCapitalize="none"
              className="flex-1 bg-surface border-[2.5px] border-ink rounded-2xl px-4 py-3.5
                font-bold text-ink placeholder:text-soft/60 outline-none
                focus:shadow-[0_5px_0_var(--color-ink)] transition-shadow" />
            <button type="submit" disabled={!guess.trim()}
              className="piece press bg-picto text-surface font-display text-lg font-semibold px-6">
              Go
            </button>
          </form>
          <HintBar item={item} used={r.hintsUsed} onUse={r.useHint} />
        </>
      ) : (
        <Reveal correct={r.last!.correct} near={r.last!.near} answer={item.answer}
          gained={r.last!.gained} onNext={r.next} isLast={r.index + 1 >= r.items.length}
          explanation={item.explanation} />
      )}
    </div>
  );
}
