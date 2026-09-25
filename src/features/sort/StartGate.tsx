import { useEffect, useState } from "react";
import { TUBES_RATIO } from "./Board";

/**
 * The tubes stay hidden until you tap Start, then 3, 2, 1, and the clock starts
 * the moment they appear (talk item 13, Daramola). The board used to be on
 * screen with the clock waiting for your first touch, so the race went to
 * whoever planned longest, and today's board could be studied for free.
 */
export const COUNT_FROM = 3;

export function StartGate({ width, onGo, note }: { width: number; onGo: () => void; note: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) { onGo(); return; }
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onGo]);
  return (
    <div className="card bg-board grid place-items-center text-center p-4"
      style={{ width, height: Math.round(width / TUBES_RATIO) }}>
      {count === null ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-soft">{note}</p>
          <button onClick={() => setCount(COUNT_FROM)}
            className="cut tap cut-petal px-8 py-3.5 font-display text-lg font-semibold">
            Start
          </button>
        </div>
      ) : (
        <p aria-live="assertive" className="font-display text-7xl font-semibold tabular-nums">{count || ""}</p>
      )}
    </div>
  );
}
