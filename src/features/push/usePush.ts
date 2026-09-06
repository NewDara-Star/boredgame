import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";

// Public by design -- it is handed to the push service to identify this app
// server. The matching private key lives only in the DB (app_secrets), read by
// the edge sender. Regenerating the pair invalidates every existing subscription.
export const VAPID_PUBLIC_KEY =
  "BOap2ZXqn9x-UOf6-5kY3GNqV9EtS23FcirEmivV3L4_NRFakKvhV08D7ScJ4mIIXmPouIZbcAqPzBcqsLlEGo0";

const urlB64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export type PushState =
  | "unsupported" // this browser/tab cannot receive push (iOS Safari tab, old browser)
  | "default"     // supported, not yet asked
  | "denied"      // the user blocked it
  | "granted"     // permission held but this device has no live subscription
  | "subscribed"; // this device is subscribed and will receive push

const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export function usePush() {
  const { user } = useAuth();
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const [state, setState] = useState<PushState>(supported ? "default" : "unsupported");
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    if (!supported) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : Notification.permission === "granted" ? "granted" : "default");
    } catch { setState("default"); }
  }, [supported]);

  useEffect(() => { void sync(); }, [sync]);

  // Must be called from a user gesture -- Notification.requestPermission needs one.
  const enable = useCallback(async () => {
    if (!supported || !supabase || !user || busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "default"); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY),
        });
      }
      const j = sub.toJSON();
      await supabase.rpc("save_push_subscription", {
        p_endpoint: sub.endpoint,
        p_p256dh: j.keys?.p256dh ?? "",
        p_auth: j.keys?.auth ?? "",
      });
      setState("subscribed");
    } catch { await sync(); }
    finally { setBusy(false); }
  }, [supported, user, busy, sync]);

  const disable = useCallback(async () => {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("granted");
    } catch { await sync(); }
    finally { setBusy(false); }
  }, [busy, sync]);

  // iOS Safari only exposes Push inside an installed PWA; a plain tab needs
  // "Add to Home Screen" first. Surfaced so the UI can say so instead of a
  // bare "not supported".
  const needsInstall = !supported && isIOS() && !isStandalone();

  return { supported, state, busy, enable, disable, needsInstall, signedIn: !!user };
}
