import { RAMPS } from "./tokens";

/** The two seats' colours everywhere: seat x is petal, seat o is sky (BRAND.md: petal is
    you, sky is the other side; in solo games you are always x). */
export type Seat = "x" | "o";
export const SEAT_HUE = { x: "petal", o: "sky" } as const;
export const SEAT_CSS: Record<Seat, string> = { x: "var(--color-petal)", o: "var(--color-sky)" };
export const SEAT_RAMP = { x: RAMPS.petal, o: RAMPS.sky } as const;
