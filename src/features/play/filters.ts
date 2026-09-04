import type { GameKey } from "@/shared/types/db";

/** Remembered per game, so picking Sport for trivia does not narrow the rebuses. */
const KEY = (game: GameKey) => `boredgame-categories-v1:${game}`;

export function readFilter(game: GameKey): string[] {
  try {
    const raw = localStorage.getItem(KEY(game));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

export function writeFilter(game: GameKey, names: string[]) {
  try { localStorage.setItem(KEY(game), JSON.stringify(names)); } catch { /* private mode */ }
}
