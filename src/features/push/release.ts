import { supabase } from "@/shared/lib/supabase";
import { withTimeout } from "@/shared/lib/timeout";

/**
 * Signing out hands this phone's notifications back: the server stops pinging
 * it for the person leaving, and the phone's subscription is dropped, so the
 * next person to sign in here is asked for themselves instead of seeing
 * "Notifications on" for someone else's pings (N1). Bounded, so sign-out never
 * waits on a slow network for it.
 */
export async function releasePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !supabase) return;
  await withTimeout((async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase!.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  })().catch(() => {}), 2500, () => {});
}
