/**
 * The catapult exists so that an eight-year-old and an adult can play the same
 * board game, so the properties that matter are not "does the maths work" but
 * "is every target reachable, do both phones see the same one, and is the bot
 * beatable".
 */
import {
  targetFor, landingX, isHit, missBy, describeShot, powerFor, arc, botShot,
  previewDots, PREVIEW, BOT_ACCURACY, MIN_ANGLE, MAX_ANGLE, clamp,
  type Level, type Shot,
} from "../src/features/challenge/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const LEVELS: Level[] = ["easy", "medium", "hard"];
// A seeded generator, so a failure here is reproducible rather than a rumour.
let s = 424242;
const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

// --- the target ------------------------------------------------------------
// Two phones must draw the same target from the same turn, or one of them is
// playing a different game.
for (let i = 0; i < 400; i++) {
  const seed = Math.trunc(rnd() * 2e12);
  for (const l of LEVELS) {
    const a = targetFor(seed, l), b = targetFor(seed, l);
    ok(a.x === b.x && a.radius === b.radius, "the same seed gives the same target");
  }
}
// Consecutive turns must not sit on top of each other: seeds are timestamps, so
// nearby values must still spread. This is the reason for the hash.
{
  const base = 1788570000000;
  const xs = Array.from({ length: 60 }, (_, i) => targetFor(base + i * 1000).x);
  const spread = Math.max(...xs) - Math.min(...xs);
  ok(spread > 0.4, `nearby timestamps give spread-out targets (got ${spread.toFixed(2)})`);
  ok(new Set(xs.map((x) => x.toFixed(3))).size > 40, "and they are not all the same few places");
}

// --- every target is actually reachable ------------------------------------
// A target you cannot physically hit is not difficulty, it is a bug.
for (let i = 0; i < 800; i++) {
  const seed = Math.trunc(rnd() * 2e12);
  for (const l of LEVELS) {
    const t = targetFor(seed, l);
    const p = powerFor(t.x, Math.PI / 4);
    ok(p !== null && p <= 1, `every ${l} target is reachable (x=${t.x.toFixed(3)})`);
    ok(isHit({ angle: Math.PI / 4, power: p! }, t), "and the solved shot actually hits it");
    // reachable without maxing out, so there is room to be long as well as short
    ok(p! < 0.99, "with power to spare, so overshooting is possible too");
  }
}

// --- the physics -----------------------------------------------------------
ok(landingX({ angle: Math.PI / 4, power: 1 }) > 0.99, "full power at 45° reaches the far end");
ok(landingX({ angle: Math.PI / 4, power: 0 }) === 0, "no power goes nowhere");
for (let i = 0; i < 300; i++) {
  const shot: Shot = { angle: MIN_ANGLE + rnd() * (MAX_ANGLE - MIN_ANGLE), power: rnd() };
  const x = landingX(shot);
  ok(x >= 0 && x <= 1.0001, `a shot always lands on the field (${x})`);
  // more power, same angle, never lands shorter
  const stronger = landingX({ ...shot, power: Math.min(1, shot.power + 0.05) });
  ok(stronger >= x - 1e-12, "more power never lands shorter — the game has to be learnable");
}
// out-of-range inputs are clamped, not obeyed
ok(landingX({ angle: -5, power: 2 }) === landingX({ angle: MIN_ANGLE, power: 1 }),
   "a wild input is clamped into the playable range");
ok(clamp(9, 0, 1) === 1 && clamp(-9, 0, 1) === 0, "clamp does what it says");

// --- the arc that gets drawn matches the verdict ----------------------------
for (let i = 0; i < 200; i++) {
  const shot: Shot = { angle: MIN_ANGLE + rnd() * (MAX_ANGLE - MIN_ANGLE), power: 0.2 + rnd() * 0.8 };
  const pts = arc(shot, 30);
  ok(pts.length === 31, "the arc has the number of points asked for");
  ok(pts[0].x === 0 && pts[0].y === 0, "it starts at the launcher");
  ok(Math.abs(pts[pts.length - 1].x - landingX(shot)) < 1e-9,
     "and it ENDS where landingX says it does — the picture cannot disagree with the verdict");
  ok(pts.every((p) => p.y >= 0), "nothing dips below the ground");
  const peak = Math.max(...pts.map((p) => p.y));
  ok(peak > 0, "and it actually goes up");
}

// --- hit, miss, and what we say about it -----------------------------------
{
  const t = { x: 0.5, radius: 0.06 };
  const at = (x: number) => ({ angle: Math.PI / 4, power: Math.sqrt(x) });
  ok(isHit(at(0.5), t), "dead centre hits");
  ok(isHit(at(0.5 + 0.059), t), "just inside the edge hits");
  ok(!isHit(at(0.5 + 0.07), t), "just outside does not");
  ok(missBy(at(0.6), t) > 0, "long is positive");
  ok(missBy(at(0.4), t) < 0, "short is negative");
  ok(describeShot(at(0.5), t) === "Hit!", "a hit says so");
  ok(describeShot(at(0.56), t) === "Just long.", "a near miss long");
  ok(describeShot(at(0.44), t) === "Just short.", "a near miss short");
  ok(describeShot(at(0.9), t) === "Way long.", "a wild miss long");
  ok(describeShot(at(0.1), t) === "Way short.", "a wild miss short");
}

// --- the bot ---------------------------------------------------------------
// Beatable, and honest: the arc it draws is the shot it committed to.
for (const l of LEVELS) {
  let hits = 0;
  const runs = 4000;
  for (let i = 0; i < runs; i++) {
    const t = targetFor(Math.trunc(rnd() * 2e12), l);
    const shot = botShot(t, l, rnd);
    ok(shot.power >= 0 && shot.power <= 1, "the bot never fires an impossible shot");
    ok(shot.angle >= MIN_ANGLE - 1e-9 && shot.angle <= MAX_ANGLE + 1e-9,
       "and never at an impossible angle");
    if (isHit(shot, t)) hits++;
  }
  const rate = hits / runs;
  // Wide bounds on purpose: this is checking "beatable but worth beating",
  // not pinning a constant nobody should be free to tune.
  ok(rate > 0.35 && rate < 0.85, `the ${l} bot hits ${(rate * 100).toFixed(0)}% — beatable`);
  ok(Math.abs(rate - BOT_ACCURACY[l]) < 0.2,
     `and lands near its stated accuracy of ${BOT_ACCURACY[l]}`);
}
// harder targets are smaller, so a fixed shooter does worse on them
{
  const fixed = { angle: Math.PI / 4, power: Math.sqrt(0.6) };
  const rates = LEVELS.map((l) => {
    let h = 0;
    for (let i = 0; i < 3000; i++) if (isHit(fixed, targetFor(Math.trunc(rnd() * 2e12), l))) h++;
    return h / 3000;
  });
  ok(rates[0] > rates[1] && rates[1] > rates[2],
     `easy is genuinely easier than hard (${rates.map((r) => r.toFixed(2)).join(" > ")})`);
}

// --- the preview cannot lie about the flight -------------------------------
// The whole point of showing an arc is that it is the arc. Asserting only that
// the drawn path ENDS in the right place — which is what the first version
// checked — passes happily while the shape on screen is wrong.
for (let i = 0; i < 400; i++) {
  const shot: Shot = {
    angle: MIN_ANGLE + rnd() * (MAX_ANGLE - MIN_ANGLE),
    power: 0.08 + rnd() * 0.92,          // including the weak pulls
  };
  const dots = previewDots(shot);
  ok(dots.length >= 6, `even a gentle pull previews dots (${dots.length})`);

  const vx = shot.power * Math.cos(shot.angle);
  const vy = shot.power * Math.sin(shot.angle);
  for (const d of dots) {
    // Every dot must satisfy the equation of motion the ball will follow.
    const t = d.x / vx;
    const y = vy * t - 0.5 * t * t;
    ok(Math.abs(y - d.y) < 1e-6,
       `a preview dot sits on the real flight path (${d.y.toFixed(5)} vs ${y.toFixed(5)})`);
    ok(d.y >= 0, "and never underground");
  }

  // It shows the opening, not the answer: the last dot stops well short of
  // where the shot lands, or aiming becomes tracing.
  const last = dots[dots.length - 1].x;
  const land = landingX(shot);
  ok(last < land * 0.98, `the preview stops short of the landing (${last.toFixed(2)} < ${land.toFixed(2)})`);
  ok(last <= land * PREVIEW + 0.05, "and shows only the opening of the flight");

  // Spaced along the ground, not by time — dots must not bunch at the top.
  const gaps = dots.slice(1).map((d, k) => d.x - dots[k].x);
  if (gaps.length > 2) {
    const min = Math.min(...gaps), max = Math.max(...gaps);
    // Relative, because the gap now scales with the shot.
    ok(max <= min * 1.6 + 1e-6,
       `dots are evenly spaced along the ground (${min.toFixed(4)}..${max.toFixed(4)})`);
  }
}
ok(previewDots({ angle: Math.PI / 4, power: 0 }).length === 0, "no power previews nothing");

// --- the picture fits the box ----------------------------------------------
// Both axes are drawn at one scale now. If a reachable shot can peak higher
// than the field is tall, the arc leaves the picture and the honesty is gone.
// Height of a shot landing at x is x·tan(angle)/4.
{
  const FIELD = 34 / 84;      // GROUND / SCALE, from Catapult.tsx
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const angle = MIN_ANGLE + rnd() * (MAX_ANGLE - MIN_ANGLE);
    const p = rnd();
    const peak = Math.pow(p * Math.sin(angle), 2) / 2;
    if (landingX({ angle, power: p }) <= 1) worst = Math.max(worst, peak);
  }
  ok(worst <= FIELD, `the tallest possible shot fits the field (${worst.toFixed(3)} <= ${FIELD.toFixed(3)})`);
}

console.log(`${n} catapult assertions hold`);
