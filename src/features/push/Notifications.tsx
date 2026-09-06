import { usePush } from "./usePush";

/** A small "get pinged when a friend invites you" control. Renders only when it
    can lead somewhere: signed in, and either able to subscribe now or (on iOS)
    one home-screen install away from it. */
export function NotificationsCard() {
  const { state, busy, enable, disable, needsInstall, signedIn } = usePush();
  if (!signedIn) return null;

  if (state === "subscribed") {
    return (
      <div className="piece bg-surface p-3 flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[13px] font-bold">
          Notifications on — you'll get pinged when a friend invites you.
        </span>
        <button onClick={() => void disable()} disabled={busy}
          className="text-[12px] font-black uppercase tracking-wider text-ink/50 px-2 py-2 shrink-0">
          Turn off
        </button>
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div className="piece bg-pop p-3 space-y-1">
        <p className="text-[13px] font-bold">Want a ping when a friend invites you?</p>
        <p className="text-[12px] text-ink/70 font-semibold">
          On iPhone, add BoredGame to your home screen first: tap Share, then
          "Add to Home Screen." Open it from there and the option appears.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-[12px] text-soft font-semibold px-1">
        Notifications are blocked for BoredGame — turn them back on in your browser
        settings to get invite pings.
      </p>
    );
  }

  if (state === "default" || state === "granted") {
    return (
      <button onClick={() => void enable()} disabled={busy}
        className="piece press w-full bg-acid px-4 py-3 text-left flex items-center justify-between">
        <span className="min-w-0 font-bold text-[13px]">
          {busy ? "Turning on…" : "Get pinged when a friend invites you"}
        </span>
        <span className="text-[12px] font-black uppercase tracking-wider shrink-0 ml-2">Turn on</span>
      </button>
    );
  }

  return null; // unsupported, non-iOS: nothing useful to offer
}
