/**
 * A skill shot, as an alternative to a trivia question.
 *
 * Trivia gates a move on knowledge, which is a test an eight-year-old loses to
 * an adult every time however easy the questions are — no difficulty setting
 * fixes an age gap on general knowledge. Aim is close to age-neutral, and it is
 * learnable: the pot moves every turn, but the physics never do, so getting
 * better at it is a real thing that happens.
 *
 * Normalised world: the ground is y = 0, the launcher sits at x = 0, and a
 * distance of 1 is the furthest a full-power 45° shot can travel. x is SIGNED —
 * the launcher is in the middle of the field and fires either way. Everything
 * here is a pure function of its arguments, so the component can draw the
 * flight, the bot can aim, and scripts/check-catapult.mts can hold all three to
 * the same rules. Import-free so bare Node can load it.
 */

export type Level = "easy" | "medium" | "hard";

/**
 * Radians. Below the first the shot is a line drive; above the second it is a
 * lob that does not fit an honest picture.
 *
 * The height of a shot that lands at x is `x·tan(angle)/4`. The cap was 55°
 * for a launcher that fired one way across the full width. Firing from the
 * middle halves the distance a shot has to cover, which buys back the vertical
 * room — and a pot on a pole lives in exactly the steep region 55° excluded.
 */
export const MIN_ANGLE = Math.PI / 180 * 12;
export const MAX_ANGLE = Math.PI / 180 * 75;

/**
 * The ball's radius, in WORLD units, so it is the same ball on every screen.
 *
 * It has one because the drawing had one and the rule did not: a ball drawn
 * fat enough to visibly not fit was still being scored as a point, and a ball
 * that visibly dropped clean could be failed. `half` is how far the ball's
 * CENTRE may sit from the pot's centre and still count; the pot is drawn
 * `half + BALL_R` wide, so the mouth you see is the mouth that is judged.
 */
export const BALL_R = 0.05;

/** Half-width of a pot's body — what a ball can hit from the side. */
export const bodyOf = (half: number) => (half + BALL_R) * 0.72;

/**
 * How far the ball's centre may sit OUTSIDE the NEAR edge of the mouth and
 * still tip in: the ball is overhanging the rim and its momentum carries it
 * inward. The far rim gets no such gift — momentum there is outward, so it
 * rims out. Short is forgiven, long is not, which is the one thing this game
 * teaches without ever saying it.
 */
export const lipOf = (half: number) => half * 0.42;

/** How wide a pot is, and how often it is up on a pole. */
const LEVEL: Record<Level, { half: number; pole: number }> = {
  easy:   { half: 0.105, pole: 0.20 },
  medium: { half: 0.066, pole: 0.30 },
  hard:   { half: 0.048, pole: 0.40 },
};

/** Kept well inside 1 so that even the hardest pot is comfortably reachable —
    a shot you cannot physically make is not a challenge, it is a bug. */
const NEAR = 0.28, FAR = 0.68;
/** Below this a "pole" pot is a ground pot with a splinter under it. */
const MIN_POLE = 0.12;

/** World seconds per simulation step. */
const DT = 0.012;
/** How much of the flight the aim preview shows. Not all of it, on purpose:
    all of it turns the game into lining a curve up with a pot, which is not
    aiming. The genre convention is the opening arc — enough to read direction
    and curvature while leaving the distance to you. */
export const PREVIEW = 0.55;

export interface Target {
  /** signed: negative is a pot to the left of the launcher */
  x: number;
  /** height of the mouth above the ground; 0 is a pot sunk in the floor */
  y: number;
  /** how far the ball's centre may be from `x` and still drop in */
  half: number;
}
export interface Shot { angle: number; power: number; dir: 1 | -1 }

export type Outcome =
  | "in" | "lip" | "bounced" | "rolled"   // scoring
  | "rimout" | "pole" | "miss";           // not

const SCORES: readonly Outcome[] = ["in", "lip", "bounced", "rolled"];
export const scored = (o: Outcome) => SCORES.includes(o);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Height of a free flight at horizontal distance x. */
export const yAt = (x: number, angle: number, power: number) =>
  x * Math.tan(angle) - (x * x) / (2 * power * power * Math.cos(angle) ** 2);

/**
 * A shot that puts the ball through (x, y) while FALLING and clear of the near
 * rim on the way in, or null. x here is a DISTANCE, not a position.
 *
 * "Falling at the centre" alone is not enough, and believing it was put ten
 * unreachable pots on the board: the marginal shot arrives level with the
 * mouth and hits the side of the cup, which is exactly what a ball would do.
 * So the ball's underside must clear the mouth plane where the body begins.
 * `simulate` collides against the same width, which is what makes the
 * guarantee in `targetFor` true rather than merely intended.
 */
export function solve(x: number, y: number, half = 0): { angle: number; power: number } | null {
  const clear = bodyOf(half) + BALL_R;
  for (let i = 0; i <= 240; i++) {
    const angle = MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * i / 240;
    const drop = x * Math.tan(angle) - y;
    if (drop <= 0) continue;
    const p2 = (x * x) / (2 * Math.cos(angle) ** 2 * drop);
    if (!(p2 > 0 && p2 <= 1)) continue;
    const power = Math.sqrt(p2);
    if (x <= p2 * Math.sin(angle) * Math.cos(angle)) continue;          // still rising
    if (y > 0 && x > clear && yAt(x - clear, angle, power) < y) continue; // clips the side
    return { angle, power };
  }
  return null;
}

/** The highest a pot at distance x can sit and still be reachable. */
export function ceiling(x: number, half = 0): number {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (solve(x, m, half)) lo = m; else hi = m; }
  return lo;
}

/**
 * A stream of numbers from one seed.
 *
 * The seed is the moment the turn was written, which both clients already read
 * off the same row — so both phones lay out the same pot without another
 * column in the database. Math.random() cannot be used here at all, and seeds
 * arrive as timestamps whose low bits move in lockstep, hence the hash before
 * the stream.
 */
function stream(seed: number): () => number {
  let h = Math.abs(Math.trunc(seed)) || 1;
  h = (h ^ 61) ^ (h >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  let s = h >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * The pot for a turn.
 *
 * Whether it is up on a pole is rolled BEFORE it is drawn and shown before you
 * commit, which is the whole point: a pole turn you can see coming is a choice
 * (take the hard shot, or take a safe square), and one you cannot is a coin
 * flip stapled to a decision you already made.
 */
export function targetFor(seed: number, level: Level = "medium"): Target {
  const next = stream(seed);
  const { half, pole } = LEVEL[level];
  const isPole = next() < pole;
  for (let t = 0; t < 60; t++) {
    const side = next() < 0.5 ? -1 : 1;
    const x = NEAR + next() * (FAR - NEAR);
    const cap = isPole ? ceiling(x, half) : 0;
    const y = isPole ? Math.max(MIN_POLE, cap * (0.48 + next() * 0.44)) : 0;
    if (y > cap) continue;
    if (!solve(x, y, half)) continue;      // the guarantee: never place the impossible
    return { x: x * side, y, half };
  }
  return { x: 0.5, y: 0, half };           // unreached; here so a pot always exists
}

export const isPole = (t: Target) => t.y > 0;
export const pointsFor = (t: Target) => (isPole(t) ? 3 : 1);

export interface Flight {
  /** every position the ball occupies, wind-up first */
  samples: { x: number; y: number; inside: boolean }[];
  /** how many leading samples are the wind-up rather than flight */
  wound: number;
  outcome: Outcome;
  /** where the ball first crossed the mouth's height, falling */
  crossX: number | null;
  /** where it first touched the ground */
  landX: number | null;
}

/**
 * The whole turn, simulated up front.
 *
 * The outcome is therefore decided before the first frame is drawn — what you
 * watch is what was committed to, rather than an animation played over a
 * hidden dice roll — and the component only has to walk the list.
 *
 * A pot sunk in the floor is a HOLE, not a lid: anything arriving at floor
 * level over the opening drops in, whether from the air, off a bounce, or
 * rolling over the edge. Making the floor solid there was a rule I wrote on
 * purpose and it read as a lie, because it is one. A pot on a pole needs no
 * such rule to stay drop-only: a bounce never gets that high and a rolling
 * ball stops against the pole, so the physics does the gating.
 */
export function simulate(shot: Shot, pot: Target): Flight {
  const ax = Math.abs(pot.x), side = pot.x < 0 ? -1 : 1;
  const rightSide = shot.dir === side;
  const angle = clamp(shot.angle, MIN_ANGLE, MAX_ANGLE);
  const power = clamp(shot.power, 0, 1);
  const foot = bodyOf(pot.half), LIP = lipOf(pot.half);
  const depth = (pot.half + BALL_R) * 1.3;
  const rest = pot.y - depth * 0.40;                      // settles proud of the rim, so
  //                                                       the ball is visible in the cup
  const inner = (pot.half + BALL_R) * 0.80 - BALL_R;      // how far inside the centre may go

  const samples: Flight["samples"] = [];
  // the sling draws back, then lets go
  for (let i = 1; i <= 6; i++) {
    const k = 0.045 * Math.sin(Math.PI * i / 6);
    samples.push({ x: -shot.dir * Math.cos(angle) * k, y: -Math.sin(angle) * k * 0.5, inside: false });
  }
  const wound = samples.length;

  const vx0 = shot.dir * power * Math.cos(angle), vy0 = power * Math.sin(angle);
  let x = 0, y = 0, vx = vx0, vy = vy0, t = 0;
  /**
   * Until something is touched the position is the closed-form parabola — the
   * same one solve() and ceiling() reason about. Stepping from the start
   * instead drifts about DT/2 per unit time BELOW the true arc, and the
   * solver's marginal shot clears a pot by less than that, so the ball would
   * fly under a pot the maths had promised. Integration begins at first
   * contact, where nothing is being judged any more.
   */
  let exact = true;
  let state: "air" | "bounce" | "roll" | "inside" | "stopped" = "air";
  let outcome: Outcome = "miss";
  let crossX: number | null = null, landX: number | null = null;
  let clunked = false, touched = false, entered = false;

  /** Centre level with the mouth, falling. Does it go in? */
  const atMouth = (): boolean => {
    const d = Math.abs(x) - ax;
    if (Math.abs(d) <= pot.half) { state = "inside"; entered = true; outcome = touched ? "bounced" : "in"; return true; }
    if (d < 0 && d >= -(pot.half + LIP)) { state = "inside"; entered = true; outcome = "lip"; return true; }
    if (d > 0 && d <= pot.half + LIP && outcome === "miss") {
      outcome = "rimout"; vy = -vy * 0.35; vx *= 0.7;
    }
    return false;
  };

  for (let n = 0; n < 900 && state !== "stopped"; n++) {
    if (state === "air" || state === "bounce") {
      const py = y, px = x;
      if (exact) { t += DT; x = vx0 * t; y = vy0 * t - t * t / 2; vy = vy0 - t; }
      else       { vy -= DT; x += vx * DT; y += vy * DT; }
      // The mouth plane, crossed while falling — every time, not only the
      // first. Strictly above before and strictly below after, or a sample
      // snapped ONTO the plane reads as above it next step and re-crosses for
      // ever, which froze one shot in thirty in mid-air.
      if (rightSide && vy < 0 && py > pot.y && y < pot.y) {
        const f = (py - pot.y) / (py - y);
        x = px + (x - px) * f; y = pot.y;
        if (crossX === null) crossX = x;
        if (atMouth()) exact = false;
      }
      // the cup's body, or the pole under it
      if (!entered && !clunked && rightSide && pot.y > 0
          && y > 0 && y < pot.y && Math.abs(Math.abs(x) - ax) < foot + BALL_R) {
        clunked = true;
        if (outcome === "miss") outcome = "pole";
        vx = -Math.sign(x) * 0.06; vy = 0; exact = false;
      }
      if (!entered && y <= 0) {
        y = 0; if (landX === null) landX = x;
        exact = false; touched = true;
        if (Math.abs(vy) < 0.09) { state = "roll"; vy = 0; }
        else { vy = -vy * 0.42; vx *= 0.72; state = "bounce"; }
      }
    } else if (state === "roll") {
      x += vx * DT; vx *= 0.955;
      if (rightSide && pot.y === 0
          && Math.abs(x) >= ax - pot.half - LIP && Math.abs(x) <= ax + pot.half) {
        state = "inside"; entered = true; outcome = "rolled"; vy = 0;   // over the edge of the hole
      } else if (rightSide && pot.y > 0
          && Math.abs(x) >= ax - foot - BALL_R && Math.abs(x) < ax) {
        x = Math.sign(x) * (ax - foot - BALL_R); state = "stopped";   // up against the pole
      }
      if (Math.abs(vx) < 0.004) state = "stopped";
    } else {
      // rattling inside the cup until it settles
      vy -= DT; x += vx * DT; y += vy * DT;
      const off = Math.abs(x) - ax;
      if (Math.abs(off) > inner) { x = Math.sign(x) * (ax + Math.sign(off) * inner); vx = -vx * 0.45; }
      if (y <= rest) { y = rest; vy = -vy * 0.30; vx *= 0.8; if (Math.abs(vy) < 0.06) vy = 0; }
      if (y === rest && vy === 0 && Math.abs(vx) < 0.01) state = "stopped";
    }
    samples.push({
      x, y,
      inside: state === "inside" || (state === "stopped" && scored(outcome)),
    });
  }
  return { samples, wound, outcome, crossX, landX };
}

/** One sample of the flight, in ms — the component's frame clock, exported so
    anything waiting on a shot to finish waits the right amount. */
export const STEP_MS = 7.2;
/** How long this shot takes to play out. Data-dependent: a ball that bounces
    and rolls is on screen a good deal longer than one that drops straight in,
    and a fixed timeout cut the bot's turn off mid-air. */
export const flightMs = (shot: Shot, pot: Target) =>
  simulate(shot, pot).samples.length * STEP_MS;

export const outcomeOf = (shot: Shot, pot: Target) => simulate(shot, pot).outcome;
export const isHit = (shot: Shot, pot: Target) => scored(outcomeOf(shot, pot));

export function describeShot(shot: Shot, pot: Target): string {
  const f = simulate(shot, pot);
  switch (f.outcome) {
    case "in":      return "In!";
    case "lip":     return "Off the lip — in!";
    case "bounced": return "Bounced in!";
    case "rolled":  return "Rolled in!";
    case "rimout":  return "Rimmed out.";
    case "pole":    return "Clipped the pole.";
  }
  if (shot.dir !== (pot.x < 0 ? -1 : 1)) return "Wrong way.";
  const ax = Math.abs(pot.x);
  const reached = f.crossX ?? f.landX;
  if (reached === null) return "Too flat.";
  const d = Math.abs(reached) - ax;
  const far = Math.abs(d) > pot.half * 3;
  return d > 0 ? (far ? "Way long." : "Just long.") : (far ? "Way short." : "Just short.");
}

/** How often the bot means to hit, by how hard the pot is. Deliberately
    beatable — the same reasoning as the board bots, which are not solved
    players because a game you cannot win is not a game. */
export const BOT_ACCURACY: Record<Level, number> = { easy: 0.55, medium: 0.62, hard: 0.68 };

/**
 * The bot's shot. Decided in full up front — angle, power and outcome — so what
 * you watch it do is what it committed to.
 *
 * It aims by solving for a pot displaced from the real one, which is how a
 * person misses: the arc is right, the distance is off.
 */
export function botShot(pot: Target, level: Level, rand: () => number): Shot {
  const dir: 1 | -1 = pot.x < 0 ? -1 : 1;
  const ax = Math.abs(pot.x);
  const meansToHit = rand() < BOT_ACCURACY[level];
  const spread = meansToHit
    ? (rand() - 0.5) * pot.half * 1.1
    : (rand() < 0.5 ? -1 : 1) * (pot.half + lipOf(pot.half) + 0.02 + rand() * 0.09);
  const wanted = clamp(ax + spread, NEAR * 0.6, 0.98);
  const s = solve(wanted, pot.y, pot.half) ?? solve(ax, pot.y, pot.half);
  return s ? { ...s, dir } : { angle: Math.PI / 4, power: Math.sqrt(clamp(ax, 0, 1)), dir };
}

/**
 * The dots drawn while you are pulling back: the opening of the real flight,
 * fading out. Free flight only — nothing has been touched yet, so this is the
 * analytic parabola and needs no simulation.
 */
export function previewDots(shot: Shot, count = 11): { x: number; y: number }[] {
  const angle = clamp(shot.angle, MIN_ANGLE, MAX_ANGLE), power = clamp(shot.power, 0, 1);
  const vy = power * Math.sin(angle), vx = shot.dir * power * Math.cos(angle);
  const tE = 2 * vy * PREVIEW;
  if (tE <= 1e-4) return [];
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const t = tE * i / count;
    out.push({ x: vx * t, y: vy * t - t * t / 2 });
  }
  return out;
}
