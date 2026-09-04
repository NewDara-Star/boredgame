export interface Rank { name: string; min: number; }

/** Deliberately steep at the top so "Advanced" isn't reached in one sitting. */
export const RANKS: Rank[] = [
  { name: "Rookie",   min: 0 },
  { name: "Novice",   min: 25 },
  { name: "Regular",  min: 75 },
  { name: "Sharp",    min: 175 },
  { name: "Advanced", min: 350 },
  { name: "Veteran",  min: 650 },
  { name: "Master",   min: 1200 },
];

export function rankFor(answered: number) {
  let current = RANKS[0];
  let next: Rank | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (answered >= RANKS[i].min) { current = RANKS[i]; next = RANKS[i + 1] ?? null; }
  }
  const span = next ? next.min - current.min : 1;
  const into = next ? answered - current.min : 1;
  return { current, next, progress: next ? Math.min(1, into / span) : 1 };
}
