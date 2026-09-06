import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePush } from "./usePush";

const KEY = "bg_push_primed"; // per-device: "1" once they've dismissed the primer

const readDismissed = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
const markDismissed = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } };

/** iOS Safari's Share glyph, so the instruction points at the real button. */
function ShareGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className="inline-block align-[-3px]">
      <path d="M12 15V3m0 0L8 7m4-4 4 4" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * First-load primer for notifications. It is our OWN sheet, not the OS prompt:
 * the native permission dialog fires only when they tap Turn on, so a "Not now"
 * never spends the one-shot iOS permission. Shows at most until they act once
 * (enable -> subscribed, gone for good; dismiss -> gone on this device); the
 * Friends-panel card stays as the way back in.
 */
export function PushOnboarding() {
  const { ready, state, needsInstall, signedIn, enable, busy } = usePush();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage

  useEffect(() => { setDismissed(readDismissed()); }, []);

  const close = () => { markDismissed(); setDismissed(true); };

  // Don't cover an active game; only offer where there's nothing to interrupt.
  const onQuietScreen = pathname === "/" || pathname.startsWith("/rooms") || pathname === "/profile";

  const canOfferNow = state === "default" || state === "granted";
  const show =
    signedIn && ready && !dismissed && onQuietScreen && (canOfferNow || needsInstall);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button aria-label="Close" onClick={close}
        className="absolute inset-0 bg-ink/40" />
      <div className="relative w-full sm:max-w-md piece bg-paper p-5 m-0 sm:m-4
        rounded-t-3xl sm:rounded-3xl space-y-3">
        <p className="font-display text-[22px] font-semibold leading-tight">
          Never miss a game
        </p>
        <p className="text-[14px] text-ink/80 font-semibold">
          Turn on notifications and you'll get a ping the moment a friend invites
          you — even when BoredGame is closed.
        </p>

        {needsInstall ? (
          <div className="space-y-2">
            <p className="text-[13px] font-bold">On iPhone, add it to your home screen first:</p>
            <ol className="text-[13px] text-ink/80 font-semibold space-y-1 list-decimal ml-4">
              <li>Tap the Share button <ShareGlyph /> in Safari's toolbar.</li>
              <li>Choose <b>Add to Home Screen</b>.</li>
              <li>Open BoredGame from the new icon, then come back here to turn it on.</li>
            </ol>
            <button onClick={close}
              className="piece press w-full bg-ink text-paper px-4 py-3 font-display font-semibold mt-1">
              Got it
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={() => void enable()} disabled={busy}
              className="piece press w-full bg-hot text-paper px-4 py-3 font-display font-semibold">
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
            <button onClick={close}
              className="w-full py-2 text-[13px] font-black uppercase tracking-wider text-ink/50">
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
