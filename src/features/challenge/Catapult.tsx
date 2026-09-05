import { useEffect, useRef, useState } from "react";
import {
  MIN_ANGLE, MAX_ANGLE, arc, clamp, describeShot, isHit, previewDots,
  type Shot, type Target,
} from "./rules";

/*
 * The picture is 100 wide and 40 tall, and BOTH axes use the same scale.
 *
 * The first version squashed the vertical by 40% so a steep lob would fit,
 * which meant the arc on screen was not the arc the ball flew — you could not
 * learn anything from watching it. The angle is capped at 55° instead, so the
 * tallest useful shot fits an honest picture.
 */
const W = 100, H = 40;
const GROUND = 34;
const LAUNCH_X = 8;
/** One world unit of distance is this many svg units, horizontally AND up. */
const SCALE = 86;
/** A full-power pull, in svg units. About a third of the width — a thumb drag,
    and drawn as a ring so you can see where full power is instead of finding
    out by missing. */
const MAX_PULL = 26;
const FLIGHT_MS = 820;

const sx = (x: number) => LAUNCH_X + x * SCALE;
const sy = (y: number) => GROUND - y * SCALE;

/**
 * Aim, pull back, let go.
 *
 * The alternative to answering a question for your move, and the reason it
 * exists: a trivia question is a knowledge test that an eight-year-old loses to
 * an adult at any difficulty, and aim is not.
 */
export function Catapult({
  target, locked, shot, onFire, note,
}: {
  target: Target;
  /** Not your turn, or the shot is already taken. */
  locked: boolean;
  /** A shot to play back — the opponent's, or the bot's. */
  shot?: Shot | null;
  onFire?: (hit: boolean, shot: Shot) => void;
  note?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pull, setPull] = useState<{ dx: number; dy: number } | null>(null);
  const [flying, setFlying] = useState<Shot | null>(null);
  const [t, setT] = useState(0);
  const [landed, setLanded] = useState<Shot | null>(null);

  useEffect(() => { if (shot) launch(shot, false); /* eslint-disable-next-line */ }, [shot]);

  function launch(s: Shot, report: boolean) {
    setPull(null);
    setLanded(null);
    setFlying(s);
    const start = performance.now();
    const step = (now: number) => {
      const p = clamp((now - start) / FLIGHT_MS, 0, 1);
      setT(p);
      if (p < 1) requestAnimationFrame(step);
      else {
        setFlying(null);
        setLanded(s);
        if (report) onFire?.(isHit(s, target), s);
      }
    };
    requestAnimationFrame(step);
  }

  function pointToPull(e: React.PointerEvent) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return null;
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    // The pull runs from the pointer back to the launcher, so dragging down and
    // left fires up and right. A slingshot needs no explaining.
    return { dx: LAUNCH_X - px, dy: py - GROUND };
  }

  const shotFromPull = (p: { dx: number; dy: number }): Shot => {
    const len = Math.hypot(p.dx, p.dy);
    const raw = Math.atan2(Math.max(0, p.dy), Math.max(0.0001, p.dx));
    return {
      angle: clamp(raw, MIN_ANGLE, MAX_ANGLE),
      power: clamp(len / MAX_PULL, 0, 1),
    };
  };

  const live = pull ? shotFromPull(pull) : null;
  const drawn = flying ?? landed;
  const path = drawn ? arc(drawn, 40) : [];
  const ball = flying
    ? path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]
    : landed ? path[path.length - 1] : null;

  const busy = !!flying;
  const canAim = !locked && !busy && !shot;
  const dots = live ? previewDots(live) : [];

  const armX = live ? LAUNCH_X - live.power * MAX_PULL * Math.cos(live.angle) : 0;
  const armY = live ? GROUND - 3 + live.power * MAX_PULL * Math.sin(live.angle) : 0;

  return (
    <div className="space-y-2">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        className={`w-full rounded-2xl border-[3px] border-ink bg-sand touch-none select-none
          ${canAim ? "cursor-grab" : ""}`}
        onPointerDown={(e) => {
          if (!canAim) return;
          // Captured on the svg, not on whichever shape was under the finger,
          // so the pull keeps tracking once the drag leaves the picture.
          svgRef.current?.setPointerCapture?.(e.pointerId);
          setPull(pointToPull(e));
        }}
        onPointerMove={(e) => { if (pull) setPull(pointToPull(e)); }}
        onPointerUp={() => {
          if (!pull) return;
          const s = shotFromPull(pull);
          setPull(null);
          if (s.power > 0.04) launch(s, true);
        }}
        // No onPointerLeave: a pull that wanders outside the box is still a
        // pull, and cancelling on leave meant a shot that never happened.
        onPointerCancel={() => setPull(null)}>

        <defs>
          {/* The arm is drawn by pulling DOWN from a launcher that sits on the
              ground, so at full power it reaches below the field. Clipped
              rather than shortened: the length is the power reading. */}
          <clipPath id="field"><rect x="0" y="0" width={W} height={H} /></clipPath>
        </defs>

        <line x1="0" y1={GROUND} x2={W} y2={GROUND}
          stroke="var(--color-ink)" strokeWidth="1.6" />

        {/* the target: a bucket on the ground, not a stripe */}
        <g>
          <path d={`M ${sx(target.x - target.radius)} ${GROUND}
                    L ${sx(target.x - target.radius * 0.72)} ${GROUND - 7}
                    L ${sx(target.x + target.radius * 0.72)} ${GROUND - 7}
                    L ${sx(target.x + target.radius)} ${GROUND} Z`}
            fill="var(--color-good)" stroke="var(--color-ink)" strokeWidth="1.4"
            strokeLinejoin="round" />
          <ellipse cx={sx(target.x)} cy={GROUND - 7}
            rx={target.radius * 0.72 * SCALE} ry="1.6"
            fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.2" />
        </g>

        {/* how far back full power is — visible rather than discovered */}
        {canAim && (
          <circle cx={LAUNCH_X} cy={GROUND - 3} r={MAX_PULL}
            fill="none" stroke="var(--color-ink)" strokeWidth="0.6"
            strokeDasharray="2 3" opacity="0.28" />
        )}

        <rect x={LAUNCH_X - 3.5} y={GROUND - 6} width="7" height="6" rx="1.5"
          fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.5" />

        {live && (
          <g clipPath="url(#field)">
            <line x1={LAUNCH_X} y1={GROUND - 3} x2={armX} y2={armY}
              stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx={armX} cy={armY} r="2.4"
              fill="var(--color-picto)" stroke="var(--color-ink)" strokeWidth="1.2" />
            {/* the opening of the real flight path, fading out */}
            {dots.map((p, i) => (
              <circle key={i} cx={sx(p.x)} cy={sy(p.y)}
                r={1.5 - (i / Math.max(1, dots.length)) * 0.7}
                fill="var(--color-ink)"
                opacity={0.55 - (i / Math.max(1, dots.length)) * 0.35} />
            ))}
          </g>
        )}

        {drawn && (
          <polyline
            points={path.slice(0, flying
              ? Math.max(2, Math.round(t * path.length))
              : path.length).map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
            fill="none" stroke="var(--color-ink)" strokeWidth="0.9"
            strokeDasharray="2 2" opacity="0.45" />
        )}
        {ball && (
          <circle cx={sx(ball.x)} cy={sy(ball.y)} r="2.4"
            fill="var(--color-picto)" stroke="var(--color-ink)" strokeWidth="1.2" />
        )}
      </svg>

      <p className="text-center text-[13px] font-bold text-soft min-h-[20px]">
        {note ??
          (landed ? describeShot(landed, target)
            : busy ? "…"
            : canAim ? "Pull back from the catapult and let go"
            : "Waiting for their shot")}
      </p>
    </div>
  );
}
