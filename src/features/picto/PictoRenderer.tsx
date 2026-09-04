import { motion, useReducedMotion } from "framer-motion";
import type { RebusSpec } from "@/shared/types/db";

const FONTS: Record<string, string> = {
  sans: "Nunito, system-ui, sans-serif",
  serif: "Fredoka, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

/**
 * Draws a rebus from data on a 100x100 viewBox, so one spec renders identically
 * at 90px in a list and at 600px on the play screen.
 *
 * When `animate` is on, the pieces fly into place one at a time — the puzzle
 * assembles in front of you instead of simply being there. That is the moment
 * the game earns its "toy" feel, so it is part of the renderer, not decoration
 * bolted on by the screen above it.
 */
export function PictoRenderer({
  spec, className = "", animate = false, seed = "",
}: { spec: RebusSpec; className?: string; animate?: boolean; seed?: string }) {
  const still = useReducedMotion() || !animate;

  return (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${className}`} role="img" aria-label="Rebus puzzle">
      {spec.items.map((it, i) => {
        const size = it.size ?? 14;
        const rotate = it.rotate ?? 0;
        // textLength cannot coexist with tspans, so a fixed width is ignored
        // on items carrying a superscript or subscript.
        const fixed = it.w && !it.sup && !it.sub ? it.w : undefined;
        const drift = (i % 2 === 0 ? -1 : 1) * (8 + (i % 3) * 5);

        const content = (
          <>
            {it.text}
            {it.sup && <tspan fontSize={size * 0.55} dy={-size * 0.42}>{it.sup}</tspan>}
            {it.sub && <tspan fontSize={size * 0.55} dy={size * 0.42}>{it.sub}</tspan>}
          </>
        );

        const common = {
          x: it.x, y: it.y,
          fontSize: size,
          fontFamily: FONTS[it.font ?? "sans"],
          fontWeight: it.weight ?? 800,
          letterSpacing: it.spacing ?? 0,
          fill: it.color ?? "currentColor",
          opacity: it.opacity ?? 1,
          textAnchor: "middle" as const,
          dominantBaseline: "central" as const,
          textLength: fixed,
          lengthAdjust: fixed ? ("spacingAndGlyphs" as const) : undefined,
          textDecoration: it.strike ? "line-through" : undefined,
          style: { userSelect: "none" as const },
        };

        if (still) {
          return (
            <text key={i} {...common}
              transform={rotate ? `rotate(${rotate} ${it.x} ${it.y})` : undefined}>
              {content}
            </text>
          );
        }

        return (
          <motion.text
            key={`${seed}-${i}`}
            {...common}
            initial={{ opacity: 0, scale: 0.4, x: drift, y: -14, rotate: rotate - 25 }}
            animate={{ opacity: it.opacity ?? 1, scale: 1, x: 0, y: 0, rotate }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.08 + i * 0.09 }}
            style={{ ...common.style, transformOrigin: `${it.x}px ${it.y}px`, transformBox: "fill-box" }}
          >
            {content}
          </motion.text>
        );
      })}
    </svg>
  );
}
