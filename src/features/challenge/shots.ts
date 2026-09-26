/**
 * The shot challenges (Daramola, 26 Sep: "Play it with…"): cup toss, hoops and
 * knock-down, each the price of a spot on Tic Tac Toe or Connect 4. Ported from
 * the Catapult Tryouts prototypes he played and chose.
 *
 * Each is a small canvas game: `startShot(kind, canvas, …)` runs it and calls
 * `onResult` once, when the throw has settled, with whether it landed and two
 * words on why. It returns a stop function. The thrower's phone decides the
 * result (as the old catapult's did); the other phone is told, not shown.
 *
 * Fair for a child against an adult (Daramola): in the toss games the LENGTH of
 * the swipe sets the power, not its speed, and Easy widens every target.
 */
import { RAMPS, INK, SCENE } from "../../shared/brand/tokens.ts";

export type ShotKind = "cup" | "hoops" | "knock";
export type ShotLevel = "easy" | "norm";
export const SHOT_NAMES: Record<ShotKind, string> = { cup: "Cup toss", hoops: "Hoops", knock: "Knock-down" };
/** what the sheet says under the spot you're playing for */
export const SHOT_HOW: Record<ShotKind, string> = {
  cup: "Toss it in the cup", hoops: "Swish it. The hoop slides.", knock: "Knock the gold off",
};

/**
 * A shot's flight, as numbers (Daramola, 26 Sep: "send maths instead of a
 * video"). The thrower's phone writes where everything was about 30 times a
 * second, and the sounds on the frame they happened; the other phone in a room
 * draws the same frames. Toss frames are the ball in metres (and the hoop's
 * slide); knock-down's are the seed, the gold and every block, in the fixed
 * 390x540 world both phones share. A few KB.
 */
export interface ShotRec {
  v: 1; kind: ShotKind;
  f: number[][];
  ev: [number, string][];
  hit: boolean; big: string; small: string;
}
export interface ShotResult { hit: boolean; big: string; small: string; rec?: ShotRec }
export interface ShotOpts {
  level: ShotLevel;
  onResult: (r: ShotResult) => void;
  /** the wind for cup toss, so the sheet can show it */
  onWind?: (w: number) => void;
  sound?: boolean;
  /** Sets the scene (where the cup is, the wind, the stack) from a number both
      phones in a room share, so the one watching sees the same cup. */
  seed?: number;
  /** the thrower's colour: petal for crosses, sky for rings */
  tint?: "petal" | "sky";
  /** The other phone: no hands on it. It shows the scene and, given a flight,
      plays it back. */
  watch?: boolean;
  /** the moment the ball leaves the hand */
  onFly?: () => void;
}
export interface ShotControl { stop(): void; replay(r: ShotRec): void }

/** A seeded dice (mulberry32): the same number gives the same scene. */
export function seeded(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;

/* ---------------------------------------------------------------- juice */
let AC: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!AC) {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      AC = Ctor ? new Ctor() : null;
    }
    if (AC && AC.state === "suspended") void AC.resume();
  } catch { AC = null; }
  return AC;
}
function tone(on: boolean, f: number, d = .12, type: OscillatorType = "sine", v = .2, to: number | null = null, delay = 0) {
  if (!on) return; const a = audio(); if (!a) return; const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
}
function noise(on: boolean, d = .18, v = .15, band = 800) {
  if (!on) return; const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "bandpass"; f.frequency.value = band; g.gain.value = v;
  s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
}
const sfx = (on: boolean) => ({
  throw: () => noise(on, .22, .25, 900),
  rim: () => { tone(on, 1320, .09, "triangle", .18); tone(on, 1980, .07, "sine", .08); },
  thud: () => tone(on, 140, .12, "sine", .3, 70),
  wood: () => { tone(on, 220, .06, "square", .06, 160); noise(on, .06, .12, 400); },
  in: () => { [523, 659, 784, 1046].forEach((f, i) => tone(on, f, .16, "triangle", .16, null, i * .07)); },
  swish: () => { noise(on, .3, .22, 2600); [784, 988, 1175].forEach((f, i) => tone(on, f, .14, "triangle", .12, null, .05 + i * .06)); },
  miss: () => tone(on, 330, .25, "sine", .14, 180),
});
export const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not on this phone */ } };

interface Part { x: number; y: number; vx: number; vy: number; r: number; c: string; life: number; rot: number }
const CONFETTI = [RAMPS.petal.base, RAMPS.sky.base, RAMPS.leaf.base, RAMPS.ember.base, RAMPS.gum.base, RAMPS.grape.base];

/** A ball in the brand's way: an ink body dropped a little, lit from the top left. */
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string = RAMPS.petal.base, hi: string = RAMPS.petal.hi) {
  ctx.beginPath(); ctx.arc(x, y + Math.max(1.5, r * .12), r, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = INK; ctx.fill();
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, hi); g.addColorStop(.65, col);
  ctx.beginPath(); ctx.arc(x, y, r * .8, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - r * .3, y - r * .35, r * .22, r * .13, -.6, 0, 7); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fill();
}

export interface Game {
  resize(): void; turn(): void; update(dt: number): void; draw(): void;
  down(x: number, y: number): void; move(x: number, y: number): void; up(): void;
  /** this instant, as a frame of the flight */
  snap(): number[];
  /** put everything where a frame says (the replay) */
  show(f: number[]): void;
  /** where the result happened on screen, for the confetti */
  at(): { x: number; y: number } | undefined;
}
export interface Env {
  ctx: CanvasRenderingContext2D; W: () => number; H: () => number; level: ShotLevel;
  s: ReturnType<typeof sfx>; done: (hit: boolean, big: string, small: string, at?: { x: number; y: number }) => void;
  hint: (text: string) => void; shake: (n: number) => void; font: string; clock: () => number;
  /** the scene's dice (seeded in a room); Math.random when missing */
  rand?: () => number;
  tint?: "petal" | "sky";
  watch?: boolean;
}

/* ============================================================ the tosses
   A real 3D throw drawn in perspective. World in metres: x across, y up,
   z away from you. g = 9.8. */
export function toss(kind: "cup" | "hoops", E: Env, onWind?: (w: number) => void): Game {
  const hoop = kind === "hoops";
  const { ctx } = E;
  const cam = { y: hoop ? .8 : .62, z: -.55 };
  const BR = hoop ? .06 : .028, G = 9.8, DT = 1 / 240;
  let F = 400, horizon = 100;
  type T = { x: number; y: number; z: number; r: number; amp: number; w: number; ph: number };
  let t: T = { x: 0, y: .13, z: 1, r: .08, amp: 0, w: 0, ph: 0 };
  let b = { x: 0, y: .12, z: .12, vx: 0, vy: 0, vz: 0, in: false, cx: 0, apex: -9, xAt: 0 };
  let trail: { x: number; y: number; z: number }[] = [];
  let state: "aim" | "fly" | "incup" | "swish" | "done" = "aim";
  let drag: { x: number; y: number } | null = null, from: { x: number; y: number } | null = null;
  let wind = 0, rattled = 0, rimHits = 0, cupWobble = 0, acc = 0, flown = 0;
  const W = E.W, H = E.H, rand = E.rand ?? Math.random;
  // in a replay the hoop is where the thrower saw it, not where this clock says
  let hx: number | null = null;
  const hoopX = () => hx ?? t.amp * Math.sin(E.clock() * t.w + t.ph);
  const tint = RAMPS[E.tint ?? "petal"];
  function resize() { F = W() * (hoop ? 1.0 : 1.18); horizon = H() * (hoop ? .26 : .24); }
  function P(x: number, y: number, z: number) { const d = Math.max(.05, z - cam.z); return { x: W() / 2 + x * F / d, y: horizon + (cam.y - y) * F / d, s: F / d }; }
  function turn() {
    const easy = E.level === "easy";
    t = hoop
      ? { x: 0, y: .95, z: 1.25, r: easy ? .16 : .12, amp: easy ? .12 : .24, w: easy ? .9 : 1.5, ph: rand() * 6 }
      : { x: (rand() * 2 - 1) * (easy ? .12 : .2), y: .13, z: easy ? .95 + rand() * .2 : 1.0 + rand() * .35, r: easy ? .11 : .08, amp: 0, w: 0, ph: 0 };
    wind = hoop ? 0 : Math.round(((rand() * 2 - 1) * (easy ? 1.2 : 2.6)) * 10) / 10;
    onWind?.(wind);
    b = { x: 0, y: hoop ? .14 : .12, z: .12, vx: 0, vy: 0, vz: 0, in: false, cx: 0, apex: -9, xAt: 0 };
    trail = []; state = "aim"; rattled = 0; rimHits = 0; flown = 0;
  }
  // Swipe LENGTH sets the power (the same on every phone, and a child can
  // control it); the swipe's slant sets the line.
  function throwIt(dx: number, dyUp: number) {
    if (dyUp < 30) return false;
    const p = Math.min(1, dyUp / (H() * .45));
    const ang = (hoop ? 60 : 47) * Math.PI / 180, s = hoop ? 2.5 + p * 3.7 : 1.6 + p * 3.0;
    b.vz = s * Math.cos(ang); b.vy = s * Math.sin(ang); b.vx = (dx / dyUp) * b.vz * .55;
    state = "fly"; E.s.throw(); buzz(12); return true;
  }
  function step() {
    const prevY = b.y;
    b.apex = Math.max(b.apex, b.y);
    b.vx += (hoop ? 0 : wind * .35) * DT; b.vy -= G * DT;
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
    const tx = hoop ? hoopX() : t.x, dx = b.x - tx, dz = b.z - t.z, d = Math.hypot(dx, dz);
    if (b.z <= t.z) b.xAt = b.x - tx;
    if (b.vy < 0 && prevY >= t.y && b.y < t.y) {                     // through the mouth, falling
      if (d <= t.r - BR * .6) { b.in = true; state = hoop ? "swish" : "incup"; b.vx *= .2; b.vz *= .2; b.cx = tx; return; }
      if (d <= t.r + BR) {                                              // on the rim
        rimHits++;
        // A ball can come to rest ON the rim: every bounce smaller than the
        // last, none of them ever ending (Daramola's phone, 26 Sep: it sat on
        // the cup's edge for good). A slow ball or a sixth touch settles it:
        // over the mouth it drops in, otherwise it rolls off the outside.
        if (rimHits > 5 || Math.abs(b.vy) < .6) {
          if (d < t.r) { b.in = true; rattled++; state = hoop ? "swish" : "incup"; b.vx = 0; b.vz = 0; b.vy = -.3; b.cx = tx; return; }
          const nx = dx / (d || 1), nz = dz / (d || 1);
          b.x = tx + nx * (t.r + BR * 1.3); b.z = t.z + nz * (t.r + BR * 1.3); b.y = t.y - .002;
          b.vx = nx * .5; b.vz = nz * .5; b.vy = -.2; return;
        }
        E.s.rim(); buzz(8);
        const nx = dx / (d || 1), nz = dz / (d || 1), inward = d < t.r, vn = b.vx * nx + b.vz * nz;
        if (inward) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; }
        else { b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz; b.vx += nx * .35; b.vz += nz * .35; }
        b.vx *= .6; b.vz *= .6; b.vy = Math.abs(b.vy) * (inward ? .35 : .45); b.y = t.y + .001;
        if (inward) rattled++;
        return;
      }
    }
    if (hoop) {
      const bz = t.z + t.r + .05;                                        // the backboard
      if (b.vz > 0 && b.z + BR > bz && b.z - BR < bz + .04 && b.y > t.y - .05 && b.y < t.y + .5 && Math.abs(b.x - tx) < .38) {
        b.z = bz - BR; b.vz = -b.vz * .45; b.vx *= .8; E.s.wood(); buzz(10); rimHits++;
      }
      if (b.y < BR) { b.y = BR; if (b.vy < -1) { b.vy = -b.vy * .5; E.s.thud(); } else b.vy = 0; b.vx *= .8; b.vz *= .8; }
    } else {
      if (b.y < t.y && b.y > 0 && d < t.r + BR && d > t.r - BR * .5) {  // the cup's wall, from outside
        const nx = dx / (d || 1), nz = dz / (d || 1), vn = b.vx * nx + b.vz * nz;
        if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; E.s.wood(); }
      }
      const onTable = b.z > 0 && b.z < 2.1 && Math.abs(b.x) < .62;      // the table
      if (onTable && b.y < BR) { b.y = BR; if (b.vy < -.6) { b.vy = -b.vy * .45; E.s.thud(); } else b.vy = 0; b.vx *= .82; b.vz *= .82; }
    }
    const still = Math.hypot(b.vx, b.vy, b.vz) < .05 && b.y <= BR + .001;
    // Five seconds is longer than any real throw: whatever the ball is doing
    // by then, the turn is over. Nothing may leave a shot running for ever.
    flown += DT;
    if (flown > 5) { const dd = Math.hypot(b.x - (hoop ? hoopX() : t.x), b.z - t.z); if (dd < t.r && b.y <= t.y + BR) { b.in = true; b.cx = hoop ? hoopX() : t.x; state = hoop ? "swish" : "incup"; } else miss(); return; }
    if (still || b.y < -1 || b.z > 3 || Math.abs(b.x) > 2) miss();
  }
  function miss() {
    state = "done";
    const why = hoop ? (b.apex < t.y ? "Too low" : Math.abs(b.xAt) > t.r ? "Wide" : "Long")
      : b.z < t.z - t.r ? "Short" : b.z > t.z + t.r ? "Long" : "Wide";
    E.done(false, rimHits ? "Off the rim" : why, rimHits ? "So close" : hoop ? "Time it with the hoop" : windWords());
  }
  const windWords = () => (wind === 0 ? "No wind that time" : `The wind was ${Math.abs(wind).toFixed(1)} ${wind > 0 ? "to the right" : "to the left"}`);
  function score() {
    state = "done";
    const p = P(b.cx, t.y, t.z);
    E.done(true, hoop ? (rimHits ? "Bank shot!" : "Swish!") : rattled || rimHits ? "Rattled in!" : "In!",
      hoop ? "" : rimHits ? "Off the rim and down" : "Clean", p);
    cupWobble = 1;
  }
  function update(dt: number) {
    if (state === "fly") {
      acc += dt; let n = 0;
      while (acc >= DT && state === "fly" && n < 40) { step(); acc -= DT; n++; }
      trail.push({ x: b.x, y: b.y, z: b.z }); if (trail.length > 14) trail.shift();
    } else if (state === "incup" || state === "swish") {
      b.vy -= G * dt; b.y += b.vy * dt;
      if (hoop) { b.x = hoopX(); b.z += (t.z - b.z) * .2; } else { b.x += (b.cx - b.x) * .15; b.z += (t.z - b.z) * .15; }
      const floor = hoop ? BR : .02 + BR;
      if (b.y <= (hoop ? t.y - .25 : floor)) { if (!hoop) b.y = floor; score(); }
    }
    cupWobble *= .93;
  }
  function rim(cx: number, y: number, z: number, r: number) {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push(P(cx + Math.cos(a) * r, y, z + Math.sin(a) * r)); } return pts;
  }
  function path(pts: { x: number; y: number }[]) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); }
  function drawBall(front: boolean) {
    if (b.y < -.5) return;
    // the trail in the thrower's colour (26i: a blue ball leaves blue dots)
    if (state === "fly") trail.forEach((q, i) => { const r = P(q.x, q.y, q.z); ctx.beginPath(); ctx.arc(r.x, r.y, BR * r.s * (i / trail.length) * .8, 0, 7); ctx.globalAlpha = i / trail.length * .35; ctx.fillStyle = tint.base; ctx.fill(); ctx.globalAlpha = 1; });
    const p = P(b.x, b.y, b.z);
    if (b.in && !hoop && front) {             // inside the cup: clipped to its mouth
      const c = P(t.x, t.y, t.z); ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, t.r * c.s, t.r * c.s * .38, 0, 0, 7); ctx.clip();
      ball(ctx, p.x, p.y, BR * p.s, tint.base, tint.hi); ctx.restore(); return;
    }
    ball(ctx, p.x, p.y, BR * p.s, tint.base, tint.hi);
  }
  function drawCup(cx: number) {
    const wob = Math.sin(E.clock() * 30) * cupWobble * .01;
    const top = rim(cx + wob, t.y, t.z, t.r), bot = rim(cx + wob, .005, t.z, t.r * .72);
    const L = P(cx - t.r + wob, t.y, t.z), R = P(cx + t.r + wob, t.y, t.z), bl = P(cx - t.r * .72 + wob, 0, t.z), br = P(cx + t.r * .72 + wob, 0, t.z);
    const sh = P(cx, 0, t.z); ctx.beginPath(); ctx.ellipse(sh.x + 4, sh.y + 2, t.r * sh.s, t.r * sh.s * .3, 0, 0, 7); ctx.fillStyle = "rgba(35,26,61,.18)"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(bl.x, bl.y); bot.slice(0, 21).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.lineTo(br.x, br.y); ctx.lineTo(R.x, R.y); ctx.closePath();
    const g = ctx.createLinearGradient(L.x, 0, R.x, 0); g.addColorStop(0, RAMPS.ember.hi); g.addColorStop(.5, RAMPS.ember.base); g.addColorStop(1, RAMPS.ember.lo);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    path(top); ctx.fillStyle = SCENE.cupMouth; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = RAMPS.ember.hi; path(top.slice(0, 21)); ctx.stroke();
  }
  function drawHoop(cx: number) {
    const bz = t.z + t.r + .05;
    const p1 = P(cx, 0, bz + .05), p2 = P(cx, t.y + .25, bz + .05);
    ctx.lineWidth = Math.max(4, .035 * p1.s); ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const a = P(cx - .38, t.y + .5, bz), c = P(cx + .38, t.y - .05, bz);
    ctx.fillStyle = "white"; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(a.x, a.y, c.x - a.x, c.y - a.y, 8); ctx.fill(); ctx.stroke();
    const q = P(cx - .14, t.y + .22, bz), q2 = P(cx + .14, t.y + .02, bz); ctx.strokeStyle = RAMPS.ember.base; ctx.lineWidth = 3; ctx.strokeRect(q.x, q.y, q2.x - q.x, q2.y - q.y);
    const top = rim(cx, t.y, t.z, t.r), low = rim(cx, t.y - .2, t.z, t.r * .6);
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i += 3) {
      ctx.beginPath(); ctx.moveTo(top[i].x, top[i].y); ctx.lineTo(low[(i + 3) % 40].x, low[(i + 3) % 40].y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(top[i].x, top[i].y); ctx.lineTo(low[(i + 37) % 40].x, low[(i + 37) % 40].y); ctx.stroke();
    }
    path(low); ctx.stroke();
    path(top); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = RAMPS.ember.base; ctx.stroke();
  }
  function draw() {
    const w = W(), h = H();
    ctx.fillStyle = SCENE.air; ctx.fillRect(0, 0, w, h);
    if (hoop) {
      const g = ctx.createLinearGradient(0, horizon, 0, h); g.addColorStop(0, SCENE.courtHi); g.addColorStop(1, SCENE.court);
      const f0 = P(0, 0, 6); ctx.fillStyle = g; ctx.fillRect(0, f0.y, w, h);
      ctx.strokeStyle = "rgba(35,26,61,.12)"; ctx.lineWidth = 2;
      for (let z = .5; z < 6; z += .5) { const a = P(-3, 0, z), c = P(3, 0, z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
    } else {
      const a = P(-.62, 0, 0), bq = P(.62, 0, 0), c = P(.62, 0, 2.1), d = P(-.62, 0, 2.1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bq.x, bq.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
      const g = ctx.createLinearGradient(0, d.y, 0, a.y); g.addColorStop(0, SCENE.woodHi); g.addColorStop(1, SCENE.wood); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = SCENE.grain; ctx.lineWidth = 1.5;
      for (let x = -.5; x <= .5; x += .25) { const p1 = P(x, 0, 0), p2 = P(x, 0, 2.1); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
    }
    const tx = hoop ? hoopX() : t.x, behind = b.z > t.z;
    if (hoop || (b.z > 0 && b.z < 2.1 && Math.abs(b.x) < .62)) {
      if (b.y > -.5) { const s = P(b.x, 0, b.z); ctx.beginPath(); ctx.ellipse(s.x, s.y, BR * s.s * 1.1, BR * s.s * .35, 0, 0, 7); ctx.fillStyle = `rgba(35,26,61,${Math.max(.05, .28 - b.y * .25)})`; ctx.fill(); }
    }
    if (behind && !b.in) drawBall(false);
    if (hoop) drawHoop(tx); else drawCup(tx);
    if (!behind || b.in) drawBall(true);
    if (drag && from && state === "aim") {
      const s = P(b.x, b.y, b.z); ctx.setLineDash([4, 7]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(35,26,61,.35)";
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
      const pw = Math.min(1, Math.max(0, (from.y - drag.y) / (h * .45)));
      ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(12, h - 22, w - 24, 10, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pw > .92 ? RAMPS.ember.base : RAMPS.petal.base; ctx.beginPath(); ctx.roundRect(13, h - 21, (w - 26) * pw, 8, 4); ctx.fill();
    }
    if (state === "aim" && !drag && !E.watch) {
      const s = P(b.x, b.y, b.z), k = (Math.sin(E.clock() * 4) + 1) / 2;
      ctx.fillStyle = `rgba(35,26,61,${.25 + k * .35})`; ctx.font = `800 13px ${E.font}`; ctx.textAlign = "center";
      ctx.fillText("swipe up", s.x, s.y - BR * s.s - 18 - k * 6);
    }
  }
  function down(x: number, y: number) {
    if (state !== "aim") return; const s = P(b.x, b.y, b.z);
    if (Math.hypot(x - s.x, y - s.y) > Math.max(80, BR * s.s * 3)) { E.hint("Start on the ball"); return; }
    drag = { x, y }; from = { x, y };
  }
  function move(x: number, y: number) { if (drag) drag = { x, y }; }
  function up() {
    if (!drag || !from) return; const a = from, z = drag; drag = null; from = null;
    if (!throwIt(z.x - a.x, a.y - z.y)) E.hint("Swipe up: longer goes further");
  }
  const snap = () => [r3(b.x), r3(b.y), r3(b.z), b.in ? 1 : 0, hoop ? r3(hoopX()) : 0];
  function show(f: number[]) {
    b.x = f[0]; b.y = f[1]; b.z = f[2]; b.in = f[3] === 1;
    if (hoop) hx = f[4];
    state = "fly"; trail.push({ x: b.x, y: b.y, z: b.z }); if (trail.length > 14) trail.shift();
  }
  const at = () => { const p = P(b.x, b.y, b.z); return { x: p.x, y: p.y }; };
  return { resize, turn, update, draw, down, move, up, snap, show, at };
}

/* ========================================================= the knock-down
   A slingshot and a stack, in Matter.js (loaded on first use). */
// Matter's own types aren't in the project; this is the slice used here.
/* eslint-disable @typescript-eslint/no-explicit-any */
type MatterNS = any;
let matterP: Promise<MatterNS> | null = null;
export function loadMatter(): Promise<MatterNS> {
  const w = window as unknown as { Matter?: MatterNS };
  if (w.Matter) return Promise.resolve(w.Matter);
  matterP ??= new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "/vendor/matter-0.19.0.min.js"; s.async = true;
    s.onload = () => (w.Matter ? ok(w.Matter) : no(new Error("matter missing")));
    s.onerror = () => { matterP = null; no(new Error("matter failed to load")); };
    document.head.appendChild(s);
  });
  return matterP;
}

function knock(M: MatterNS, E: Env): Game {
  const { Engine, Bodies, Composite, Body } = M;
  const { ctx } = E;
  let eng: any, seed: any, token: any, plat: any, blocks: any[] = [];
  let sling = { x: 0, y: 0 }, state: "aim" | "fly" | "done" = "aim", drag: { x: number; y: number } | null = null;
  let preview: { x: number; y: number }[] = [], t0 = 0, lastHit = 0, crate = 30;
  const R = 13, MAXPULL = 115, K = .205;
  // A fixed world, scaled to the canvas, so the stack stands in the same place
  // on every phone: a replay's frames only mean something if it does.
  const W = () => KNOCK_W, H = () => KNOCK_H, rand = E.rand ?? Math.random;
  function resize() { /* the world doesn't change size; startShot scales it */ }
  function turn() {
    const easy = E.level === "easy", S = Math.min(W(), 520) / 390;
    eng = Engine.create({ positionIterations: 10, velocityIterations: 8 }); eng.gravity.y = 1;
    sling = { x: Math.max(125, W() * .3), y: H() * .6 };
    const ground = Bodies.rectangle(W() / 2, H() + 30, W() * 3, 80, { isStatic: true, friction: .9 });
    const px = W() * (.7 + rand() * .12), pw = 96 * S, py = H() * (.56 + rand() * .14);
    plat = Bodies.rectangle(px, py + 10, pw, 20, { isStatic: true, friction: .8 }); plat.w = pw;
    crate = 30 * S;
    const rows = easy ? 1 : 2 + (rand() < .5 ? 1 : 0);
    blocks = [];
    for (let r = 0; r < rows; r++) {
      const n = r < 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = px + (n === 1 ? 0 : (i - .5) * (crate + 2)), y = py - crate / 2 - r * crate;
        blocks.push(Bodies.rectangle(x, y, crate, crate, { friction: .6, restitution: .05, density: .0016, chamfer: { radius: 4 } }));
      }
    }
    // The gold sits flat on the stack: a round one rolled off by itself.
    const ts = (easy ? 34 : 28) * S;
    token = Bodies.rectangle(px, py - rows * crate - ts / 2, ts, ts * .8, { friction: .9, frictionStatic: 1, restitution: .1, density: .001, chamfer: { radius: 7 } });
    token.size = ts;
    seed = Bodies.circle(sling.x, sling.y, R, { density: .006, frictionAir: 0, restitution: .3, friction: .5 }); Body.setStatic(seed, true);
    Composite.add(eng.world, [ground, plat, ...blocks, token, seed]);
    state = "aim"; drag = null; preview = [];
  }
  function pull() {
    if (!drag) return { x: 0, y: 0 };
    let dx = drag.x - sling.x, dy = drag.y - sling.y; const d = Math.hypot(dx, dy);
    if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; }
    return { x: dx, y: dy };
  }
  function down(x: number, y: number) {
    if (state !== "aim") return;
    if (Math.hypot(x - sling.x, y - sling.y) > 70) { E.hint("Grab the seed"); return; }
    drag = { x, y };
  }
  function move(x: number, y: number) {
    if (!drag) return; drag = { x, y }; const p = pull();
    Body.setPosition(seed, { x: sling.x + p.x, y: sling.y + p.y });
    // the opening of the arc: enough to read the direction, the rest is yours
    preview = []; let px = sling.x + p.x, py = sling.y + p.y, vx = -p.x * K, vy = -p.y * K;
    const g = eng.gravity.y * eng.gravity.scale * (1000 / 60) ** 2;
    for (let i = 0; i < 26; i++) { px += vx; py += vy; vy += g; if (i % 2 === 0) preview.push({ x: px, y: py }); }
  }
  function up() {
    if (!drag) return; const p = pull(); drag = null; preview = [];
    if (Math.hypot(p.x, p.y) < 25) { Body.setPosition(seed, sling); E.hint("Pull back further"); return; }
    Body.setStatic(seed, false); Body.setVelocity(seed, { x: -p.x * K, y: -p.y * K });
    state = "fly"; t0 = E.clock(); E.s.throw(); buzz(15);
  }
  function update() {
    if (state === "aim") return;
    Engine.update(eng, 1000 / 60);
    if (state === "fly" && E.clock() - lastHit > .12) {
      for (const bl of [...blocks, token]) {
        if (M.Collision.collides(seed, bl)) { E.s.wood(); buzz(10); lastHit = E.clock(); E.shake(4); break; }
      }
    }
    const topY = plat.position.y - 10;
    const off = token.position.y > topY + 40 || token.position.x < plat.position.x - plat.w || token.position.x > W() + 40 || token.position.y > H() + 40;
    if (state === "fly" && off) {
      state = "done";
      E.done(true, "Knocked it off!", "Down it goes", { x: Math.min(W() - 10, Math.max(10, token.position.x)), y: Math.min(H() - 10, token.position.y) });
    } else if (state === "fly" && E.clock() - t0 > 4.5) {
      state = "done"; E.done(false, "Still standing", "Hit the stack under the gold");
    }
  }
  function draw() {
    const w = W(), h = H();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, SCENE.dawn); g.addColorStop(1, "white"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = RAMPS.leaf.base; ctx.beginPath(); ctx.ellipse(w / 2, h + h * .35, w * .9, h * .45, 0, Math.PI, 0); ctx.fill();
    const pp = plat.position, pw = plat.w;
    ctx.fillStyle = SCENE.woodLo; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(pp.x - 8, pp.y, 16, h - pp.y); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SCENE.wood; ctx.beginPath(); ctx.roundRect(pp.x - pw / 2, pp.y, pw, 20, 6); ctx.fill(); ctx.stroke();
    const s = sling, at = state === "aim" ? seed.position : s;
    ctx.lineCap = "round"; ctx.strokeStyle = INK; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(s.x, h); ctx.lineTo(s.x, s.y + 30); ctx.lineTo(s.x - 16, s.y - 6); ctx.moveTo(s.x, s.y + 30); ctx.lineTo(s.x + 16, s.y - 6); ctx.stroke();
    ctx.strokeStyle = SCENE.woodLo; ctx.lineWidth = 7; ctx.stroke();
    if (state === "aim") { ctx.strokeStyle = RAMPS.ember.lo; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(s.x - 16, s.y - 6); ctx.lineTo(at.x, at.y); ctx.lineTo(s.x + 16, s.y - 6); ctx.stroke(); }
    preview.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x, q.y, 3.2 - i * .1, 0, 7); ctx.fillStyle = `rgba(35,26,61,${.45 - i * .03})`; ctx.fill(); });
    for (const bl of blocks) {
      ctx.save(); ctx.translate(bl.position.x, bl.position.y); ctx.rotate(bl.angle);
      ctx.fillStyle = RAMPS.sky.base; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-crate / 2, -crate / 2, crate, crate, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = RAMPS.sky.hi; ctx.fillRect(-crate / 2 + 4, -crate / 2 + 4, crate - 8, 5); ctx.restore();
    }
    const ts = token.size; ctx.save(); ctx.translate(token.position.x, token.position.y); ctx.rotate(token.angle);
    ctx.fillStyle = RAMPS.petal.base; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-ts / 2, -ts * .4, ts, ts * .8, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = RAMPS.petal.hi; ctx.fillRect(-ts / 2 + 5, -ts * .4 + 4, ts - 10, 4);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-ts * .15, 0, ts * .06, 0, 7); ctx.arc(ts * .15, 0, ts * .06, 0, 7); ctx.fill(); ctx.restore();
    ball(ctx, seed.position.x, seed.position.y, R, RAMPS[E.tint ?? "seed"].base, RAMPS[E.tint ?? "seed"].hi);
    if (state === "aim") { ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(s.x, s.y + 30); ctx.lineTo(s.x + 16, s.y - 6); ctx.stroke(); ctx.strokeStyle = SCENE.woodLo; ctx.lineWidth = 7; ctx.stroke(); }
    if (state === "aim" && !drag && !E.watch) {
      const k = (Math.sin(E.clock() * 4) + 1) / 2; ctx.fillStyle = `rgba(35,26,61,${.3 + k * .35})`;
      ctx.font = `800 13px ${E.font}`; ctx.textAlign = "center"; ctx.fillText("pull back", s.x + 10, s.y + 62 + k * 4);
    }
  }
  const snap = () => [r1(seed.position.x), r1(seed.position.y), r1(token.position.x), r1(token.position.y), r3(token.angle),
    ...blocks.flatMap((bl) => [r1(bl.position.x), r1(bl.position.y), r3(bl.angle)])];
  function show(f: number[]) {
    Body.setPosition(seed, { x: f[0], y: f[1] });
    Body.setPosition(token, { x: f[2], y: f[3] }); Body.setAngle(token, f[4]);
    blocks.forEach((bl, i) => { Body.setPosition(bl, { x: f[5 + i * 3], y: f[6 + i * 3] }); Body.setAngle(bl, f[7 + i * 3]); });
    state = "fly";
  }
  const at = () => ({ x: Math.min(W() - 10, Math.max(10, token.position.x)), y: Math.min(H() - 10, token.position.y) });
  return { resize, turn, update, draw, down, move, up, snap, show, at };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/** knock-down's world, in its own units; the canvas shows it scaled to fit */
const KNOCK_W = 390, KNOCK_H = 540;

/* ============================================================== running */
/**
 * Runs one shot on `canvas` until it settles. `onResult` fires once, with the
 * flight when there was one. Call `stop` when the sheet closes. On the phone
 * that's watching (`watch`), nothing takes a hand; `replay` plays a flight.
 */
export function startShot(kind: ShotKind, canvas: HTMLCanvasElement, o: ShotOpts,
  hint: (text: string) => void, matter?: MatterNS): ShotControl {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop: () => {}, replay: () => {} };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, shake = 0, parts: Part[] = [], clock = 0, over = false, raf = 0;
  // knock-down's fixed world, scaled into the canvas (k) and centred (ox, oy)
  let k = 1, ox = 0, oy = 0;
  const loud = sfx(o.sound !== false);
  // The flight being written: from the throw to the result.
  let rec: { f: number[][]; ev: [number, string][] } | null = null, recT = 0, done: ShotRec | undefined;
  // The flight being played back.
  let play: { r: ShotRec; t: number; ei: number } | null = null;
  // Knock-down's result is known the moment the gold leaves the stack, but the
  // stack is still coming down: write on a little longer, so the other phone
  // sees it fall, then give the result.
  let ending: { hit: boolean; big: string; small: string; at?: { x: number; y: number }; until: number } | null = null;
  const s = Object.fromEntries(Object.entries(loud).map(([name, fn]) => [name, () => {
    if (name === "throw" && !o.watch && !rec && !play) { rec = { f: [], ev: [] }; recT = 0; o.onFly?.(); }
    if (rec && !over) rec.ev.push([rec.f.length, name]);
    fn();
  }])) as typeof loud;
  const font = getComputedStyle(canvas).fontFamily || "system-ui";
  const E: Env = {
    ctx, W: () => W, H: () => H, level: o.level, s, font, clock: () => clock, hint,
    rand: o.seed != null ? seeded(o.seed) : Math.random, tint: o.tint, watch: o.watch,
    shake: (n) => { if (!reduce) shake = Math.max(shake, n); },
    done: (hit, big, small, at) => {
      if (over || ending) return;
      if (kind === "knock" && rec && !play) { ending = { hit, big, small, at, until: rec.f.length + 24 }; return; }
      finish(hit, big, small, at);
    },
  };
  function finish(hit: boolean, big: string, small: string, at?: { x: number; y: number }) {
    if (rec) { rec.f.push(game.snap()); done = { v: 1, kind, f: rec.f, ev: rec.ev, hit, big, small }; }
    over = true;
    if (hit) {
      (kind === "hoops" ? loud.swish : loud.in)(); buzz([30, 40, 60]); if (!reduce) shake = 10;
      if (at) for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
        parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 3 + Math.random() * 3, c: CONFETTI[i % CONFETTI.length], life: 1, rot: Math.random() * 6 });
      }
    } else { loud.miss(); buzz(25); }
    o.onResult({ hit, big, small, rec: done });
  }
  const game: Game = kind === "knock" ? knock(matter, E) : toss(kind, E, o.onWind);
  function fit() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    if (kind === "knock") {
      k = Math.min(r.width / KNOCK_W, r.height / KNOCK_H);
      ox = (r.width - KNOCK_W * k) / 2; oy = (r.height - KNOCK_H * k) / 2;
      W = KNOCK_W; H = KNOCK_H;
    } else { k = 1; ox = 0; oy = 0; W = r.width; H = r.height; }
    game.resize();
  }
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - ox) / k, y: (e.clientY - r.top - oy) / k }; };
  const onDown = (e: PointerEvent) => { audio(); canvas.setPointerCapture(e.pointerId); const p = at(e); game.down(p.x, p.y); e.preventDefault(); };
  const onMove = (e: PointerEvent) => { const p = at(e); game.move(p.x, p.y); };
  const onUp = () => game.up();
  if (!o.watch) {
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  }
  const ro = new ResizeObserver(() => fit());
  ro.observe(canvas);
  fit(); game.turn();
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    if (play) {
      // 30 frames a second, whatever this phone's refresh rate
      play.t += dt;
      const { r } = play, i = Math.min(r.f.length - 1, Math.floor(play.t * 30));
      game.show(r.f[i]);
      while (play.ei < r.ev.length && r.ev[play.ei][0] <= i) { const fn = loud[r.ev[play.ei][1] as keyof typeof loud]; fn?.(); play.ei++; }
      if (i >= r.f.length - 1 && !over) E.done(r.hit, r.big, r.small, game.at());
    } else {
      game.update(dt);
      if (rec && !over) { recT += dt; while (recT >= 1 / 30) { rec.f.push(game.snap()); recT -= 1 / 30; } }
      if (ending && rec && rec.f.length >= ending.until) { const e = ending; ending = null; finish(e.hit, e.big, e.small, e.at); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (kind === "knock" && (ox > 0 || oy > 0)) {
      // the bands either side of the world: sky above, the hill below
      const cw = canvas.width / dpr, ch = canvas.height / dpr;
      ctx.fillStyle = SCENE.dawn; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = RAMPS.leaf.base; ctx.fillRect(0, oy + KNOCK_H * k - 2, cw, ch);
    }
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(k, k);
    if (shake > .3) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .86; } else shake = 0;
    game.draw();
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += .22; p.life -= .018; p.rot += .2;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2); ctx.restore();
    }
    ctx.restore();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    },
    replay(r: ShotRec) {
      if (play || over || !r.f.length) return;
      play = { r, t: 0, ei: 0 };
    },
  };
}

/** How often the bot lands each shot, by level: it misses often enough to beat. */
export const BOT_ODDS: Record<ShotKind, Record<ShotLevel, number>> = {
  cup: { easy: .4, norm: .5 }, hoops: { easy: .4, norm: .5 }, knock: { easy: .45, norm: .55 },
};
