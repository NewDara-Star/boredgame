import { Art } from "./Art";

/**
 * The mascot. One flower for the whole app, never a player. It shows what the game
 * is doing: bored when nothing is happening, awake when someone joins, turned toward
 * whoever's move it is (you are always on the left), in bloom for a win, asleep while
 * an invite waits. Spec: BRAND.md, "The sunflower".
 */
export type FlowerState = "bored" | "awake" | "look-left" | "look-right" | "bloom" | "sleep";

export function Sunflower({ state = "awake", stem = true, size = 120, className = "", label }:
  { state?: FlowerState; stem?: boolean; size?: number; className?: string; label?: string }) {
  return <Art name={`${stem ? "sf" : "sfh"}-${state}`} className={className} style={{ width: size }}
    label={label} />;
}

/** Whose move it is decides where the flower looks. */
export const lookFor = (mine: boolean): FlowerState => (mine ? "look-left" : "look-right");
