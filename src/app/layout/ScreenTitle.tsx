import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { StreakPill } from "@/features/play/RoundChrome";
import { Wordmark } from "@/shared/ui/Wordmark";

/**
 * A tab screen's own top (.tb, .ttl): the title in the display face at 29px on
 * the sky, and the streak pill at the other end. There is no app bar on a phone
 * (Daramola 26 Sep); this row is where a screen says what it is.
 */
export function ScreenTitle({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5 min-h-10">
      <h1 className="font-display font-normal text-[29px] leading-none min-w-0">{children}</h1>
      {end ?? <StreakPill />}
    </div>
  );
}

/** Home's top (#8–#11): the wordmark at 24px where a title would be. Ink on
    a day sky, gold on the night one (index.css swaps them). */
export function HomeTitle({ end }: { end?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5 min-h-10">
      <h1 className="m-0 leading-none">
        <Wordmark height={24} className="wm-day" />
        <Wordmark height={24} look="gold" className="wm-night" />
      </h1>
      {end ?? <StreakPill />}
    </div>
  );
}

/** The drawing's .pill.txt: a white pill with words, 700 13px. */
export function TextPill({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="grid place-items-center min-h-[44px] -my-1">
      <span className="chip bg-board text-ink rounded-full px-[11px] py-[5px] text-[13px] font-bold">{children}</span>
    </Link>
  );
}

/** The drawing's .x with a back chevron: a 38px white disc, 44px to tap (#48, #49). */
export function BackDisc({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} className="shrink-0 grid place-items-center w-11 h-11 -m-[3px]">
      <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-board shadow-lift-sm">
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
          <path d="M10 2L4 8l6 6" fill="none" stroke="var(--color-ink-day)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

/** A screen one level down (#49): back, the title centred at 22px, and room
    on the right the size of the back disc so the title stays in the middle. */
export function SubTitle({ back, backLabel, children }: { back: string; backLabel: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5 min-h-10">
      <BackDisc to={back} label={backLabel} />
      <h1 className="font-display font-normal text-[22px] leading-none text-center min-w-0 truncate">{children}</h1>
      <span className="w-[38px] shrink-0" />
    </div>
  );
}
