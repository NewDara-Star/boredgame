import { useEffect, useRef, useState } from "react";

/** Scores tick up. A number that just changes has no reward in it.
    A new score that lands mid-count carries on from the number on screen,
    never from where the last count started (K3): a score doesn't go backwards. */
export function Counter({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const onScreen = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = onScreen.current;
    const b = value;
    if (a === b) return;
    const dur = Math.min(900, 220 + Math.abs(b - a) * 0.35);
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = Math.round(a + (b - a) * eased);
      onScreen.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={`tabular-nums ${className}`}>{shown}</span>;
}
