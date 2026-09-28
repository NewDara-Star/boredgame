import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sunflower } from "@/shared/brand/Sunflower";

/** Whether the phone has a connection, kept current as it comes and goes. */
export function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
}

/**
 * #4, no signal (Daramola 28 Sep): a screen that needs the internet (Rooms,
 * Today's round, the leaderboard) shows the drawing's card in its place: the
 * flower asleep, what still works, and Play solo. Solo games carry on as
 * normal. When the signal comes back, the screen comes back and loads itself.
 */
export function NeedsSignal({ children }: { children: ReactNode }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <div className="min-h-[calc(100dvh-var(--chrome))] flex flex-col gap-[11px]" role="status">
      <div className="flex-1" />
      <div className="card shadow-lift-sm rounded-[20px] p-5 grid gap-2 justify-items-center text-center text-ink">
        <Sunflower state="sleep" size={120} />
        <h1 className="font-display text-[22px] leading-[1.1]">No signal</h1>
        <p className="text-[14px] font-semibold text-soft">Rooms, the daily and ranks need the internet. Solo games still work.</p>
        <Link to="/play" className="cut tap cut-petal w-full min-h-[52px] grid place-items-center font-display text-[19px]">Play solo</Link>
      </div>
      <div className="flex-1" />
    </div>
  );
}
