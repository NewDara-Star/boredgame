/**
 * How hard the questions in the solo board games are (talk item 9, Daramola).
 * They dealt from the whole bank, one question in five hard, and these are
 * the games meant for younger players. Now the player picks; the phone
 * remembers, and it starts on Easy + Medium: nothing hard until asked for.
 *
 * Import-free apart from storage, so scripts can load it under bare Node.
 */
export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const START: Level[] = ["easy", "medium"];

const KEY = "boredgame-board-levels-v1";

export function readLevels(): Level[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const ok = Array.isArray(raw) ? LEVELS.filter((l) => raw.includes(l)) : [];
    return ok.length ? ok : START;
  } catch { return START; }
}

export function writeLevels(levels: Level[]) {
  try { localStorage.setItem(KEY, JSON.stringify(levels)); } catch { /* private mode */ }
}

/** Tapping a level: on or off, but never none at all. */
export function toggle(levels: Level[], l: Level): Level[] {
  const next = levels.includes(l) ? levels.filter((x) => x !== l) : LEVELS.filter((x) => x === l || levels.includes(x));
  return next.length ? next : levels;
}

/** The questions at the chosen levels; the whole pool if none are there. */
export function atLevels<T extends { difficulty: string }>(pool: T[], levels: Level[]): T[] {
  const kept = pool.filter((i) => (levels as string[]).includes(i.difficulty));
  return kept.length ? kept : pool;
}
