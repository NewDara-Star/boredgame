import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Sunflower } from "@/shared/brand/Sunflower";

/**
 * A screen's own code is on its way (F8). The nav stays put; only the page
 * area waits. Most waits are under 0.3 s and show nothing at all, so a normal
 * tap never flashes. Past that, drawing #1: one card in the middle, the flower
 * awake, the seeds filling in one by one instead of grey placeholder bars.
 */
export const SHOW_AFTER_MS = 300;

export function ScreenLoading() {
  const [show, setShow] = useState(false);
  const still = useReducedMotion();
  const [lit, setLit] = useState(4);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!show || still) return;
    const id = setInterval(() => setLit((n) => (n + 1) % 11), 250);
    return () => clearInterval(id);
  }, [show, still]);
  if (!show) return null;
  return (
    <div role="status" className="min-h-[60dvh] grid place-items-center">
      <div className="card shadow-lift-sm rounded-[20px] p-[22px] w-full grid gap-2 justify-items-center text-center text-ink">
        <Sunflower state="awake" stem={false} size={74} />
        <div className="flex items-center gap-[5px]" aria-hidden>
          {Array.from({ length: 10 }, (_, k) => (
            <i key={k} className="block w-[15px] h-[15px] rounded-full" style={k < lit ? {
              background: "radial-gradient(circle at 35% 30%, var(--color-petal-hi), var(--color-petal) 65%)",
              boxShadow: "0 0 0 2px var(--color-ink-day)",
            } : { background: "var(--color-mist)" }} />
          ))}
        </div>
        <b className="font-display font-normal text-[21px]">Loading…</b>
      </div>
    </div>
  );
}
