import badges from "@/shared/data/rank-badges.json";

export type BadgeKey = keyof typeof badges;

export interface Rank {
  key: BadgeKey;
  name: string;
  min: number;
  color: string;
}

/**
 * Ten tiers, matched to the badge set. The curve steepens deliberately: the
 * first four are reachable in a sitting so progress is visible early, and the
 * last three are long hauls so the elaborate badges stay worth something.
 */
export const RANKS: Rank[] = [
  { key: "novice",       name: "Novice",       min: 0,    color: badges.novice.color },
  { key: "apprentice",   name: "Apprentice",   min: 20,   color: badges.apprentice.color },
  { key: "developing",   name: "Developing",   min: 50,   color: badges.developing.color },
  { key: "emerging",     name: "Emerging",     min: 100,  color: badges.emerging.color },
  { key: "skilled",      name: "Skilled",      min: 180,  color: badges.skilled.color },
  { key: "accomplished", name: "Accomplished", min: 300,  color: badges.accomplished.color },
  { key: "advanced",     name: "Advanced",     min: 500,  color: badges.advanced.color },
  { key: "elite",        name: "Elite",        min: 800,  color: badges.elite.color },
  { key: "prodigy",      name: "Prodigy",      min: 1250, color: badges.prodigy.color },
  { key: "legend",       name: "Legend",       min: 2000, color: badges.legend.color },
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
