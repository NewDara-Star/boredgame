/**
 * The catapult's rules, held to the properties the game depends on.
 *
 * Two of these were written only after the thing they describe had already
 * shipped broken, which is the honest reason they are here: the solver once
 * promised pots the ball could not reach, and a miss once froze in mid-air.
 */
import {
  BALL_R, BOT_ACCURACY, MIN_ANGLE, MAX_ANGLE, PREVIEW, bodyOf, botShot, ceiling,
  clamp, describeShot, isHit, lipOf, previewDots, scored, simulate, solve,
  targetFor, yAt, type Level, type Shot, type Target,
} from "../src/features/challenge/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const LEVELS: Level[] = ["easy", "medium", "hard"];
const shotAt = (t: Target, s: { angle: number; power: number }): Shot =>
  ({ ...s, dir: t.x < 0 ? -1 : 1 });

// --- the world ---------------------------------------------------------------
ok(MIN_ANGLE < MAX_ANGLE, "the angle range is not inverted");
ok(MAX_ANGLE > Math.PI / 4, "and it includes the range-maximising angle");
ok(BALL_R > 0, "the ball has a size");
for (const half of [0.048, 0.066, 0.105]) {
  ok(bodyOf(half) < half + BALL_R, `a pot's body is narrower than its mouth (${half})`);
  ok(lipOf(half) > 0 && lipOf(half) < half, `and its lip is a fraction of it (${half})`);
}

// --- the same seed is the same pot, on both phones ---------------------------
// The pot is laid out from the moment the turn was written, which both clients
// read off the same row. If it were not a pure function of that number the two
// of you would be shooting at different things.
for (const level of LEVELS) {
  for (const seed of [1, 2, 7, 1000, 1748e6, 1748e6 + 1, Date.now()]) {
    const a = targetFor(seed, level), b = targetFor(seed, level);
    ok(a.x === b.x && a.y === b.y && a.half === b.half,
       `targetFor(${seed}, ${level}) is stable`);
  }
}
{
  const seen = new Set<string>();
  for (let s = 1_700_000_000_000; s < 1_700_000_000_000 + 400; s++)
    seen.add(JSON.stringify(targetFor(s, "medium")));
  ok(seen.size > 300, `consecutive seeds give different pots (${seen.size}/400)`);
}

// --- THE GUARANTEE -----------------------------------------------------------
// Every pot the generator places can be hit, and "can be hit" is measured by
// running the real simulation rather than by trusting the solver — because the
// solver was wrong. It asked only whether the ball was falling at the pot's
// centre, never whether it cleared the near rim on the way in, so the marginal
// shot arrived level with the mouth and hit the side of the cup.
{
  let poles = 0, ground = 0;
  for (const level of LEVELS) {
    for (let s = 0; s < 700; s++) {
      const pot = targetFor(2_000_000 + s * 7919, level);
      const aim = solve(Math.abs(pot.x), pot.y, pot.half);
      ok(!!aim, `${level} seed ${s}: a solution exists`);
      const f = simulate(shotAt(pot, aim!), pot);
      ok(scored(f.outcome), `${level} seed ${s}: the solved shot scores (${f.outcome})`);
      pot.y > 0 ? poles++ : ground++;
    }
  }
  ok(poles > 200 && ground > 200, `both kinds of pot get generated (${poles} pole, ${ground} ground)`);
}
// and a pot is never placed above what the physics allows
for (const level of LEVELS) {
  for (let s = 0; s < 200; s++) {
    const pot = targetFor(5_000_000 + s * 104729, level);
    if (pot.y === 0) continue;
    ok(pot.y <= ceiling(Math.abs(pot.x), pot.half) + 1e-9,
       `${level} seed ${s}: the pot is under the ceiling`);
  }
}

// --- the ceiling is the ceiling ----------------------------------------------
for (const x of [0.28, 0.4, 0.55, 0.68]) {
  const cap = ceiling(x, 0.066);
  ok(!!solve(x, cap - 1e-3, 0.066), `x=${x}: just under the ceiling is reachable`);
  ok(!solve(x, cap + 1e-3, 0.066), `x=${x}: just over it is not`);
}
ok(ceiling(0.3, 0.066) > ceiling(0.65, 0.066), "the ceiling falls away with distance");

// --- the flight always ends --------------------------------------------------
// A miss that crossed the mouth plane was snapped onto it, read as above it on
// the next step, and re-crossed for ever. One shot in thirty hung in the air.
{
  let longest = 0;
  for (let i = 0; i < 4000; i++) {
    const level = LEVELS[i % 3];
    const pot = targetFor(9_000_000 + i * 31, level);
    const shot: Shot = {
      angle: MIN_ANGLE + ((i * 0.61803) % 1) * (MAX_ANGLE - MIN_ANGLE),
      power: 0.05 + ((i * 0.31831) % 1) * 0.95,
      dir: i % 9 === 0 ? (pot.x < 0 ? 1 : -1) : (pot.x < 0 ? -1 : 1),
    };
    const f = simulate(shot, pot);
    longest = Math.max(longest, f.samples.length);
    ok(f.samples.length < 900, `shot ${i} settles rather than running to the cap`);
    const last = f.samples[f.samples.length - 1];
    ok(Number.isFinite(last.x) && Number.isFinite(last.y), `shot ${i} ends somewhere real`);
    ok(last.y >= -0.5 && Math.abs(last.x) < 3, `shot ${i} ends on the field`);
  }
  ok(longest < 500, `the longest flight is bounded (${longest} samples)`);
}

// --- what you watch is the arc it flies --------------------------------------
// Before anything is touched the ball is on the closed-form parabola — the
// same one the solver reasons about. Stepping from the start instead drifts
// below the true arc by more than a marginal shot's clearance.
{
  const pot = targetFor(4242, "medium");
  const aim = solve(Math.abs(pot.x), pot.y, pot.half)!;
  const shot = shotAt(pot, aim);
  const f = simulate(shot, pot);
  let checked = 0;
  for (let i = f.wound; i < f.samples.length; i++) {
    const p = f.samples[i];
    if (Math.abs(p.x) < 1e-6 || p.y <= pot.y) break;         // first contact or past it
    ok(Math.abs(p.y - yAt(Math.abs(p.x), aim.angle, aim.power)) < 1e-9,
       `free flight sample ${i} is on the analytic parabola`);
    checked++;
  }
  ok(checked > 10, `there is a free-flight stretch to check (${checked} samples)`);
}

// --- a pot in the floor is a hole, not a lid ---------------------------------
// A ball that bounced onto the opening used to bounce off it and be called
// short, which is a rule, and a bad one. Anything arriving at floor level over
// the mouth goes in.
{
  const pot: Target = { x: 0.55, y: 0, half: 0.066 };
  const outcomes = new Set<string>();
  for (let i = 0; i < 6000; i++) {
    const shot: Shot = {
      angle: MIN_ANGLE + ((i * 0.61803) % 1) * (MAX_ANGLE - MIN_ANGLE),
      power: 0.2 + ((i * 0.31831) % 1) * 0.8, dir: 1,
    };
    outcomes.add(simulate(shot, pot).outcome);
  }
  ok(outcomes.has("bounced"), "a short shot can bounce in");
  ok(outcomes.has("rolled"), "and a shorter one can roll in");
  ok(outcomes.has("in"), "and a good one drops straight in");
}
// a pole pot needs no rule to stay drop-only: physics does the gating
{
  let rolledIntoAPole = 0, bouncedIntoAPole = 0, n2 = 0;
  for (let s = 0; s < 900; s++) {
    const pot = targetFor(7_000_000 + s * 7907, "hard");
    if (pot.y === 0) continue;
    n2++;
    for (let i = 0; i < 40; i++) {
      const shot: Shot = {
        angle: MIN_ANGLE + ((i * 0.61803) % 1) * (MAX_ANGLE - MIN_ANGLE),
        power: 0.15 + ((i * 0.31831) % 1) * 0.85, dir: pot.x < 0 ? -1 : 1,
      };
      const o = simulate(shot, pot).outcome;
      if (o === "rolled") rolledIntoAPole++;
      if (o === "bounced") bouncedIntoAPole++;
    }
  }
  ok(n2 > 100, `there are pole pots to check (${n2})`);
  ok(rolledIntoAPole === 0, "nothing ever rolls into a pot on a pole");
  ok(bouncedIntoAPole === 0, "and nothing bounces into one off the floor");
}

// --- short is forgiven, long is not ------------------------------------------
// The asymmetry is the lesson the game teaches without ever saying it, so it is
// a property and not a coincidence of tuning. Tested on pots in the floor,
// where the geometry is clean: a pot on a pole has a body, and a shot aimed a
// whole lip long clips it on the way up rather than ever reaching the rim.
{
  let pairs = 0;
  for (let s = 0; s < 400; s++) {
    const pot = targetFor(3_000_000 + s * 6151, "medium");
    if (pot.y > 0) continue;
    const ax = Math.abs(pot.x), lip = lipOf(pot.half), dir = (pot.x < 0 ? -1 : 1) as 1 | -1;
    const near = solve(ax - pot.half - lip * 0.5, 0, pot.half);
    const far  = solve(ax + pot.half + lip * 0.5, 0, pot.half);
    if (!near || !far) continue;
    pairs++;
    ok(simulate({ ...near, dir }, pot).outcome === "lip",
       `seed ${s}: short by half a lip tips in off the near rim`);
    // Not merely "does not score": it must be TURNED AWAY by the far rim.
    // Deleting the rim-out branch entirely also stops it scoring, and a test
    // that cannot tell those apart is not testing the rim.
    ok(simulate({ ...far, dir }, pot).outcome === "rimout",
       `seed ${s}: long by half a lip rims out`);
  }
  ok(pairs > 100, `there are ground pots to compare (${pairs})`);
}

// --- on a pole, long is punished harder --------------------------------------
// There is no forgiveness out there at all: the pole is in the way.
{
  let checked = 0;
  for (let s = 0; s < 400; s++) {
    const pot = targetFor(3_500_000 + s * 6151, "medium");
    if (pot.y === 0) continue;
    const ax = Math.abs(pot.x), lip = lipOf(pot.half), dir = (pot.x < 0 ? -1 : 1) as 1 | -1;
    const far = solve(ax + pot.half + lip * 0.5, pot.y, pot.half);
    if (!far) continue;
    checked++;
    ok(!scored(simulate({ ...far, dir }, pot).outcome),
       `seed ${s}: long by half a lip onto a pole never scores`);
  }
  ok(checked > 40, `there are pole pots to compare (${checked})`);
}

// --- the wrong way is never right --------------------------------------------
for (let s = 0; s < 300; s++) {
  const pot = targetFor(6_000_000 + s * 3571, "easy");
  const aim = solve(Math.abs(pot.x), pot.y, pot.half)!;
  const wrong: Shot = { ...aim, dir: pot.x < 0 ? 1 : -1 };
  ok(!isHit(wrong, pot), `seed ${s}: the mirror-image shot misses`);
  ok(describeShot(wrong, pot) === "Wrong way.", `seed ${s}: and says so`);
}

// --- isHit and describeShot agree with the simulation ------------------------
for (let i = 0; i < 1200; i++) {
  const pot = targetFor(8_000_000 + i * 2311, LEVELS[i % 3]);
  const shot: Shot = {
    angle: MIN_ANGLE + ((i * 0.61803) % 1) * (MAX_ANGLE - MIN_ANGLE),
    power: 0.1 + ((i * 0.31831) % 1) * 0.9, dir: pot.x < 0 ? -1 : 1,
  };
  const f = simulate(shot, pot);
  ok(isHit(shot, pot) === scored(f.outcome), `shot ${i}: isHit follows the outcome`);
  const said = describeShot(shot, pot);
  ok(said.length > 0, `shot ${i}: the shot is described`);
  ok(scored(f.outcome) === /in!$/i.test(said), `shot ${i}: only a score reads as one`);
}

// --- the bot -----------------------------------------------------------------
{
  for (const level of LEVELS) {
    let hits = 0, tries = 0, wrongSide = 0;
    let seq = 12345;
    const rand = () => { seq = (Math.imul(seq, 1664525) + 1013904223) >>> 0; return seq / 4294967296; };
    for (let s = 0; s < 900; s++) {
      const pot = targetFor(1_100_000 + s * 1543, level);
      const shot = botShot(pot, level, rand);
      tries++;
      if (shot.dir !== (pot.x < 0 ? -1 : 1)) wrongSide++;
      if (isHit(shot, pot)) hits++;
      ok(shot.power >= 0 && shot.power <= 1, `${level} ${s}: the bot's power is in range`);
      ok(shot.angle >= MIN_ANGLE - 1e-9 && shot.angle <= MAX_ANGLE + 1e-9,
         `${level} ${s}: and so is its angle`);
    }
    ok(wrongSide === 0, `${level}: the bot always fires at the side the pot is on`);
    const rate = hits / tries;
    // Loose bounds on purpose: the bot aims for a displaced pot, and the lip
    // means aiming slightly short still goes in. It must be beatable and it
    // must not be useless.
    ok(rate > 0.35 && rate < 0.92, `${level}: the bot is beatable but real (${(rate * 100) | 0}%)`);
    ok(BOT_ACCURACY[level] > 0 && BOT_ACCURACY[level] < 1, `${level}: accuracy is a probability`);
  }
}

// --- the preview is the opening of the real flight ---------------------------
{
  for (let i = 0; i < 200; i++) {
    const shot: Shot = {
      angle: MIN_ANGLE + ((i * 0.61803) % 1) * (MAX_ANGLE - MIN_ANGLE),
      power: 0.1 + ((i * 0.31831) % 1) * 0.9, dir: i % 2 ? 1 : -1,
    };
    const dots = previewDots(shot);
    ok(dots.length > 0, `shot ${i}: a real pull previews something`);
    for (const d of dots) {
      ok(d.y >= -1e-9, `shot ${i}: no preview dot is underground`);
      ok(Math.sign(d.x) === shot.dir || d.x === 0, `shot ${i}: the preview goes the way it will fire`);
      ok(Math.abs(d.y - yAt(Math.abs(d.x), shot.angle, shot.power)) < 1e-9,
         `shot ${i}: the preview is on the real flight path`);
    }
    const flight = 2 * shot.power * Math.sin(shot.angle);
    const shown = dots[dots.length - 1].x / (shot.dir * shot.power * Math.cos(shot.angle));
    ok(Math.abs(shown / flight - PREVIEW) < 1e-6, `shot ${i}: it stops at ${PREVIEW} of the flight`);
  }
  ok(previewDots({ angle: MIN_ANGLE, power: 0, dir: 1 }).length === 0, "an empty pull previews nothing");
}

// --- clamping ------------------------------------------------------------------
ok(clamp(5, 0, 1) === 1 && clamp(-5, 0, 1) === 0 && clamp(0.5, 0, 1) === 0.5, "clamp clamps");
{
  const pot = targetFor(99, "medium");
  const wild: Shot = { angle: 90, power: 40, dir: pot.x < 0 ? -1 : 1 };
  const f = simulate(wild, pot);
  ok(f.samples.length < 900, "a shot outside every limit is still simulated to a stop");
}

console.log(`${n} catapult assertions hold`);
