import { usePush } from "./usePush";

/** A small "get pinged when a friend invites you" control. Renders only when it
    can lead somewhere: signed in, and either able to subscribe now or (on iOS)
    one home-screen install away from it. */
export function NotificationsCard() {
  const { state, busy, enable, disable, needsInstall, signedIn, error } = usePush();
  if (!signedIn) return null;

  if (state === "subscribed") {
    return (
      <div className="card bg-board p-3 flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[13px] font-bold">
          Notifications on — you'll get pinged when a friend invites you.
        </span>
        <button onClick={() => void disable()} disabled={busy}
          className="text-[12px] font-black text-ink/50 px-2 py-2 shrink-0">
          Turn off
        </button>
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div className="card bg-petal p-3 space-y-1">
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
      <div className="space-y-1.5">
      {error && <p className="text-[12px] text-ember font-bold px-1">{error}</p>}
      <button onClick={() => void enable()} disabled={busy}
        className="cut tap w-full cut-leaf-hi px-4 py-3 text-left flex items-center justify-between">
        <span className="min-w-0 font-bold text-[13px]">
          {busy ? "Turning on…" : "Get pinged when a friend invites you"}
        </span>
        <span className="text-[12px] font-black shrink-0 ml-2">Turn on</span>
      </button>
      </div>
    );
  }

  return null; // unsupported, non-iOS: nothing useful to offer
}

/**
 * The Notifications row on You (#47): a plain .li like Name and Password,
 * saying what it's set to, with the one thing you can do about it at the end.
 */
export function NotificationsRow() {
  const { state, busy, enable, disable, needsInstall, signedIn, error } = usePush();
  if (!signedIn) return null;
  const on = state === "subscribed";
  const line = on ? "On: invites and your turn"
    : needsInstall ? "On iPhone, add BoredGame to your Home Screen first (Share, then Add to Home Screen)"
    : state === "denied" ? "Blocked. Turn them back on in your browser settings"
    : state === "default" || state === "granted" ? "Off. Get a ping for invites and your turn"
    : "This browser can't do them";
  const act = on ? { label: "Turn off", go: disable } : state === "default" || state === "granted" ? { label: "Turn on", go: enable } : null;
  return (
    <div className="card shadow-lift-sm rounded-[16px] px-3 py-[9px] flex items-center gap-2.5 text-ink">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-[1.2]">Notifications</b>
        <small className="block text-[12px] font-semibold text-soft">{busy ? "One moment…" : line}</small>
        {error && <small className="block text-[12px] font-bold text-ember-lo">{error}</small>}
      </span>
      {act && (
        <button onClick={() => void act.go()} disabled={busy}
          className="shrink-0 min-h-[44px] -my-2 text-[13px] font-extrabold text-soft underline underline-offset-4">{act.label}</button>
      )}
    </div>
  );
}
