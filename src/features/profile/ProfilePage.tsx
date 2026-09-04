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
import { AuthCard } from "./AuthCard";

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

/** Supabase reports a failed magic link in the URL fragment. Without reading it,
    a broken link looks identical to never having clicked one. */
function useLinkError() {
  const [authError, setAuthError] = useState<string | null>(null);
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
  return authError;
}

/**
 * What a signed-out player sees. It used to be the full dashboard with the sign-in
 * form buried under four sections, which read as "you are already logged in" and
 * hid the only action on the page.
 */
function GuestView({ authError }: { authError: string | null }) {
  const p = useProgress();
  const { current } = rankFor(p.answered);
  const played = p.answered > 0;

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn}>
        <p className="text-[10px] font-black uppercase tracking-widest text-soft">Account</p>
        <h1 className="font-display text-[32px] leading-none font-semibold mt-1">
          {played ? "Keep your progress" : "Save your progress"}
        </h1>
      </motion.div>

      {authError && (
        <motion.div variants={riseIn} className="piece bg-bad text-surface p-4">
          <p className="font-display font-semibold">Sign-in didn't complete</p>
          <p className="text-sm mt-1 font-semibold">{authError}</p>
        </motion.div>
      )}

      <motion.div variants={riseIn}>
        <AuthCard kept={played
          ? `You've answered ${p.answered} question${p.answered === 1 ? "" : "s"} on this device. An account keeps them, and your rank and streak, everywhere else.`
          : undefined} />
      </motion.div>

      {/* Shown as a small aside, not as a dashboard — it is what you stand to keep,
          not a profile you already have. */}
      <motion.div variants={riseIn} className="piece p-4 flex items-center gap-3">
        <RankBadge rank={current.key} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            {played ? `Playing as a guest — ${current.name}, ${p.answered} answered` : "Playing as a guest"}
          </p>
          <p className="text-[11px] font-bold text-soft mt-0.5">
            Saved in this browser only. Clearing site data loses it.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The dashboard, for someone who actually has an account. */
function MemberView() {
  const { user, profile, signOut, setPassword: savePassword, setUsername } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(profile?.username ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  useEffect(() => { setDraft(profile?.username ?? ""); }, [profile?.username]);
  // The signup trigger makes prefix_abcd. Anyone still carrying one has never
  // chosen a name, and is about to appear on a public board under it.
  const generated = /_[0-9a-f]{4}$/.test(profile?.username ?? "");

  const p = useProgress();
  const { current, next, progress } = rankFor(p.answered);
  const name = profile?.username ?? "You";
  const best = Math.max(p.bestScore.picto ?? 0, p.bestScore.trivia ?? 0);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-7">
      <motion.section variants={riseIn} className="flex items-center gap-4">
        <Avatar id={user?.id ?? "anon"} name={name} size={62} />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-semibold truncate">{name}</h1>
          <p className="text-xs font-bold text-soft mt-0.5 truncate">{user?.email}</p>
        </div>
        <div className="flex-1" />
        <RankBadge rank={current.key} size={54} animate className="shrink-0" />
      </motion.section>

      <motion.div variants={riseIn} className="piece p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-semibold">{current.name}</span>
          <span className="text-xs font-bold text-soft tabular-nums">
            {next ? `${next.min - p.answered} to ${next.name}` : "Top rank"}
          </span>
        </div>
        <div className="h-3.5 bg-sand rounded-full mt-2.5 overflow-hidden border-2 border-ink">
          <motion.div className="h-full bg-pop"
            initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.3 }} />
        </div>
      </motion.div>

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
                <span className="font-display text-lg font-semibold tabular-nums leading-none">{m.days}</span>
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

      <motion.section variants={riseIn}
        className={`piece p-4 ${generated ? "bg-pop" : ""}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-soft">Your name</p>
        <p className="text-[13px] font-semibold mt-1">
          {generated
            ? "This one was made up for you at signup. Pick something before anyone sees you on the leaderboard."
            : "How you appear in rooms and on the leaderboard."}
        </p>
        <form className="flex gap-2 mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setNameErr(null); setNameMsg(null); setNameBusy(true);
            const { error } = await setUsername(draft);
            setNameBusy(false);
            if (error) setNameErr(error); else setNameMsg("Saved");
          }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)}
            maxLength={20} placeholder="yourname" autoComplete="off" />
          <Button type="submit" variant="ghost"
            disabled={nameBusy || !draft.trim() || draft === profile?.username}>
            {nameBusy ? "…" : nameMsg ?? "Save"}
          </Button>
        </form>
        {nameErr && <p className="text-[12px] font-bold text-bad mt-2">{nameErr}</p>}
      </motion.section>

      <section className="border-t-2 border-sand pt-6 space-y-4">
        <form className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null); setBusy(true);
            const { error } = await savePassword(password);
            setBusy(false);
            if (error) setError(error); else { setPwDone(true); setPassword(""); }
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
        <Button variant="ghost" className="w-full" onClick={() => void signOut()}>Sign out</Button>
      </section>
    </motion.div>
  );
}

export function ProfilePage() {
  const { user, offline } = useAuth();
  const authError = useLinkError();

  if (offline) {
    return (
      <div className="piece p-6">
        <h1 className="font-display text-2xl font-semibold">No account needed yet</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          There is no backend configured, so progress is saved in this browser only.
          Add Supabase keys for accounts, sync and head-to-head.
        </p>
      </div>
    );
  }
  return user ? <MemberView /> : <GuestView authError={authError} />;
}
