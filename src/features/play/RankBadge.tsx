import { motion, useReducedMotion } from "framer-motion";
import badges from "@/shared/data/rank-badges.json";
import type { BadgeKey } from "./rank";

/**
 * The badges have different widths but a common height of 80, so everything is
 * sized by height — otherwise a narrow Novice and a wide Legend would sit at
 * wildly different visual weights in the same row.
 */
export function RankBadge({
  rank, size = 64, locked = false, animate = false, className = "",
}: { rank: BadgeKey; size?: number; locked?: boolean; animate?: boolean; className?: string }) {
  const still = useReducedMotion() || !animate;
  const b = badges[rank];
  const [, , w, h] = b.viewBox.split(" ").map(Number);

  const svg = (
    <svg
      viewBox={b.viewBox}
      height={size}
      width={(w / h) * size}
      role="img"
      aria-label={`${rank} badge`}
      className={locked ? "grayscale opacity-25" : ""}
      dangerouslySetInnerHTML={{ __html: b.paths }}
    />
  );

  if (still) return <span className={className}>{svg}</span>;

  return (
    <motion.span
      className={className}
      initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14 }}
    >
      {svg}
    </motion.span>
  );
}
