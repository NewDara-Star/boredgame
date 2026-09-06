import { useEffect, useRef, useState } from "react";
import {
  BALL_R, MIN_ANGLE, MAX_ANGLE, STEP_MS, clamp, describeShot, isHit, previewDots, simulate,
  type Flight, type Shot, type Target,
} from "./rules";

interface Pt { x: number; y: number }

/*
 * The picture is 100 wide and BOTH axes use the same scale.
 *
 * An early version squashed the vertical so a steep lob would fit, which meant
 * the arc on screen was not the arc the ball flew — you could not learn
 * anything from watching it. Nothing is squashed here. Firing from the middle
 * of the field is what makes that affordable: a shot only has to cross half
 * the width, so the arc it needs is half as tall.
 *
 * The launcher is the ball. There was a little machine drawn here, and it was
 * telling you nothing the ball and its path do not already say.
 */
const W = 100, H = 74;
const GROUND = 37;
const CX = W / 2;
/** One world unit of distance is this many svg units, horizontally AND up. */
const SCALE = 46;
/** A full-power pull, in svg units. Tolerance scales directly with this, and
    the pull costs nothing to make longer because it starts wherever the finger
    lands — so it is as long as the panel is wide. */
const MAX_PULL = 64;
const sx = (x: number) => CX + x * SCALE;
const sy = (y: number) => GROUND - y * SCALE;
const BALL = BALL_R * SCALE;

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
  /**
   * Where the finger went down, and where it is now — because the pull is
   * measured from WHERE YOU STARTED, not from the launcher.
   *
   * It used to be measured from the launcher, which sat near the left edge.
   * That left no room behind it: to pull at full power you had to drag your
   * thumb off the side of the phone, so most of the power range was physically
   * unreachable and every shot came out weak. The gesture is a vector, not a
   * position — start anywhere, pull any way, and the full travel is there.
   */
  const [drag, setDrag] = useState<{ from: Pt; to: Pt } | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState<Shot | null>(null);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (shot) launch(shot, false);
    // Cancel any in-flight animation on unmount or when a new shot arrives. The
    // loop used to keep running after the component was gone (TurnPanel remounts
    // this per target via `key`), firing setState -- and onFire -- into nothing.
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    /* eslint-disable-next-line */
  }, [shot]);

  function launch(s: Shot, report: boolean) {
    const f = simulate(s, target);
    setDrag(null); setDone(null); setFlight(f); setFrame(0);
    const start = performance.now(), last = f.samples.length - 1;
    const step = (now: number) => {
      const i = Math.min(last, Math.floor((now - start) / STEP_MS));
      setFrame(i);
      if (i < last) rafRef.current = requestAnimationFrame(step);
      else { rafRef.current = null; setDone(s); if (report) onFire?.(isHit(s, target), s); }
    };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }

  function at(e: React.PointerEvent): Pt {
    const box = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * W,
      y: ((e.clientY - box.top) / box.height) * H,
    };
  }

  /**
   * Drag back, fire forward — a slingshot needs no explaining. Pull left to
   * fire right, and the other way for a pot on the other side.
   *
   * Range goes as power², so a raw pull spends its first half on a quarter of
   * the field: √ on the way in makes pull → distance linear, and a pixel worth
   * the same everywhere. It is a controller curve, not a change to the flight.
   */
  const shotFromDrag = (d: { from: Pt; to: Pt }): Shot => {
    const dx = d.from.x - d.to.x, dy = d.to.y - d.from.y;
    const f = clamp(Math.hypot(dx, dy) / MAX_PULL, 0, 1);
    return {
      angle: dy <= 0 ? MIN_ANGLE : clamp(Math.atan2(dy, Math.abs(dx)), MIN_ANGLE, MAX_ANGLE),
      power: Math.sqrt(f),
      dir: dx >= 0 ? 1 : -1,
    };
  };
  const pullFraction = (d: { from: Pt; to: Pt }) =>
    clamp(Math.hypot(d.from.x - d.to.x, d.to.y - d.from.y) / MAX_PULL, 0, 1);

  const live = drag ? shotFromDrag(drag) : null;
  const busy = !!flight && !done;
  const canAim = !locked && !busy && !shot;
  const ball = flight ? flight.samples[Math.min(frame, flight.samples.length - 1)] : null;
  const dots = live ? previewDots(live) : [];

  const hw = (target.half + BALL_R) * SCALE;
  const depth = Math.min(9, hw * 1.3);
  const potX = sx(target.x), potY = sy(target.y);
  const sunk = target.y === 0;

  return (
    <div className="space-y-2">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        className={`w-full rounded-2xl border-[3px] border-ink bg-surface touch-none select-none
          ${canAim ? "cursor-grab" : ""}`}
        onPointerDown={(e) => {
          if (!canAim) return;
          const p0 = at(e);
          if (p0.y < GROUND) return;      // the upper half is look-only, by design
          // Captured on the svg, not on whichever shape was under the finger,
          // so the pull keeps tracking once the drag leaves the picture.
          svgRef.current?.setPointerCapture?.(e.pointerId);
          setDrag({ from: p0, to: p0 });
        }}
        onPointerMove={(e) => { if (drag) setDrag({ ...drag, to: at(e) }); }}
        onPointerUp={() => {
          if (!drag) return;
          const d = drag, s = shotFromDrag(d);
          setDrag(null);
          if (pullFraction(d) > 0.03) launch(s, true);
        }}
        // No onPointerLeave: a pull that wanders outside the box is still a
        // pull, and cancelling on leave meant a shot that never happened.
        onPointerCancel={() => setDrag(null)}>

        {/* the draw half, so it reads as somewhere to put your thumb */}
        <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="var(--color-paper)" />

        {/* The ground. A pot sunk in the floor is a HOLE — the line stops at
            its rim, because a ball that lands on the opening goes in. */}
        <path
          d={sunk
            ? `M 0 ${GROUND} H ${potX - hw} M ${potX + hw} ${GROUND} H ${W}`
            : `M 0 ${GROUND} H ${W}`}
          stroke="var(--color-ink)" strokeWidth="1.6" fill="none" />

        {/* the pot, behind the ball once the ball is in it */}
        {(!ball || !ball.inside) && <Pot />}

        {live && (
          <>
            {dots.map((p, i) => (
              <circle key={i} cx={sx(p.x)} cy={sy(p.y) - BALL}
                r={2 - (i / dots.length) * 1.05}
                fill="var(--color-picto)"
                opacity={0.85 - (i / dots.length) * 0.78} />
            ))}
            <line x1={drag!.from.x} y1={drag!.from.y} x2={drag!.to.x} y2={drag!.to.y}
              stroke="var(--color-hot)" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.85" />
            <circle cx={drag!.from.x} cy={drag!.from.y} r="1.4" fill="var(--color-ink)" />
            {/* the power reading, at the finger's anchor rather than in a corner */}
            <circle cx={drag!.from.x} cy={drag!.from.y} r="5"
              fill="none" stroke="var(--color-acid)" strokeWidth="1.6"
              strokeDasharray={`${pullFraction(drag!) * 31.4} 31.4`}
              transform={`rotate(-90 ${drag!.from.x} ${drag!.from.y})`} />
            <circle cx={drag!.to.x} cy={drag!.to.y} r="3.4"
              fill="var(--color-hot)" stroke="var(--color-ink)" strokeWidth="1" />
          </>
        )}

        <Ball p={ball ?? { x: 0, y: 0 }} />
        {ball?.inside && <Pot />}
      </svg>

      <p className="text-center text-[13px] font-bold text-soft min-h-[20px]">
        {note ??
          (done ? describeShot(done, target)
            : busy ? "…"
            : canAim ? "Pull back anywhere below the line"
            : "Waiting for their shot")}
      </p>
    </div>
  );

  function Pot() {
    return (
      <g>
        {!sunk && (
          <line x1={potX} y1={potY + depth} x2={potX} y2={GROUND}
            stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" />
        )}
        <path d={`M ${potX - hw} ${potY} L ${potX - hw * 0.8} ${potY + depth}
                  L ${potX + hw * 0.8} ${potY + depth} L ${potX + hw} ${potY} Z`}
          fill={sunk ? "var(--color-trivia)" : "var(--color-hot)"}
          stroke="var(--color-ink)" strokeWidth="1.4" strokeLinejoin="round" />
        <line x1={potX - hw} y1={potY} x2={potX + hw} y2={potY}
          stroke="var(--color-acid)" strokeWidth="1.2" strokeLinecap="round" />
        {/* the lips, which are the whole story: clip the near one and it tips
            in, clip the far one and it rims out */}
        <circle cx={potX - hw} cy={potY} r="1.5" fill="var(--color-ink)" />
        <circle cx={potX + hw} cy={potY} r="1.5" fill="var(--color-ink)" />
      </g>
    );
  }

  function Ball({ p }: { p: { x: number; y: number } }) {
    return (
      <g>
        <circle cx={sx(p.x)} cy={sy(p.y) - BALL} r={BALL}
          fill="var(--color-pop)" stroke="var(--color-ink)" strokeWidth="1.4" />
        <circle cx={sx(p.x) - BALL * 0.3} cy={sy(p.y) - BALL * 1.32} r={BALL * 0.28}
          fill="var(--color-surface)" opacity="0.85" />
      </g>
    );
  }
}
