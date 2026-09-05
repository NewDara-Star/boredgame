/**
 * A skill shot, as an alternative to a trivia question.
 *
 * Trivia gates a move on knowledge, which is a test an eight-year-old loses to
 * an adult every time however easy the questions are — no difficulty setting
 * fixes an age gap on general knowledge. Aim is close to age-neutral, and it is
 * learnable: the target moves every turn, but the physics never do, so getting
 * better at it is a real thing that happens.
 *
 * Normalised world: the ground is y = 0, the launcher sits at x = 0, and a
 * distance of 1 is the furthest a full-power 45° shot can travel. Everything
 * here is a pure function of its arguments, so the component can draw the arc,
 * the bot can aim, and scripts/check-catapult.mts can hold all three to the
 * same rules. Import-free so bare Node can load it.
 */

export type Level = "easy" | "medium" | "hard";

/** Radians. Below the first the shot is a line drive; above the second it is a
    lob that lands on your own head. Both are frustrating rather than hard. */
export const MIN_ANGLE = Math.PI / 12;      // 15°
export const MAX_ANGLE = (Math.PI / 180) * 80;

/** How wide a target is, and so how forgiving the game is. */
const RADIUS: Record<Level, number> = { easy: 0.085, medium: 0.06, hard: 0.042 };

/** Kept well inside 1 so that even the hardest target is comfortably reachable
    — a shot you cannot physically make is not a challenge, it is a bug. */
const NEAR = 0.34;
const FAR = 0.9;

export interface Target { x: number; radius: number }
export interface Shot { angle: number; power: number }

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Deterministic from the seed, so two phones show the same target without
 * another column in the database — the seed is the moment the turn was written,
 * which both clients already read off the same row.
 */
export function targetFor(seed: number, level: Level = "medium"): Target {
  // A small integer hash: Math.random() cannot be used here at all, and seeds
  // arrive as timestamps whose low bits move in lockstep.
  let h = Math.abs(Math.trunc(seed)) || 1;
  h = (h ^ 61) ^ (h >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  const unit = (Math.abs(h) % 100000) / 100000;
  return { x: NEAR + unit * (FAR - NEAR), radius: RADIUS[level] };
}

/** Where a shot lands. Gravity is 1 and full power is 1, so this is just the
    range equation with the constants taken out. */
export function landingX({ angle, power }: Shot): number {
  const a = clamp(angle, MIN_ANGLE, MAX_ANGLE);
  const p = clamp(power, 0, 1);
  return p * p * Math.sin(2 * a);
}

export function isHit(shot: Shot, target: Target): boolean {
  return Math.abs(landingX(shot) - target.x) <= target.radius;
}

/** Signed miss distance, for saying "just long" rather than only "missed". */
export function missBy(shot: Shot, target: Target): number {
  return landingX(shot) - target.x;
}

export function describeShot(shot: Shot, target: Target): string {
  const d = missBy(shot, target);
  if (Math.abs(d) <= target.radius) return "Hit!";
  const far = Math.abs(d) > target.radius * 3;
  if (d > 0) return far ? "Way long." : "Just long.";
  return far ? "Way short." : "Just short.";
}

/**
 * The power that lands a shot at `x` for a given angle, or null when no power
 * in range can reach it. The inverse of landingX, used by the bot so that the
 * arc you watch is the shot it actually committed to.
 */
export function powerFor(x: number, angle: number): number | null {
  const s = Math.sin(2 * clamp(angle, MIN_ANGLE, MAX_ANGLE));
  if (s <= 0) return null;
  const p = Math.sqrt(x / s);
  return p >= 0 && p <= 1 ? p : null;
}

/** Points along the flight, for drawing. t is normalised to the whole flight,
    so the caller does not need to know the time of impact. */
export function arc({ angle, power }: Shot, steps = 24): { x: number; y: number }[] {
  const a = clamp(angle, MIN_ANGLE, MAX_ANGLE);
  const p = clamp(power, 0, 1);
  const vx = p * Math.cos(a);
  const vy = p * Math.sin(a);
  const flight = vy <= 0 ? 0 : 2 * vy;          // gravity = 1
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (flight * i) / steps;
    out.push({ x: vx * t, y: Math.max(0, vy * t - 0.5 * t * t) });
  }
  return out;
}

/** How often the bot means to hit, by how hard the target is. Deliberately
    beatable — the same reasoning as the board bots, which are not solved
    players because a game you cannot win is not a game. */
export const BOT_ACCURACY: Record<Level, number> = { easy: 0.55, medium: 0.62, hard: 0.68 };

/**
 * The bot's shot. Decided in full up front — angle, power and outcome — so what
 * you watch it do is what it committed to, rather than an animation played over
 * a hidden dice roll.
 */
export function botShot(target: Target, level: Level, rand: () => number): Shot {
  const meansToHit = rand() < BOT_ACCURACY[level];
  // A varied angle, so it does not fire the identical arc every turn.
  const angle = MIN_ANGLE + rand() * (MAX_ANGLE - MIN_ANGLE) * 0.72 + 0.15;
  const offset = meansToHit
    ? (rand() - 0.5) * target.radius * 1.2          // inside the target
    : (rand() < 0.5 ? -1 : 1) * (target.radius + 0.02 + rand() * 0.1);
  const wanted = clamp(target.x + offset, 0.02, 0.999);
  const p = powerFor(wanted, angle);
  // If that angle cannot reach, fall back to the one that always can.
  return p === null ? { angle: Math.PI / 4, power: Math.sqrt(clamp(wanted, 0, 1)) }
                    : { angle, power: p };
}
