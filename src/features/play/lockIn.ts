import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The locked-in moment: a tapped option lights up on its own before right or
 * wrong shows, so you see what you picked and know you didn't hit the one next
 * to it (Daramola, 24 Sep). Long enough to register, short enough not to feel
 * like lag. Every multiple-choice screen uses it: Star Trivia, the daily, the
 * board games (solo and rooms) and the room race.
 */
export const LOCK_MS = 600;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * For screens that judge on the phone and would otherwise reveal at once. The
 * first tap lights the option and locks the rest; `then` runs LOCK_MS later with
 * the time of the tap, so a speed score counts the tap, not the pause. A new
 * `key` (the next question) clears it; leaving the screen cancels a pending one.
 */
export function useLockIn(key: unknown) {
  const [picked, setPicked] = useState<string | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    busy.current = false; setPicked(null);
    return () => clearTimeout(timer.current);
  }, [key]);
  const pick = useCallback((opt: string, then: (opt: string, tappedAt: number) => void, delay = LOCK_MS) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(opt);
    const at = Date.now();
    timer.current = setTimeout(() => then(opt, at), delay);
  }, []);
  return { picked, pick };
}
