import type { ReactNode } from "react";
import type { PlayItem } from "./types";

export function Hud({ index, total, score, streak, accent }:
  { index: number; total: number; score: number; streak: number; accent: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-semibold tracking-widest uppercase text-faint">
      <span>{index + 1} / {total}</span>
      {streak >= 2 && <span style={{ color: accent }}>{streak} in a row</span>}
      <span className="text-base normal-case tracking-normal tabular-nums" style={{ color: accent }}>{score}</span>
    </div>
  );
}

export function HintBar({ item, used, onUse, accent }:
  { item: PlayItem; used: number; onUse: () => void; accent: string }) {
  const hints = [item.altHint, item.charHint];
  return (
    <div className="mt-4">
      {hints.slice(0, used).map((h, i) => (
        <p key={i} className="text-sm text-dim mb-1">
          <span className="text-faint uppercase text-[10px] tracking-widest mr-2">
            {i === 0 ? "Clue" : "Letters"}
          </span>
          {h}
        </p>
      ))}
      {used < hints.length && (
        <button
          onClick={onUse}
          className="text-xs font-semibold uppercase tracking-widest border border-line rounded-lg px-3 py-2 text-dim hover:text-chalk transition"
          style={{ borderColor: used > 0 ? undefined : undefined }}
        >
          {used === 0 ? "Need a clue? (−100)" : "One more hint (−100)"}
        </button>
      )}
      <span className="sr-only" style={{ color: accent }} />
    </div>
  );
}

export function Reveal({ correct, near, answer, gained, onNext, isLast }:
  { correct: boolean; near: boolean; answer: string; gained: number; onNext: () => void; isLast: boolean }) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className={`text-xs font-bold uppercase tracking-widest ${correct ? "text-good" : "text-bad"}`}>
        {correct ? `Correct  +${gained}` : near ? "So close" : "Missed"}
      </p>
      {!correct && <p className="mt-2 text-lg font-semibold">{answer}</p>}
      <button
        onClick={onNext}
        autoFocus
        className="mt-4 w-full rounded-xl bg-picto text-ink font-semibold py-3.5"
      >
        {isLast ? "See the round" : "Next"}
      </button>
    </div>
  );
}

export function Summary({ score, results, onAgain, children }:
  { score: number; results: { correct: boolean }[]; onAgain: () => void; children?: ReactNode }) {
  const right = results.filter((r) => r.correct).length;
  return (
    <div className="text-center py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint">Round complete</p>
      <p className="text-6xl font-bold tabular-nums mt-3 text-picto">{score}</p>
      <p className="text-sm text-dim mt-2">{right} of {results.length} correct</p>
      <div className="mt-6 text-left">{children}</div>
      <button onClick={onAgain} className="mt-6 w-full rounded-xl bg-picto text-ink font-semibold py-3.5">
        Play again
      </button>
    </div>
  );
}
