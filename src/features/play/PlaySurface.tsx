import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import type { Mark } from "@/features/rooms/useBoardRoom";

/**
 * The shape every game screen has.
 *
 * A game is not a document: it is a board, the thing the game is asking you
 * to do, and one line saying whose turn it is. All three have to be on the
 * screen at once, and the screen is 534px tall on a phone in Safari. So a
 * play screen is a fixed-height column rather than a flow — `PlayBoard` takes
 * whatever is left after the fixed parts, and the board inside it scales to
 * fit rather than being sized by the width of the phone.
 *
 * Before this, the question panel was appended UNDER a board sized by width:
 * on a 664px screen Square Off put its answers 227px below the fold and
 * Connect 4 Trivia put all four of them 274px below it. The board was always
 * visible and the thing you had to tap never was.
 */
export function PlaySurface({ children }: { children: ReactNode }) {
  return <div className="play-surface">{children}</div>;
}

/**
 * The board's box: everything left over, with the board scaled to fit it.
 *
 * `min-h-0` is what allows a flex child to be smaller than its content —
 * without it the board keeps its natural height and pushes the question off
 * the bottom, which is the bug this file exists to fix.
 *
 * The width is measured rather than expressed in CSS. "Fit a box of known
 * aspect ratio inside another box" has no honest pure-CSS answer: aspect-ratio
 * with a fixed height ignores max-width, and with a fixed width it ignores
 * max-height, so one of the two always breaks and the cells stop being square.
 * One ResizeObserver and a `min()` is exact, and the board is drawn at a size
 * it was actually given.
 */
export function PlayBoard({ ratio = 1, min = 0, children }: {
  /** the board's width divided by its height */
  ratio?: number;
  /** below this the board is not worth drawing; children get 0 and can hide */
  min?: number;
  children: (width: number) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // A box with no height is not a small box, it is an unbounded one: this
      // is `flex-1` in a column whose height is auto, so it is sized by its
      // own content — which is nothing until a width is measured. Sizing by
      // width alone breaks that deadlock, and a board slightly too large is
      // in every way better than no board, which is what shipped.
      const w = r.height > 0
        ? Math.floor(Math.min(r.width, r.height * ratio))
        : Math.floor(r.width);
      setWidth(w < min ? 0 : w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, min]);
  return (
    <div ref={box} className="play-board flex-1 min-h-0 grid place-items-center overflow-hidden">
      {width > 0 && children(width)}
    </div>
  );
}

/** A fixed part of the screen: takes its natural height, never squeezed. */
export function PlayRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`shrink-0 ${className}`}>{children}</div>;
}

/**
 * The one line above the board: the game, and who is on. It replaced a 26px
 * h1 on its own row plus a second row of seat chips — 78px of a 534px screen
 * to say something the page had already said on the way in.
 */
export function PlayHead({ title, seats }: {
  title: string;
  seats: { mark: Mark; name: string; glyph: string; score: number; active: boolean }[];
}) {
  return (
    <PlayRow className="flex items-center gap-2">
      <h1 className="font-display text-[15px] leading-none font-semibold truncate
        text-soft uppercase tracking-wider">
        {title}
      </h1>
      <div className="flex-1" />
      {seats.map((s) => (
        <motion.div key={s.mark}
          animate={{ scale: s.active ? 1 : 0.94, opacity: s.active ? 1 : 0.55 }}
          transition={SPRING}
          className={`piece flex items-center gap-1.5 px-2.5 py-1.5 ${s.active ? "bg-pop" : "bg-surface"}`}>
          <span className="font-display text-base font-semibold leading-none"
            style={{ color: s.mark === "x" ? "var(--color-picto)" : "var(--color-trivia)" }}>
            {s.glyph}
          </span>
          <span className="text-[12px] font-black uppercase tracking-wide truncate max-w-[72px]">{s.name}</span>
          <span className="font-display text-base font-semibold tabular-nums leading-none">{s.score}</span>
        </motion.div>
      ))}
    </PlayRow>
  );
}
