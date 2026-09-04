import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRound } from "@/features/play/useRound";
import { Hud, HintBar, Reveal, Summary } from "@/features/play/RoundChrome";
import { PictoRenderer } from "./PictoRenderer";
import { Card } from "@/shared/ui/Card";

const ACCENT = "var(--color-picto)";

export function PictoGame() {
  const { user } = useAuth();
  const r = useRound("picto", 8, user?.id);
  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (r.phase === "playing") { setGuess(""); inputRef.current?.focus(); }
  }, [r.phase, r.index]);

  if (r.phase === "loading") return <p className="text-dim text-sm">Loading puzzles…</p>;
  if (r.phase === "empty") return <p className="text-dim text-sm">No picto puzzles are live yet.</p>;

  if (r.phase === "done") {
    return (
      <Summary score={r.score} results={r.results} onAgain={r.restart}>
        <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
          {r.results.map((res, i) => (
            <div key={i} className="p-3 flex items-center gap-3 bg-panel">
              <div className="w-14 h-14 shrink-0 bg-ink rounded-lg text-chalk p-1">
                {res.item.spec && <PictoRenderer spec={res.item.spec} />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{res.item.answer}</p>
                {!res.correct && (
                  <p className="text-xs text-bad truncate">you said: {res.given || "—"}</p>
                )}
              </div>
              <span className={`ml-auto text-xs font-bold ${res.correct ? "text-good" : "text-bad"}`}>
                {res.correct ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </div>
      </Summary>
    );
  }

  const item = r.current;
  if (!item) return null;

  return (
    <div>
      <Hud index={r.index} total={r.items.length} score={r.score} streak={r.streak} accent={ACCENT} />

      <Card className="mt-4 aspect-square max-h-[52vh] mx-auto w-full grid place-items-center p-6 text-chalk">
        {item.render === "image" && item.imageUrl
          ? <img src={item.imageUrl} alt={item.altHint} className="max-h-full object-contain rounded-xl" />
          : item.spec && <PictoRenderer spec={item.spec} />}
      </Card>

      <p className="mt-3 text-[10px] uppercase tracking-widest text-faint text-center">
        {item.difficulty}{item.category ? ` · ${item.category}` : ""}
      </p>

      {r.phase === "playing" ? (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); if (guess.trim()) r.submit(guess); }}
            className="mt-5 flex gap-2"
          >
            <input
              ref={inputRef}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="What phrase is this?"
              autoComplete="off"
              autoCapitalize="none"
              className="flex-1 bg-panel border border-line rounded-xl px-4 py-3.5 text-chalk placeholder:text-faint focus:border-picto outline-none"
            />
            <button type="submit" disabled={!guess.trim()}
              className="rounded-xl bg-picto text-ink font-semibold px-5 disabled:opacity-40">
              Go
            </button>
          </form>
          <HintBar item={item} used={r.hintsUsed} onUse={r.useHint} accent={ACCENT} />
        </>
      ) : (
        <Reveal
          correct={r.last!.correct}
          near={r.last!.near}
          answer={item.answer}
          gained={r.last!.gained}
          onNext={r.next}
          isLast={r.index + 1 >= r.items.length}
        />
      )}
    </div>
  );
}
