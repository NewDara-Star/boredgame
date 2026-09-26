import { useEffect, useSyncExternalStore } from "react";

/**
 * A round in play gets the whole phone (#16): the header and the tab bar step
 * aside while a screen asks for it, and come back the moment it stops. A count,
 * not a flag, so two screens asking at once can't switch it off for each other.
 */
let asking = 0;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

export function useFocusMode(on: boolean) {
  useEffect(() => {
    if (!on) return;
    asking++; tell();
    return () => { asking--; tell(); };
  }, [on]);
}

export function useFocused(): boolean {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    () => asking > 0,
    () => false,
  );
}
