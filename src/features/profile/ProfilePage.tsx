import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { MILESTONES } from "@/features/play/streak";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";

/** A number worth looking at, with a word under it. That is the whole card. */
function Stat({ value, label, accent = "" }:
  { value: string | number; label: string; accent?: string }) {
  return (
    <motion.div variants={popIn} className={`piece p-3.5 ${accent}`}>
      <b className="block font-display text-[28px] leading-none font-semibold tabular-nums">{value}</b>
      <span className="block text-[9.5px] font-black uppercase tracking-widest text-soft mt-1.5">
        {label}
      </span>
    </motion.div>
  );
}

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

  const p = useProgress();
  const { current, next, progress } = rankFor(p.answered);
  const name = profile?.username ?? "Guest";
  const best = Math.max(p.bestScore.picto ?? 0, p.bestScore.trivia ?? 0);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-7">
      <motion.section variants={riseIn} className="flex items-center gap-4">
        <Avatar id={user?.id ?? "anon"} name={name} size={62} />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-semibold truncate">{name}</h1>
          <p className="text-xs font-bold text-soft mt-0.5">
            {user ? user.email : "Playing signed out — progress stays in this browser"}
          </p>
        </div>
        <div className="flex-1" />
        <RankBadge rank={current.key} size={54} animate className="shrink-0" />
      </motion.section>

      <section>
        <motion.div variants={riseIn} className="piece p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-xl font-semibold">{current.name}</span>
            <span className="text-xs font-bold text-soft tabular-nums">
              {next ? `${next.min - p.answered} to ${next.name}` : "Top rank"}
            </span>
          </div>
          <div className="h-3.5 bg-sand rounded-full mt-2.5 overflow-hidden border-2 border-ink">
            <motion.div className="h-full bg-pop"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.3 }} />
          </div>
        </motion.div>
      </section>

      <motion.section variants={stagger(0.05)} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat value={p.streak} label="Day streak" accent={p.streak > 0 ? "bg-pop" : ""} />
        <Stat value={p.answered} label="Answered" />
        <Stat value={p.answered ? Math.round((p.correct / p.answered) * 100) + "%" : "—"} label="Accuracy" />
        <Stat value={best || "—"} label="Best round" />
      </motion.section>

      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-soft mb-2.5">
          Streaks · best run {p.bestStreak} {p.bestStreak === 1 ? "day" : "days"}
        </p>
        <motion.div variants={stagger(0.04)} className="grid grid-cols-6 gap-2">
          {MILESTONES.map((m) => {
            const earned = p.bestStreak >= m.days;
            return (
              <motion.div key={m.days} variants={popIn} title={m.name}
                className={`piece grid place-items-center aspect-square
                  ${earned ? "bg-pop" : "bg-sand opacity-45"}`}>
                <span className="font-display text-lg font-semibold tabular-nums leading-none">
                  {m.days}
                </span>
                <span className="text-[7.5px] font-black uppercase tracking-wider text-soft">day</span>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-soft mb-2.5">
          Ranks · {RANKS.filter((r) => p.answered >= r.min).length} of {RANKS.length}
        </p>
        <motion.div variants={stagger(0.035)} className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {RANKS.map((rk) => {
            const locked = p.answered < rk.min;
            return (
              <motion.div key={rk.key} variants={popIn}
                className={`piece px-2 py-3 text-center ${locked ? "bg-sand" : ""}`}>
                <div className="h-10 grid place-items-center">
                  <RankBadge rank={rk.key} size={36} locked={locked} />
                </div>
                {/* No tracking and a hard break: "Accomplished" next to "Advanced"
                    collided at phone width with letter-spacing applied. */}
                <p className={`text-[9px] font-black uppercase mt-1.5 leading-[1.15] break-words
                  ${locked ? "text-soft/60" : "text-ink"}`}>{rk.name}</p>
                <p className="text-[9px] font-bold text-soft/60 tabular-nums leading-tight mt-0.5">
                  {locked ? `${rk.min - p.answered} to go` : "unlocked"}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
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
    </motion.div>
  );
}
