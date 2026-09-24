/**
 * Why an email sign-in link failed (F14, P2).
 *
 * Supabase sends a failed link back to the site with the reason in the address
 * (#error_code=otp_expired…). Links land on the home page, but only the You
 * screen looked for the reason, so it was thrown away and the person arrived on
 * Home as if nothing had happened. This reads it once, the moment the app
 * starts (before anything else can clear the address), and keeps it for the You
 * screen, which the app now opens with the reason on it.
 */
let pending: string | null = null;

function sentenceFor(code: string | null): string {
  if (code === "otp_expired") {
    return "That sign-in link had already been used or had expired. Mail apps sometimes open links to check them, which uses the link up before you get there. Ask for a fresh one.";
  }
  return "That sign-in link didn't work. Ask for a fresh one.";
}

if (typeof window !== "undefined") {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get("error_code") ?? query.get("error_code");
  if (code || hash.get("error") || query.get("error")) {
    pending = sentenceFor(code);
    history.replaceState(null, "", window.location.pathname);
  }
}

/** True while a failed link's reason is waiting to be shown. */
export const hasLinkError = () => pending !== null;

/** The reason, once: whoever takes it shows it. */
export function takeLinkError(): string | null {
  const s = pending;
  pending = null;
  return s;
}
