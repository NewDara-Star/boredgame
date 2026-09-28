import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Sunflower } from "@/shared/brand/Sunflower";

/** The address the last sign-in link went to, on this phone only, so a
    failed link can be sent again with one tap (#52). */
const KEY = "bg_link_email";
export const rememberLinkEmail = (email: string) => { try { localStorage.setItem(KEY, email.trim()); } catch { /* private mode */ } };
const linkEmail = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/**
 * #52, signing in, from the drawing's code: the two in-between states of an
 * email link. Both say what to do next. (Only the accounts made before names
 * sign in by email; for them a link is also the way back in without the
 * password.)
 */

/** Waiting on the link: the flower looking for it, and what to do. */
export function LinkSent({ email, onBack }: { email: string; onBack: () => void }) {
  const { signInWithLink } = useAuth();
  const [again, setAgain] = useState<"idle" | "busy" | "sent" | string>("idle");
  return (
    <div className="grid gap-[11px]">
      <div className="card shadow-lift-sm rounded-[20px] p-[18px] grid gap-2 justify-items-center text-center text-ink" role="status">
        <Sunflower state="look-left" size={84} />
        <h2 className="font-display text-[22px] leading-[1.1]">Check your email</h2>
        <p className="text-[14px] font-semibold text-soft">There's a sign-in link waiting. Open it on this phone.</p>
        <p className="text-[13px] font-bold break-all">{email}</p>
      </div>
      {again !== "idle" && again !== "busy" && again !== "sent" && <p className="text-[13px] font-bold text-ember-lo text-center" role="alert">{again}</p>}
      <div className="flex justify-center gap-5">
        <button disabled={again === "busy" || again === "sent"}
          onClick={async () => { setAgain("busy"); const { error } = await signInWithLink(email); setAgain(error ?? "sent"); }}
          className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
          {again === "busy" ? "Sending…" : again === "sent" ? "Sent again" : "Send it again"}
        </button>
        <button onClick={onBack} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">Use my password</button>
      </div>
    </div>
  );
}

/** A link that didn't work: why, in our words, and a new one in one tap
    (to the address this phone last sent one to). */
export function LinkFailed({ reason, onSent }: { reason: string; onSent: (email: string) => void }) {
  const { signInWithLink } = useAuth();
  const email = linkEmail();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-[11px]">
      <div className="card shadow-lift-sm rounded-[20px] bg-ember-hi px-3 py-2.5 grid gap-0.5 text-ink" role="alert">
        <b className="text-[15px]">That link didn't work</b>
        <small className="block text-[13px] font-semibold">{reason.replace(/\s*Ask for a fresh one\.$/, "")} {email ? "Send a new one, or sign in with your password." : "Sign in with your password below, or ask for a new link."}</small>
      </div>
      {email && (
        <button disabled={busy}
          onClick={async () => { setBusy(true); setError(null); const r = await signInWithLink(email); setBusy(false); if (r.error) setError(r.error); else onSent(email); }}
          className="cut tap cut-petal w-full min-h-[52px] font-display text-[19px]">
          {busy ? "Sending…" : "Send a new link"}
        </button>
      )}
      {error && <p className="text-[13px] font-bold text-ember-lo text-center" role="alert">{error}</p>}
    </div>
  );
}
