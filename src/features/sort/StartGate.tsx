import { useEffect, useState, type ReactNode } from "react";

/**
 * The tubes stay hidden until you tap Start, then 3, 2, 1, and the clock starts
 * the moment they appear (talk item 13, Daramola). The board used to be on
 * screen with the clock waiting for your first touch, so the race went to
 * whoever planned longest, and today's board could be studied for free.
 *
 * It sits where the tubes will be, inside the white board card (#31, #41), so
 * the screen doesn't move when they arrive. What to play (the level, today's
 * or practice) goes above the note as `children`: it's only there before a run.
 */
export const COUNT_FROM = 3;

export function StartGate({ onGo, note, children }: { onGo: () => void; note: string; children?: ReactNode }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) { onGo(); return; }
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onGo]);
  return (
    <div className="flex-1 min-h-0 grid place-items-center text-center text-ink px-2">
      {count === null ? (
        <div className="grid gap-3 justify-items-center">
          {children}
          <p className="text-[14px] font-semibold text-soft max-w-[30ch]">{note}</p>
          <button onClick={() => setCount(COUNT_FROM)}
            className="cut tap cut-petal min-h-[52px] px-10 font-display text-[19px]">
            Start
          </button>
        </div>
      ) : (
        <p aria-live="assertive" className="font-mono font-bold text-[72px] leading-none tabular-nums">{count || ""}</p>
      )}
    </div>
  );
}
