import type { ReactNode } from "react";

/**
 * A row you swipe. The negative margin plus matching padding is the whole trick:
 * it lets cards run off the edge of the screen instead of stopping at the page
 * gutter, which is what makes it read as "there is more over there" rather than
 * as a clipped grid.
 */
export function Carousel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`no-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory
      -mx-4 px-4 pb-1 items-stretch ${className}`}>
      {children}
    </div>
  );
}
