import type { Transition, Variants } from "framer-motion";

/** One spring, used everywhere, so the whole app moves with the same weight. */
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 26, mass: 0.7 };
export const SOFT: Transition = { type: "spring", stiffness: 260, damping: 24 };

/** Parent that deals its children out one at a time. */
export const stagger = (each = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren: delay } },
});

/** Children rise into place rather than fading — fading alone reads as "loading". */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: SPRING },
};

/** A wrong answer should feel wrong in the body, not just look wrong. */
export const shake = {
  x: [0, -9, 8, -6, 4, 0],
  transition: { duration: 0.42 },
};
