import { useEffect, useState } from "react";

/**
 * How much of the screen can actually be seen, in px: the visual viewport,
 * which shrinks when the phone's keyboard comes up (the layout height, and so
 * vh, doesn't on iPhone). Falls back to the window where there's no API.
 */
export function useSeenHeight(): number {
  const read = () => (typeof window === "undefined" ? 800 : window.visualViewport?.height ?? window.innerHeight);
  const [h, setH] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    const on = () => setH(read());
    vv?.addEventListener("resize", on);
    window.addEventListener("resize", on);
    return () => { vv?.removeEventListener("resize", on); window.removeEventListener("resize", on); };
  }, []);
  return h;
}
