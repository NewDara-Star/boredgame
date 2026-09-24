import { Art } from "@/shared/brand/Art";

/**
 * The logo: real Bagel Fat One outlines, the first o drawn as the sunflower
 * (BRAND.md, "Logo"). Two looks:
 *   "ink"  flat, for white grounds, the header and anything under 160px wide
 *   "gold" gold letters with a cut deep-gold side, for sky and colour grounds
 * Sized by height, like the badges.
 */
const RATIO = { ink: 3.99, gold: 4.0 } as const;

export function Wordmark({ height = 30, look = "ink", className = "" }:
  { height?: number; look?: "ink" | "gold"; className?: string }) {
  return <Art name={look === "gold" ? "wordmark-chunky" : "wordmark-ink"} label="BoredGame"
    className={className} style={{ width: height * RATIO[look] }} />;
}

/** A small sunflower head, where the old four-point star used to sit. */
export function Starburst({ size = 40, className = "" }: { size?: number; fill?: string; className?: string }) {
  return <Art name="sfh-awake" className={className} style={{ width: size }} />;
}
