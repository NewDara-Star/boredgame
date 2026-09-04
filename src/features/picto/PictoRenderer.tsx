import type { RebusSpec } from "@/shared/types/db";

const FONTS: Record<string, string> = {
  sans: 'Archivo, system-ui, sans-serif',
  serif: 'Fraunces, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

/**
 * Draws a rebus from data. SVG with a 100x100 viewBox, so one spec renders
 * identically at 120px in a list and at 600px on the play screen — no font-size
 * maths, no raster assets, no upload step.
 */
export function PictoRenderer({ spec, className = "" }: { spec: RebusSpec; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-full h-full ${className}`}
      role="img"
      aria-label="Rebus puzzle"
    >
      {spec.items.map((it, i) => {
        const size = it.size ?? 14;
        const rotate = it.rotate ?? 0;
        // textLength cannot coexist with tspans, so a fixed width is ignored
        // on items that carry a superscript or subscript.
        const fixed = it.w && !it.sup && !it.sub ? it.w : undefined;
        return (
          <text
            key={i}
            x={it.x}
            y={it.y}
            fontSize={size}
            fontFamily={FONTS[it.font ?? "sans"]}
            fontWeight={it.weight ?? 700}
            letterSpacing={it.spacing ?? 0}
            fill={it.color ?? "currentColor"}
            opacity={it.opacity ?? 1}
            textAnchor="middle"
            dominantBaseline="central"
            transform={rotate ? `rotate(${rotate} ${it.x} ${it.y})` : undefined}
            textLength={fixed}
            lengthAdjust={fixed ? "spacingAndGlyphs" : undefined}
            textDecoration={it.strike ? "line-through" : undefined}
            style={{ userSelect: "none" }}
          >
            {it.text}
            {it.sup && (
              <tspan fontSize={size * 0.55} dy={-size * 0.42}>
                {it.sup}
              </tspan>
            )}
            {it.sub && (
              <tspan fontSize={size * 0.55} dy={size * 0.42}>
                {it.sub}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}
