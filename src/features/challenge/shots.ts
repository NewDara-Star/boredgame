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

export interface ShotResult { hit: boolean; big: string; small: string }
export interface ShotOpts {
  level: ShotLevel;
  onResult: (r: ShotResult) => void;
  /** the wind for cup toss, so the sheet can show it */
  onWind?: (w: number) => void;
  sound?: boolean;
}

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
}
export interface Env {
  ctx: CanvasRenderingContext2D; W: () => number; H: () => number; level: ShotLevel;
  s: ReturnType<typeof sfx>; done: (hit: boolean, big: string, small: string, at?: { x: number; y: number }) => void;
  hint: (text: string) => void; shake: (n: number) => void; font: string; clock: () => number;
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
  const W = E.W, H = E.H;
  const hoopX = () => t.amp * Math.sin(E.clock() * t.w + t.ph);
  function resize() { F = W() * (hoop ? 1.0 : 1.18); horizon = H() * (hoop ? .26 : .24); }
  function P(x: number, y: number, z: number) { const d = Math.max(.05, z - cam.z); return { x: W() / 2 + x * F / d, y: horizon + (cam.y - y) * F / d, s: F / d }; }
  function turn() {
    const easy = E.level === "easy";
    t = hoop
      ? { x: 0, y: .95, z: 1.25, r: easy ? .16 : .12, amp: easy ? .12 : .24, w: easy ? .9 : 1.5, ph: Math.random() * 6 }
      : { x: (Math.random() * 2 - 1) * (easy ? .12 : .2), y: .13, z: easy ? .95 + Math.random() * .2 : 1.0 + Math.random() * .35, r: easy ? .11 : .08, amp: 0, w: 0, ph: 0 };
    wind = hoop ? 0 : Math.round(((Math.random() * 2 - 1) * (easy ? 1.2 : 2.6)) * 10) / 10;
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
    if (state === "fly") trail.forEach((q, i) => { const r = P(q.x, q.y, q.z); ctx.beginPath(); ctx.arc(r.x, r.y, BR * r.s * (i / trail.length) * .8, 0, 7); ctx.fillStyle = `rgba(255,200,26,${i / trail.length * .35})`; ctx.fill(); });
    const p = P(b.x, b.y, b.z);
    if (b.in && !hoop && front) {             // inside the cup: clipped to its mouth
      const c = P(t.x, t.y, t.z); ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, t.r * c.s, t.r * c.s * .38, 0, 0, 7); ctx.clip();
      ball(ctx, p.x, p.y, BR * p.s); ctx.restore(); return;
    }
    ball(ctx, p.x, p.y, BR * p.s);
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
    if (state === "aim" && !drag) {
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
  return { resize, turn, update, draw, down, move, up };
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
  const W = E.W, H = E.H;
  function resize() { if (eng) turn(); }
  function turn() {
    const easy = E.level === "easy", S = Math.min(W(), 520) / 390;
    eng = Engine.create({ positionIterations: 10, velocityIterations: 8 }); eng.gravity.y = 1;
    sling = { x: Math.max(125, W() * .3), y: H() * .6 };
    const ground = Bodies.rectangle(W() / 2, H() + 30, W() * 3, 80, { isStatic: true, friction: .9 });
    const px = W() * (.7 + Math.random() * .12), pw = 96 * S, py = H() * (.56 + Math.random() * .14);
    plat = Bodies.rectangle(px, py + 10, pw, 20, { isStatic: true, friction: .8 }); plat.w = pw;
    crate = 30 * S;
    const rows = easy ? 1 : 2 + (Math.random() < .5 ? 1 : 0);
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
    ball(ctx, seed.position.x, seed.position.y, R, RAMPS.seed.base, RAMPS.seed.hi);
    if (state === "aim") { ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(s.x, s.y + 30); ctx.lineTo(s.x + 16, s.y - 6); ctx.stroke(); ctx.strokeStyle = SCENE.woodLo; ctx.lineWidth = 7; ctx.stroke(); }
    if (state === "aim" && !drag) {
      const k = (Math.sin(E.clock() * 4) + 1) / 2; ctx.fillStyle = `rgba(35,26,61,${.3 + k * .35})`;
      ctx.font = `800 13px ${E.font}`; ctx.textAlign = "center"; ctx.fillText("pull back", s.x + 10, s.y + 62 + k * 4);
    }
  }
  return { resize, turn, update, draw, down, move, up };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ============================================================== running */
/**
 * Runs one shot on `canvas` until it settles. Returns a stop function; call it
 * when the sheet closes. `onResult` fires once.
 */
export function startShot(kind: ShotKind, canvas: HTMLCanvasElement, o: ShotOpts,
  hint: (text: string) => void, matter?: MatterNS): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, shake = 0, parts: Part[] = [], clock = 0, over = false, raf = 0;
  const s = sfx(o.sound !== false);
  const font = getComputedStyle(canvas).fontFamily || "system-ui";
  const E: Env = {
    ctx, W: () => W, H: () => H, level: o.level, s, font, clock: () => clock, hint,
    shake: (n) => { if (!reduce) shake = Math.max(shake, n); },
    done: (hit, big, small, at) => {
      if (over) return; over = true;
      if (hit) {
        (kind === "hoops" ? s.swish : s.in)(); buzz([30, 40, 60]); if (!reduce) shake = 10;
        if (at) for (let i = 0; i < 34; i++) {
          const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
          parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 3 + Math.random() * 3, c: CONFETTI[i % CONFETTI.length], life: 1, rot: Math.random() * 6 });
        }
      } else { s.miss(); buzz(25); }
      o.onResult({ hit, big, small });
    },
  };
  const game: Game = kind === "knock" ? knock(matter, E) : toss(kind, E, o.onWind);
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.resize();
  }
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: PointerEvent) => { audio(); canvas.setPointerCapture(e.pointerId); const p = at(e); game.down(p.x, p.y); e.preventDefault(); };
  const onMove = (e: PointerEvent) => { const p = at(e); game.move(p.x, p.y); };
  const onUp = () => game.up();
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  const ro = new ResizeObserver(() => fit());
  ro.observe(canvas);
  fit(); game.turn();
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    game.update(dt);
    ctx.save();
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
  return () => {
    cancelAnimationFrame(raf); ro.disconnect();
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
  };
}

/** How often the bot lands each shot, by level: it misses often enough to beat. */
export const BOT_ODDS: Record<ShotKind, Record<ShotLevel, number>> = {
  cup: { easy: .4, norm: .5 }, hoops: { easy: .4, norm: .5 }, knock: { easy: .45, norm: .55 },
};
