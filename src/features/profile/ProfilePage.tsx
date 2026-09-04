import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { readLocal } from "@/features/play/progress";
import { rankFor, RANKS } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";

export function ProfilePage() {
  const { user, profile, offline, signIn, signUp, signInWithLink, setPassword: savePassword, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [pwDone, setPassword2Done] = useState(false);
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
        <p className="text-[10px] font-black uppercase tracking-widest text-soft">Rank</p>
        <div className="flex items-center gap-5 mt-2">
          <RankBadge rank={current.key} size={88} animate />
          <div>
            <h1 className="font-display text-3xl font-semibold">{current.name}</h1>
            <p className="text-xs text-soft font-bold mt-0.5 tabular-nums">{answered} answered</p>
          </div>
        </div>
        <div className="h-1.5 bg-surface rounded-full mt-3 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: current.color }} />
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
        <div className="grid grid-cols-5 gap-x-1.5 gap-y-4">
          {RANKS.map((rk) => {
            const locked = answered < rk.min;
            return (
              <div key={rk.key} className="text-center">
                <div className="h-11 grid place-items-center"><RankBadge rank={rk.key} size={40} locked={locked} /></div>
                {/* No tracking and a hard break: "Accomplished" next to "Advanced"
                    collided at phone width with letter-spacing applied. */}
                <p className={`text-[7.5px] font-black uppercase mt-1.5 leading-[1.15] break-words
                  ${locked ? "text-soft/50" : "text-ink"}`}>{rk.name}</p>
                <p className="text-[8px] font-bold text-soft/60 tabular-nums leading-tight">{rk.min}</p>
              </div>
            );
          })}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-soft truncate font-semibold">Signed in as {user.email}</p>
              <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
            </div>
            <form className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null); setBusy(true);
                const { error } = await savePassword(password);
                setBusy(false);
                if (error) setError(error); else { setPassword2Done(true); setPassword(""); }
              }}>
              <Field label="Set a password"
                hint="Accounts made with a magic link have none. Set one and you can sign in without email."
                error={error}>
                <Input type="password" required minLength={6} value={password} placeholder="••••••••"
                  autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy} variant="secondary" className="w-full">
                {busy ? "Saving…" : pwDone ? "Password saved" : "Save password"}
              </Button>
            </form>
          </div>
        ) : sent ? (
          <p className="piece bg-good text-surface p-4 font-semibold">
            Check your email for the sign-in link.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null); setBusy(true);
              const fn = mode === "signin" ? signIn : signUp;
              const { error } = await fn(email, password);
              setBusy(false);
              if (error) setError(error);
            }}
          >
            <div className="flex gap-2">
              {(["signin", "signup"] as const).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-[2.5px] border-ink
                    ${mode === m ? "bg-ink text-paper" : "bg-surface text-soft"}`}>
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <Field label="Email" error={error}>
              <Input type="email" required value={email} placeholder="you@example.com"
                autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
              <Input type="password" required minLength={6} value={password} placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)} />
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <button type="button"
              onClick={async () => {
                if (!email) { setError("Enter your email first."); return; }
                setBusy(true);
                const { error } = await signInWithLink(email);
                setBusy(false);
                if (error) setError(error); else setSent(true);
              }}
              className="w-full text-xs font-bold text-soft underline underline-offset-4 pt-1">
              Email me a link instead
            </button>
            <p className="text-xs text-soft/70 font-semibold text-center">
              Links are limited to about two an hour until custom email is set up.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
