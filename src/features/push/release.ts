import { SERVER } from "@/shared/lib/supabase";
import { withTimeout } from "@/shared/lib/timeout";

/**
 * Signing out hands this phone's notifications back: the server stops pinging
 * it for the person leaving, and the phone's subscription is dropped, so the
 * next person to sign in here is asked for themselves instead of seeing
 * "Notifications on" for someone else's pings (N1).
 *
 * Sign-out forgets the login first (F5), so this carries the leaving person's
 * token itself, and the server call goes out with keepalive: it finishes even
 * if the page moves on, and nothing waits for it. Only the local unsubscribe
 * is waited for, and that is bounded.
 */
export async function releasePush(token: string | null): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !SERVER.url) return;
  await withTimeout((async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    if (token) {
      void fetch(`${SERVER.url}/rest/v1/rpc/delete_push_subscription`, {
        method: "POST", keepalive: true,
        headers: { apikey: SERVER.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_endpoint: sub.endpoint }),
      }).catch(() => { /* offline: the server forgets it when the push bounces */ });
    }
    await sub.unsubscribe();
  })().catch(() => {}), 1500, () => {});
}
