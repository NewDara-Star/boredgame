import { useCallback, useEffect, useRef, useState } from "react";
import type { GameKey } from "@/shared/types/db";
import type { PlayItem } from "@/features/play/types";
import { loadContent } from "@/features/play/content";

/** The waits between tries after a failed load, then every 30 s until it works. */
export const BANK_RETRY_MS = [3_000, 6_000, 12_000, 20_000, 30_000];

/**
 * The questions a room deals from. A room can only use questions stored in the
 * database (both phones deal by id), so the built-in set the solo games fall
 * back to on a slow connection is no use here — and on a load that gave up
 * after 6 s the room used to sit on "Dealing the questions…" for ever, because
 * nothing tried again. This keeps trying (sooner when the phone says it's back
 * online), says so plainly, and lets you try again now.
 */
export function useRoomBank(game: GameKey | null, enabled = true) {
  const [pool, setPool] = useState<PlayItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tries = useRef(0);

  useEffect(() => {
    if (!game || !enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void loadContent(game).then((all) => {
      if (cancelled) return;
      const stored = all.filter((i) => /^\d+$/.test(i.id));
      if (stored.length > 0) { tries.current = 0; setFailed(false); setPool(stored); return; }
      setFailed(true);
      const wait = BANK_RETRY_MS[Math.min(tries.current, BANK_RETRY_MS.length - 1)];
      tries.current += 1;
      timer = setTimeout(() => setAttempt((n) => n + 1), wait);
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [game, enabled, attempt]);

  const retryNow = useCallback(() => { tries.current = 0; setAttempt((n) => n + 1); }, []);

  // Back online: try straight away rather than waiting out the timer.
  useEffect(() => {
    if (!failed) return;
    window.addEventListener("online", retryNow);
    return () => window.removeEventListener("online", retryNow);
  }, [failed, retryNow]);

  return { pool, failed, retryNow };
}

export const BANK_FAILED = "Couldn't load the questions on this connection. Trying again…";
