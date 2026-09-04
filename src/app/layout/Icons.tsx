/** Hand-drawn-ish geometry at a single stroke weight, so the bar reads as one set. */
const s = {
  fill: "none", stroke: "currentColor", strokeWidth: 2.2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

const wrap = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...s}>{children}</svg>
);

export const IconHome = () => wrap(<><path d="M3.5 10.8 12 3.6l8.5 7.2" /><path d="M5.6 12.4v7.2h12.8v-7.2" /><path d="M9.9 19.6v-4.4h4.2v4.4" /></>);
export const IconPicto = () => wrap(<><rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2" /><rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2" /><rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2" /><path d="M17 13.8v6.4M13.8 17h6.4" /></>);
export const IconTrivia = () => wrap(<path d="M12 3.6l2.6 5.5 5.9.8-4.3 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.5 9.9l5.9-.8z" />);
export const IconRooms = () => wrap(<><circle cx="9" cy="8.4" r="3.2" /><circle cx="16.6" cy="9.6" r="2.4" /><path d="M3.6 19.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5" /><path d="M16.4 14.6c2.4.2 4 2.1 4 4.8" /></>);
export const IconBoard = () => wrap(<><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3" /><path d="M9.3 3.6v16.8M14.7 3.6v16.8M3.6 9.3h16.8M3.6 14.7h16.8" /></>);
export const IconPlay = () => wrap(<><circle cx="12" cy="12" r="8.6" /><path d="M10.2 8.6 L16 12 L10.2 15.4 Z" /></>);
export const IconRanks = () => wrap(<><path d="M5 20.4V13" /><path d="M12 20.4V6.2" /><path d="M19 20.4v-5.6" /><path d="M3.2 20.4h17.6" /></>);

/** Solid, because a 13px outline flame turns to mush. */
export const IconFlame = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden
    fill="currentColor" stroke="none">
    <path d="M12 21.4c3.4 0 6.2-2.5 6.2-5.9 0-4.4-4.4-6.1-4.4-9.8 0 0-2.1 1.5-2.1 4.3 0 1.4-.8 2.1-1.7 2.1-.9 0-1.5-.7-1.6-1.7-1.4 1.7-2.6 3.1-2.6 5.3 0 3.3 2.8 5.7 6.2 5.7Z" />
  </svg>
);
