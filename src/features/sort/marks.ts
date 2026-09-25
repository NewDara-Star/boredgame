/**
 * A mark on every ball, so no ball is told apart by colour alone (talk item
 * 15, Daramola). Red and green look the same to about 1 man in 12; blue and
 * purple come close too. Each colour keeps one shape everywhere it is drawn:
 * the board, the other player's mini board, the result card and the replay.
 *
 * Same order as BALL in Board.tsx. The shapes are picked so the pairs that
 * collapse under colour blindness (red/green, blue/purple, green/yellow) have
 * the least alike silhouettes: a solid dot against a plus, a bar against a
 * triangle.
 */
export const MARKS = ["dot", "bar", "plus", "diamond", "triangle", "ring"] as const;
export type MarkShape = (typeof MARKS)[number];

/** the words for the screen reader, same order */
export const MARK_WORD = ["dot", "bar", "plus", "diamond", "triangle", "ring"];

const f = (n: number) => Math.round(n * 100) / 100;

/** The mark for a ball colour, as an SVG path centred on (cx, cy), about 2s
    across. The SVG board draws it as-is; the canvas card through Path2D.
    Fill it with the "evenodd" rule (the ring has a hole). */
export function markPath(colour: number, cx: number, cy: number, s: number): string {
  const shape = MARKS[colour % MARKS.length];
  const circle = (r: number) =>
    `M ${f(cx - r)} ${f(cy)} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0 Z`;
  const poly = (pts: [number, number][]) =>
    "M " + pts.map(([x, y]) => `${f(cx + x * s)} ${f(cy + y * s)}`).join(" L ") + " Z";
  switch (shape) {
    case "dot": return circle(s * 0.62);
    case "bar": return poly([[-0.95, -0.34], [0.95, -0.34], [0.95, 0.34], [-0.95, 0.34]]);
    case "plus": {
      const a = 0.3, b = 0.92;
      return poly([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]]);
    }
    case "diamond": return poly([[0, -1], [0.78, 0], [0, 1], [-0.78, 0]]);
    case "triangle": return poly([[0, -0.9], [0.95, 0.72], [-0.95, 0.72]]);
    case "ring": return circle(s * 0.82) + " " + circle(s * 0.42);
  }
}
