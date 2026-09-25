import { useEffect, useState } from "react";
import { Sunflower } from "@/shared/brand/Sunflower";

/**
 * A screen's own code is on its way (F8). The header and nav stay put; only the
 * page area waits. Most waits are under 0.3 s and show nothing at all, so a
 * normal tap never flashes. Past that, the flower says it's coming.
 */
export const SHOW_AFTER_MS = 300;

export function ScreenLoading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="flex flex-col items-center gap-2 pt-16">
      <Sunflower state="awake" stem={false} size={64} />
      <p className="text-[13px] font-bold text-soft">Loading…</p>
    </div>
  );
}
