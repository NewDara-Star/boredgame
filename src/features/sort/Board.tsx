import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Tube } from "./rules";

/**
 * The tubes, drawn. One SVG so the geometry is exact whatever the width, and
 * so the lifted balls can float above their tube without a layout hack.
 *
 * Balls are lit from top-left — a specular arc on the upper-left face, colour
 * falling off to the lower-right, a sliver of rim light on the shadow edge and
 * one soft cast shadow at the bottom of the tube. Six gradients, one light.
 *
 * It does not hint. No tube lights up to say "put it here": the board is the
 * board, the way a real set of tubes is, and where a ball can go is part of
 * what you are racing to see. The one thing it does say is NO — a full tube
 * that is tapped with a ball in hand shakes, because a silent refusal reads
 * as a broken tap.
 */

/** ball colours, by index. The app's own tokens where they exist, so a red ball
    is the same red as a wrong answer and a blue one the same as trivia. */
export const BALL: [string, string, string][] = [
  ["#FF8A96", "#E5233B", "#8E0D1E"],   // red
  ["#8FA4FF", "#2B4BFF", "#15258F"],   // blue
  ["#7FE0A6", "#10A04E", "#075A2A"],   // green
  ["#FFE98A", "#FFD028", "#B88A00"],   // yellow
  ["#C4A2FF", "#7B3FE4", "#41208A"],   // purple
  ["#FFB08C", "#FF5A1F", "#9E2E05"],   // orange
];

const TW = 40, GAP = 9, R = 14.5, SLOT = 31.5;
const LIFT = 44;                               // headroom for the lifted ball
const PAD_X = 8, PAD_BOTTOM = 10;

export function tubeGeometry(n: number, cap: number) {
  const tubeH = cap * SLOT + 12;
  const w = PAD_X * 2 + n * TW + (n - 1) * GAP;
  const h = LIFT + tubeH + PAD_BOTTOM;
  return { tubeH, w, h, x: (i: number) => PAD_X + i * (TW + GAP), top: LIFT };
}

export function Board({
  tubes, cap, selected, refused, onPick, size = "full", disabled = false,
}: {
  tubes: Tube[];
  cap: number;
  /** the tube whose top ball is lifted, waiting for a destination */
  selected?: number | null;
  /** the tube that just refused a ball, and when — a new stamp shakes it */
  refused?: { tube: number; at: number } | null;
  onPick?: (i: number) => void;
  size?: "full" | "mini";
  disabled?: boolean;
}) {
  const g = tubeGeometry(tubes.length, cap);
  const interactive = !!onPick && !disabled;

  // the lifted ball, so it can be drawn floating
  const liftCount = (i: number) => (selected === i && tubes[i].length > 0 ? 1 : 0);

  // The refusal shake, through the Web Animations API rather than a motion
  // prop: it must replay every time, including twice on the same tube, and a
  // keyframe prop that comes back equal does not.
  const groups = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    if (!refused) return;
    groups.current[refused.tube]?.animate(
      [-0, -4, 4, -3, 3, -1, 0].map((dx) => ({ transform: `translateX(${dx}px)` })),
      { duration: 320, easing: "ease-out" },
    );
  }, [refused?.at, refused?.tube]);

  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`}
      className={`w-full select-none ${size === "mini" ? "" : "touch-manipulation"}`}
      style={{ maxWidth: size === "mini" ? 220 : undefined }}
      aria-label="Ball sort tubes">
      <defs>
        {BALL.map(([hi, mid, lo], i) => (
          <radialGradient key={i} id={`ball-${size}-${i}`} cx="36%" cy="30%" r="72%">
            <stop offset="0" stopColor={hi} />
            <stop offset=".34" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </radialGradient>
        ))}
        <radialGradient id={`spec-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`glass-${size}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".8" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#000" stopOpacity=".10" />
        </linearGradient>
      </defs>

      {tubes.map((t, i) => {
        const x = g.x(i), lifted = liftCount(i);
        const full = t.length === cap && t.every((c) => c === t[0]);
        return (
          <g key={i} ref={(el) => { groups.current[i] = el; }}
            onPointerDown={interactive ? (e) => { e.preventDefault(); onPick!(i); } : undefined}
            style={{ cursor: interactive ? "pointer" : "default" }}>
            {/* a generous hit area, because the tube is narrow and the thumb is not */}
            <rect x={x - GAP / 2} y={0} width={TW + GAP} height={g.h} fill="transparent" />

            {/* the tube: a rounded-bottom glass */}
            <path d={`M ${x} ${g.top} V ${g.top + g.tubeH - TW / 2}
                      A ${TW / 2} ${TW / 2} 0 0 0 ${x + TW} ${g.top + g.tubeH - TW / 2}
                      V ${g.top} Z`}
              fill={full ? "rgba(16,160,78,.10)" : "rgba(20,16,13,.05)"}
              stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
            <path d={`M ${x} ${g.top} V ${g.top + g.tubeH - TW / 2}
                      A ${TW / 2} ${TW / 2} 0 0 0 ${x + TW} ${g.top + g.tubeH - TW / 2}
                      V ${g.top} Z`}
              fill={`url(#glass-${size})`} pointerEvents="none" />
            {/* the rim */}
            <ellipse cx={x + TW / 2} cy={g.top} rx={TW / 2} ry="3.2"
              fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2" />

            {/* balls, bottom first */}
            {t.map((c, k) => {
              const inLift = k >= t.length - lifted;
              const restY = g.top + g.tubeH - PAD_BOTTOM - R - k * SLOT + 3;
              const y = inLift ? g.top - R - 6 - (t.length - 1 - k) * (R * 2 + 2) : restY;
              return (
                <motion.g key={`${i}-${k}`}
                  initial={false}
                  animate={{ y: y - restY }}
                  transition={{ type: "spring", stiffness: 520, damping: 30 }}
                  style={{ pointerEvents: "none" }}>
                  {k === 0 && !inLift && (
                    <ellipse cx={x + TW / 2 + 1.5} cy={restY + R - 1} rx={R * 0.85} ry="3.5"
                      fill="#000" opacity=".22" />
                  )}
                  <circle cx={x + TW / 2} cy={restY} r={R} fill={`url(#ball-${size}-${c % BALL.length})`} />
                  <path d={`M ${x + TW / 2 - R * 0.86} ${restY + R * 0.42}
                            A ${R} ${R} 0 0 0 ${x + TW / 2 + R * 0.45} ${restY + R * 0.88}`}
                    fill="none" stroke={BALL[c % BALL.length][0]} strokeWidth="1.6"
                    strokeLinecap="round" opacity=".5" />
                  <ellipse cx={x + TW / 2 - R * 0.34} cy={restY - R * 0.42}
                    rx={R * 0.30} ry={R * 0.19} transform={`rotate(-32 ${x + TW / 2 - R * 0.34} ${restY - R * 0.42})`}
                    fill={`url(#spec-${size})`} />
                </motion.g>
              );
            })}

            {full && size === "full" && (
              <text x={x + TW / 2} y={g.top + g.tubeH + 9} textAnchor="middle"
                fontSize="9" fontWeight="800" fill="var(--color-good)" letterSpacing=".08em">
                DONE
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
