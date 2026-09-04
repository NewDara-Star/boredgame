import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { readLocal } from "@/features/play/progress";
import { rankFor, RANKS } from "@/features/play/rank";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";

export function ProfilePage() {
  const { user, profile, offline, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Supabase reports failed magic links by redirecting back with the reason in
  // the URL fragment. Without reading it the page just renders the sign-in form
  // again, so a broken link looks identical to never having clicked one.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = hash.get("error_code");
    if (!code && !hash.get("error")) return;
    setAuthError(
      code === "otp_expired"
        ? "That sign-in link had already been used or expired. Mail providers sometimes open links to scan them, which spends the one-time code before you get there. Request a fresh one."
        : hash.get("error_description")?.replace(/\+/g, " ") ?? "Sign-in failed."
    );
    history.replaceState(null, "", window.location.pathname);
  }, []);

  const local = readLocal();
  const answered = profile?.total_answered ?? local.answered;
  const correct = profile?.total_correct ?? local.correct;
  const { current, next, progress } = rankFor(answered);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[10px] uppercase tracking-widest text-soft">Rank</p>
        <h1 className="text-3xl font-bold mt-1">{current.name}</h1>
        <div className="h-1.5 bg-surface rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-picto rounded-full" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="text-xs text-soft mt-2">
          {next ? `${next.min - answered} more answers to ${next.name}` : "Top rank"}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-px bg-surface border-[2.5px] border-ink rounded-2xl overflow-hidden">
        <div className="piece p-4"><b className="block text-2xl font-bold tabular-nums">{answered}</b>
          <span className="text-[10px] uppercase tracking-widest text-soft">Answered</span></div>
        <div className="piece p-4"><b className="block text-2xl font-bold tabular-nums">
          {answered ? Math.round((correct / answered) * 100) + "%" : "—"}</b>
          <span className="text-[10px] uppercase tracking-widest text-soft">Accuracy</span></div>
        <div className="piece p-4"><b className="block text-2xl font-bold tabular-nums">
          {Math.max(local.bestScore.picto ?? 0, local.bestScore.trivia ?? 0)}</b>
          <span className="text-[10px] uppercase tracking-widest text-soft">Best round</span></div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-soft mb-2">All ranks</p>
        <div className="flex flex-wrap gap-2">
          {RANKS.map((rk) => (
            <span key={rk.name}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                rk.name === current.name ? "bg-picto text-surface border-ink font-semibold" : "border-ink text-soft"}`}>
              {rk.name} · {rk.min}
            </span>
          ))}
        </div>
      </section>

      <section className="border-t border-ink pt-6">
        {authError && (
          <div className="piece bg-bad text-surface p-4 mb-4">
            <p className="font-display font-semibold">Sign-in didn't complete</p>
            <p className="text-sm mt-1 font-semibold">{authError}</p>
          </div>
        )}
        {offline ? (
          <p className="text-sm text-soft">
            Progress is saved in this browser only. Connect Supabase to sync across devices and unlock head-to-head.
          </p>
        ) : user ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-soft truncate">Signed in as {user.email}</p>
            <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
          </div>
        ) : sent ? (
          <p className="text-sm text-good">Check your email for the sign-in link.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await signIn(email);
              if (error) setError(error); else setSent(true);
            }}
          >
            <Field label="Sign in" hint="A one-time link, no password to remember" error={error}>
              <Input type="email" required value={email} placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full">Send me a link</Button>
          </form>
        )}
      </section>
    </div>
  );
}
