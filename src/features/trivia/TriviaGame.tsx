import { useMemo } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRound } from "@/features/play/useRound";
import { shuffle } from "@/features/play/content";
import { Hud, HintBar, Reveal, Summary } from "@/features/play/RoundChrome";

const ACCENT = "var(--color-trivia)";
const SHAPES = ["▲", "◆", "●", "■"];
const HUES = ["#D2544A", "#3E9AA8", "#E0A32E", "#9B72C0"];

export function TriviaGame() {
  const { user } = useAuth();
  const r = useRound("trivia", 10, user?.id);

  // Shuffle once per question, not on every render — otherwise options jump around.
  const options = useMemo(
    () => (r.current?.choices ? shuffle(r.current.choices) : []),
    [r.current?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (r.phase === "loading") return <p className="text-dim text-sm">Loading questions…</p>;
  if (r.phase === "empty") return <p className="text-dim text-sm">No trivia is live yet.</p>;

  if (r.phase === "done") {
    return (
      <Summary score={r.score} results={r.results} onAgain={r.restart}>
        <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
          {r.results.map((res, i) => (
            <div key={i} className={`p-3 bg-panel border-l-2 ${res.correct ? "border-l-good" : "border-l-bad"}`}>
              <p className="text-sm font-medium">{res.item.prompt}</p>
              <p className="text-xs mt-1">
                {res.correct
                  ? <span className="text-good">{res.item.answer}</span>
                  : <><span className="text-bad line-through">{res.given}</span>{" → "}<span className="text-good">{res.item.answer}</span></>}
              </p>
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

      <p className="mt-2 text-[10px] uppercase tracking-widest text-faint">
        {item.category} · {item.difficulty}
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-snug text-balance">{item.prompt}</h2>

      <div className="mt-6 grid gap-2.5">
        {options.map((opt, i) => {
          const revealed = r.phase === "revealed";
          const isAnswer = opt === item.answer;
          const isMine = revealed && r.last?.given === opt;
          const cls = !revealed
            ? "bg-panel border-line hover:bg-panel-2"
            : isAnswer
              ? "bg-good/15 border-good"
              : isMine ? "bg-bad/15 border-bad" : "bg-panel border-line opacity-40";
          return (
            <button
              key={opt}
              disabled={revealed}
              onClick={() => r.submit(opt)}
              className={`flex items-center gap-3 text-left border rounded-xl px-4 py-4 transition ${cls}`}
              style={{ borderLeft: `4px solid ${HUES[i % 4]}` }}
            >
              <span aria-hidden className="text-sm" style={{ color: HUES[i % 4] }}>{SHAPES[i % 4]}</span>
              <span className="text-[15px] font-medium">{opt}</span>
            </button>
          );
        })}
      </div>

      {r.phase === "playing"
        ? <HintBar item={item} used={r.hintsUsed} onUse={r.useHint} accent={ACCENT} />
        : <Reveal
            correct={r.last!.correct}
            near={false}
            answer={item.answer}
            gained={r.last!.gained}
            onNext={r.next}
            isLast={r.index + 1 >= r.items.length}
          />}
    </div>
  );
}
