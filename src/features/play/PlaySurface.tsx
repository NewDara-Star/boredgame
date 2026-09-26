import { useEffect, useRef, useState, type ReactNode } from "react";
import { SEAT_CSS } from "@/shared/brand/seats";
import { PieceMark, type PieceKind } from "@/shared/brand/Pieces";
import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import type { Mark } from "@/features/rooms/useBoardRoom";
import { Sunflower, type FlowerState } from "@/shared/brand/Sunflower";
import { SEAT_RAMP } from "@/shared/brand/seats";
import { GAMES } from "./registry";

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
export function PlaySurface({ children, focus = false }: { children: ReactNode;
  /** the screen has the whole phone (no header or tab bar), so it is taller */
  focus?: boolean }) {
  return <div className={`play-surface ${focus ? "play-focus" : ""}`}>{children}</div>;
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
export function PlayBoard({ ratio = 1, min = 0, children, top = false, reserve = 0 }: {
  /** the board's width divided by its height */
  ratio?: number;
  /** sit at the top of its space, as the drawings' boards do (#25–#29),
      rather than in the middle of it */
  top?: boolean;
  /** px under the board kept for what follows it in the same box (the seats) */
  reserve?: number;
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
        ? Math.floor(Math.min(r.width, Math.max(0, r.height - reserve) * ratio))
        : Math.floor(r.width);
      setWidth(w < min ? 0 : w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, min, reserve]);
  return (
    <div ref={box} className={`play-board flex-1 min-h-0 grid overflow-hidden ${top ? "content-start justify-items-center gap-[11px]" : "place-items-center"}`}>
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
  seats: { mark: Mark; name: string; glyph: PieceKind; score: number; active: boolean }[];
}) {
  return (
    <PlayRow className="flex items-center gap-2">
      <h1 className="font-display text-[15px] leading-none font-semibold truncate
        text-soft">
        {title}
      </h1>
      <div className="flex-1" />
      {seats.map((s) => (
        <motion.div key={s.mark}
          animate={{ scale: s.active ? 1 : 0.94, opacity: s.active ? 1 : 0.55 }}
          transition={SPRING}
          className={`card flex items-center gap-1.5 px-2.5 py-1.5 ${s.active ? "bg-petal" : "bg-board"}`}>
          <PieceMark kind={s.glyph} colour={SEAT_CSS[s.mark]} size={18} />
          <span className="text-[12px] font-black truncate max-w-[72px]">{s.name}</span>
          <span className="font-display text-base font-semibold tabular-nums leading-none">{s.score}</span>
        </motion.div>
      ))}
    </PlayRow>
  );
}


/* ----------------------------------------------------------------------------
 * The board screens' own pieces (#25–#30), from the drawings' code: .tb with
 * the game's chip, .turn (the banner that says whose move it is), .seats.
 * ------------------------------------------------------------------------- */

const CHIP: Record<string, string> = {
  quiz: "bg-sky-hi text-ink", board: "bg-leaf-hi text-ink", puzzle: "bg-grape text-board",
  skill: "bg-ember-hi text-ink", party: "bg-gum-hi text-ink",
};

/** .chip.leaf / .ember / .grape: the game's name in its family's colour. */
export function GameChip({ title, label }: { title: string;
  /** what it says, when that's more than the name: "Connect 4 · Mix" */
  label?: string }) {
  const fam = GAMES.find((g) => g.name === title)?.family ?? "board";
  return <span className={`chip rounded-full px-[9px] py-0.5 text-[12px] font-extrabold whitespace-nowrap ${CHIP[fam]}`}>{label ?? title}</span>;
}

/**
 * .turn: whose move it is, in words, with the flower looking at the board.
 * Gold when it's yours to do something, white when you're waiting.
 */
export function TurnBanner({ title, sub, tone, flower = "awake", end }: {
  title: string; sub?: string; tone: "petal" | "white";
  flower?: FlowerState;
  /** something at the right-hand end: the score on a result */
  end?: ReactNode;
}) {
  return (
    <motion.div layout transition={SPRING} role="status"
      // .card, so the night sky's white ink doesn't reach it: ink on gold or white.
      className={`card shrink-0 flex items-center gap-2.5 rounded-[20px] pl-2 pr-3.5 py-2 shadow-lift-sm text-ink
        ${tone === "petal" ? "bg-linear-to-b from-petal-hi to-petal" : "bg-board"}`}>
      <Sunflower state={flower} stem={false} size={48} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <b className="block font-display font-normal text-[22px] leading-[1.05]">{title}</b>
        {sub && <span className="block text-[14px] font-bold">{sub}</span>}
      </div>
      {end}
    </motion.div>
  );
}

/** .av in a seat's colour: a disc with the first letter, lit from the top left. */
function SeatDisc({ mark, name }: { mark: Mark; name: string }) {
  const r = SEAT_RAMP[mark];
  return (
    <span aria-hidden className="shrink-0 grid place-items-center w-[34px] h-[34px] rounded-full font-display text-[15px] text-ink"
      style={{ background: `radial-gradient(circle at 35% 30%, ${r.hi}, ${r.base} 60%)`,
               border: "2.5px solid var(--color-ink-day)", boxShadow: "0 3px 0 var(--color-ink-day)" }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** .seats: two cards, you and them, with what you're counting; the one whose
    turn it is ringed in gold (.seat.turnon). */
export function Seats({ seats }: {
  seats: { mark: Mark; name: string; initial: string; count: string; active: boolean }[];
}) {
  return (
    <div className="shrink-0 grid grid-cols-2 gap-[9px]">
      {seats.map((s) => (
        <div key={s.mark}
          className={`card flex items-center gap-2 bg-board text-ink rounded-2xl px-2.5 py-2
            ${s.active ? "shadow-[0_0_0_3px_var(--color-petal),var(--shadow-lift-sm)]" : "shadow-lift-sm"}`}>
          <SeatDisc mark={s.mark} name={s.initial} />
          <div className="min-w-0">
            <b className="block text-[15px] leading-[1.1] font-bold truncate">{s.name}</b>
            <small className="block font-mono text-[13px] font-bold text-soft">{s.count}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
