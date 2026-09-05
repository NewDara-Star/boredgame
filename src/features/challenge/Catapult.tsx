import { useEffect, useRef, useState } from "react";
import {
  MIN_ANGLE, MAX_ANGLE, arc, clamp, describeShot, isHit, landingX,
  type Shot, type Target,
} from "./rules";

/* The drawing is 100 wide and 46 tall. Height is squashed relative to width on
   purpose: a physically proportional lob would leave the picture. Horizontal
   distance is exact, which is the part the game is judged on. */
const W = 100, H = 46, GROUND = 40;
/* The launcher is not hard against the left edge: you pull BACK from it, and at
   6% of the width that drag left the picture within a few pixels — which on a
   phone means the shot you were lining up simply never happens. */
const LAUNCH_X = 14;
const SPAN = 82;          // world x 0..1 across the field
const RISE = 58;          // world y, squashed
const MAX_PULL = 34;      // how far back a full-power pull is, in svg units
/* The arm is drawn shorter than the pull is measured: a full-power pull is 34
   units from a launcher sitting 6 units above a ground line at 40, which puts
   the end of the arm outside the picture. */
const DRAW_PULL = 20;

const sx = (x: number) => LAUNCH_X + x * SPAN;
const sy = (y: number) => GROUND - y * RISE;

const FLIGHT_MS = 780;

/**
 * Aim, pull back, let go.
 *
 * This is the alternative to answering a question for your move. There is no
 * trajectory preview on purpose — with one you simply line the line up with the
 * target and the skill evaporates. What you get instead is where the last shot
 * landed and whether it was long or short, which is enough to learn from and is
 * the same information for a child and an adult.
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

  // A shot handed in from outside (the bot, or the other player) is played back
  // through exactly the same animation as your own.
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
    // The pull is from the pointer back to the launcher, so dragging down and
    // left fires up and right — a slingshot, which needs no explaining.
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
  const path = drawn ? arc(drawn, 28) : [];
  const ball = flying
    ? path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]
    : landed ? path[path.length - 1] : null;

  const busy = !!flying;
  const canAim = !locked && !busy && !shot;

  return (
    <div className="space-y-2">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        className={`w-full rounded-2xl border-[3px] border-ink bg-sand touch-none
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
        // Deliberately no onPointerLeave: a pull that wanders outside the box
        // is still a pull. Only a cancelled pointer abandons the shot.
        onPointerCancel={() => setPull(null)}>

        <line x1="0" y1={GROUND} x2={W} y2={GROUND}
          stroke="var(--color-ink)" strokeWidth="1.5" />

        {/* the target */}
        <g>
          <rect x={sx(target.x - target.radius)} y={GROUND - 5}
            width={target.radius * 2 * SPAN} height="5"
            fill="var(--color-good)" stroke="var(--color-ink)" strokeWidth="1.2" rx="1.5" />
          <circle cx={sx(target.x)} cy={GROUND - 8.5} r="2.6"
            fill="var(--color-hot)" stroke="var(--color-ink)" strokeWidth="1.2" />
        </g>

        {/* the launcher */}
        <rect x={LAUNCH_X - 3} y={GROUND - 6} width="6" height="6" rx="1.5"
          fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.5" />

        {/* the pull: a band and a stub of the direction, never the whole arc */}
        {live && (
          <g>
            <line x1={LAUNCH_X} y1={GROUND - 4}
              x2={LAUNCH_X - live.power * DRAW_PULL * Math.cos(live.angle)}
              y2={GROUND - 4 + live.power * DRAW_PULL * Math.sin(live.angle)}
              stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" />
            {arc(live, 5).slice(1, 4).map((p, i) => (
              <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="1"
                fill="var(--color-ink)" opacity={0.45 - i * 0.12} />
            ))}
            <rect x={LAUNCH_X - 3} y={GROUND - 13} width={live.power * 30} height="2.5"
              rx="1.25" fill="var(--color-hot)" />
          </g>
        )}

        {/* where it went */}
        {drawn && (
          <polyline
            points={path.slice(0, flying
              ? Math.max(2, Math.round(t * path.length))
              : path.length).map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
            fill="none" stroke="var(--color-ink)" strokeWidth="1"
            strokeDasharray="2 2" opacity="0.5" />
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

/** Exposed for tests and for the bot: the landing spot a shot produces. */
export { landingX };
