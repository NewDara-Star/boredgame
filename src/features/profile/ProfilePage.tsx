import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, isSynthetic } from "@/app/providers/AuthProvider";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { AuthCard } from "./AuthCard";
import { LinkFailed, LinkSent } from "./LinkStates";
import { ClaimCard, useNameCheck } from "./GuestCard";
import { NotificationsRow } from "@/features/push/Notifications";
import { ScreenTitle } from "@/app/layout/ScreenTitle";
import { StreakPill } from "@/features/play/RoundChrome";
import { Sunflower } from "@/shared/brand/Sunflower";
import { useLeaderboard, type Standing } from "@/features/leaderboard/useLeaderboard";
import { takeLinkError } from "@/shared/lib/linkError";
import { readCarry } from "@/features/play/carry";

/** Supabase reports a failed magic link in the URL fragment. Without reading it,
    a broken link looks identical to never having clicked one. */
function useLinkError() {
  // Read when the app started (shared/lib/linkError), whichever page the link
  // landed on; taken once, so it doesn't come back on the next visit.
  const [authError] = useState<string | null>(takeLinkError);
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
  const kept = readCarry().rows.length;   // what an account made now takes with it (F17)
  // #52: a new link sent from the failed-link card; the card goes once it's used.
  const [resent, setResent] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-[11px]">
      <motion.div variants={riseIn} className="grid gap-1.5">
        <ScreenTitle end={false}>You</ScreenTitle>
        <p className="text-[14px] text-soft font-semibold">
          {played ? "Keep your progress: make an account, or sign in." : "Save your progress: make an account, or sign in."}
        </p>
      </motion.div>

      {resent ? (
        <motion.div variants={riseIn}><LinkSent email={resent} onBack={() => setResent(null)} /></motion.div>
      ) : authError && !dismissed ? (
        <motion.div variants={riseIn}><LinkFailed reason={authError} onSent={(e) => { setResent(e); setDismissed(true); }} /></motion.div>
      ) : null}

      {!resent && <motion.div variants={riseIn}>
        <AuthCard kept={kept > 0
          ? `${kept} answer${kept === 1 ? "" : "s"} from this phone come with you when you make an account, with up to 7 days of streak.`
          : undefined} />
      </motion.div>}

      {/* Shown as a small aside, not as a dashboard — it is what you stand to keep,
          not a profile you already have. */}
      <motion.div variants={riseIn} className="card shadow-lift-sm rounded-[20px] px-3 py-2.5 flex items-center gap-2.5 text-ink">
        <RankBadge rank={current.key} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            {played ? `Playing signed out: ${current.name}, ${p.answered} answered` : "Playing signed out"}
          </p>
          <p className="text-[13px] font-bold text-soft mt-0.5">
            Kept on this phone until you make an account. Clearing site data loses it.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The page title, the same on every You screen (#46, #51): no pill here,
    it sits in your card instead. */
function Title() {
  return <ScreenTitle end={false}>You</ScreenTitle>;
}

const CARD = "card shadow-lift-sm rounded-[20px] p-3.5 grid gap-2 text-ink";
const LI = "card shadow-lift-sm rounded-[16px] px-3 py-[9px] flex items-center gap-2.5 text-ink";
const LINK = "text-[13px] font-extrabold underline underline-offset-4 min-h-[44px] -my-2 grid place-items-center";

/** #46: you, in one card: your disc in gold, the name, since when, the streak
    pill; then your rank's flower big, its name and what it took. */
function ProfileCard({ id, name, since, answered, streak }:
  { id: string; name: string; since?: string; answered: number; streak: number }) {
  const { current } = rankFor(answered);
  return (
    <motion.section variants={riseIn} className={CARD}>
      <div className="flex items-center gap-2.5">
        <Avatar id={id} name={name} size={52} tone="petal" />
        <div className="min-w-0 flex-1">
          <b className="block font-display font-normal text-[23px] leading-tight truncate">{name}</b>
          {since && (
            <small className="block text-[14px] font-semibold text-soft">
              Playing since {new Date(since).toLocaleDateString(undefined, { month: "long", year: new Date(since).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}
            </small>
          )}
        </div>
        {streak > 0 && <StreakPill />}
      </div>
      <div className="grid justify-items-center text-center pt-1">
        <RankBadge rank={current.key} size={96} animate />
        <h2 className="font-display text-[28px] leading-[1.1]">{current.name}</h2>
        <span className="text-[14px] font-semibold text-soft tabular-nums">{answered.toLocaleString()} questions answered</span>
      </div>
    </motion.section>
  );
}

/** #46: how far to the next rank, as a ring (.ring-s) and one line. */
function NextRank({ answered }: { answered: number }) {
  const { next, progress } = rankFor(answered);
  if (!next) return null;
  const pct = Math.round(progress * 100);
  return (
    <motion.section variants={riseIn} className="card shadow-lift-sm rounded-[20px] px-3 py-2.5 flex items-center gap-2.5 text-ink">
      <span aria-hidden className="relative shrink-0 w-[46px] h-[46px] rounded-full"
        style={{ background: `conic-gradient(var(--color-petal) ${pct}%, var(--color-mist) 0)` }}>
        <span className="absolute inset-2 rounded-full bg-board" />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[15px] leading-tight tabular-nums">{(next.min - answered).toLocaleString()} more to {next.name}</b>
        <small className="block text-[13px] font-semibold text-soft tabular-nums">Your flower blooms at {next.min.toLocaleString()}.</small>
      </div>
    </motion.section>
  );
}

/** All ten ranks, two rows of five (.badges), yours lit; See the road (#46 → #48). */
function Ladder({ answered }: { answered: number }) {
  const idx = RANKS.filter((r) => answered >= r.min).length - 1;
  return (
    <motion.section variants={riseIn} className={CARD}>
      <div className="flex items-center gap-2.5">
        <b className="flex-1 text-[15px]">All ten ranks</b>
        <Link to="/you/road" className={`${LINK} text-sky-lo`}>See the road</Link>
      </div>
      <Link to="/you/road" aria-label={`All ten ranks. You're ${RANKS[idx].name}, ${idx + 1} of ${RANKS.length}. See the road`}
        className="grid grid-cols-5 gap-1.5 justify-items-center items-end">
        {RANKS.map((rk, i) => (
          <span key={rk.key} className={i === idx ? "rounded-[12px] bg-petal-hi p-[3px]" : i > idx ? "grayscale opacity-35" : ""}>
            <RankBadge rank={rk.key} size={34} />
          </span>
        ))}
      </Link>
    </motion.section>
  );
}

/** .stat: a number worth looking at, with a word under it. */
function Stat({ value, label, gold = false }: { value: string | number; label: string; gold?: boolean }) {
  return (
    <motion.div variants={popIn} className={`card shadow-lift-sm rounded-[16px] px-2.5 py-[9px] text-ink ${gold ? "bg-petal" : ""}`}>
      <b className="block font-display font-normal text-[26px] leading-none tabular-nums">{value}</b>
      <small className={`text-[12px] font-extrabold ${gold ? "" : "text-soft"}`}>{label}</small>
    </motion.div>
  );
}

/** Where you stand, in two rows (.li): the top of the board and you (#47 → #49). */
function Standing1({ p, me }: { p: Standing; me: boolean }) {
  return (
    <div className={`${LI} ${me ? "bg-petal" : ""}`}>
      <Avatar id={p.id} name={p.username} size={26} tone={me ? "petal" : undefined} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-[1.2] truncate tabular-nums">{p.position}{"\u2002"}{me ? "You" : p.username}</b>
        <small className={`block text-[12px] font-semibold tabular-nums ${me ? "" : "text-soft"}`}>{p.answered.toLocaleString()} answered</small>
      </span>
      <RankBadge rank={rankFor(p.answered).current.key} size={26} className="shrink-0" />
    </div>
  );
}

function EveryoneCard({ userId }: { userId?: string }) {
  const { rows, you, loading, failed } = useLeaderboard(userId, 1);
  return (
    <motion.section variants={riseIn} className="card shadow-lift-sm rounded-[20px] px-3 py-2.5 grid gap-2 text-ink">
      <div className="flex items-center gap-2.5">
        <b className="flex-1 text-[15px]">Everyone</b>
        <Link to="/you/everyone" className={`${LINK} text-sky-lo`}>See all</Link>
      </div>
      {loading ? <p className="text-[13px] font-semibold text-soft">One moment…</p>
        : failed ? <p className="text-[13px] font-semibold text-soft">Couldn't load the board. It's there under See all.</p>
        : rows.length === 0 ? <p className="text-[13px] font-semibold text-soft">Nobody's on it yet. Answer one question and the top spot is yours.</p>
        : (
          <>
            <Standing1 p={rows[0]} me={rows[0].id === userId} />
            {you && you.id !== rows[0].id && <Standing1 p={you} me />}
          </>
        )}
    </motion.section>
  );
}

/** A sheet from the bottom with one job (#50). Tapping outside closes it. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid items-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-day/55" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative bg-board rounded-t-[26px] px-4 pt-[14px] pb-[calc(18px+env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto grid gap-[10px] shadow-[0_-10px_30px_rgba(14,74,176,.25)]">
        <div className="w-10 h-[5px] rounded-full bg-hair mx-auto" />
        <b className="font-display font-normal text-[22px] leading-tight">{title}</b>
        {children}
      </motion.div>
    </div>
  );
}

/** Change your name: one field, checked as you type, then Save (#50, F10). */
function NameSheet({ onClose }: { onClose: () => void }) {
  const { user, profile, setUsername, checkName } = useAuth();
  const [draft, setDraft] = useState(profile?.username ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameNote, setNameNote] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const changed = draft.trim() !== "" && draft !== profile?.username;
  const live = useNameCheck(changed && !nameMsg ? draft : "", (n) => checkName(n), (n) => `${n} is free.`);
  return (
    <Sheet title="Change your name" onClose={onClose}>
      <form className="grid gap-[10px]" noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setNameErr(null); setNameMsg(null); setNameNote(null); setNameBusy(true);
          const { error } = await setUsername(draft);
          setNameBusy(false);
          if (error) setNameErr(error);
          else {
            setNameMsg("Saved");
            if (isSynthetic(user?.email)) setNameNote(`You'll sign in as ${draft.trim()} from now on.`);
          }
        }}>
        {/* #50: the field, then one line under it (green when the name is
            free), then what changing it does; Save first, Cancel second. */}
        <div className="grid gap-1.5">
          <Input value={draft} aria-label="Name" onChange={(e) => { setDraft(e.target.value); setNameMsg(null); setNameNote(null); setNameErr(null); }}
            maxLength={20} placeholder="yourname" autoComplete="off" autoCapitalize="none" autoFocus />
          {(nameErr ?? (live.state === "bad" ? live.text : null)) ? (
            <small className="text-[13px] font-bold text-ember-lo" role="alert">{nameErr ?? live.text}</small>
          ) : live.state === "ok" || live.state === "checking" ? (
            <small className={`text-[13px] font-bold ${live.state === "ok" ? "text-leaf-deep" : "text-soft"}`}>{live.state === "ok" ? live.text : "Checking…"}</small>
          ) : null}
        </div>
        <p className="text-[14px] font-semibold text-soft">{nameNote && !nameErr ? nameNote : "Friends and the leaderboard see the new name straight away."}</p>
        <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
          <Button type="submit" disabled={nameBusy || !changed || !!nameMsg}>
            {nameBusy ? "…" : nameMsg ?? "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>{nameMsg ? "Done" : "Cancel"}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Set or change the password (#50). */
function PasswordSheet({ onClose, has }: { onClose: () => void; has: boolean }) {
  const { setPassword: savePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title={has ? "Change your password" : "Set a password"} onClose={onClose}>
      <form className="grid gap-[10px]"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await savePassword(password);
          setBusy(false);
          if (error) setError(error); else { setDone(true); setPassword(""); }
        }}>
        <Field label="New password" hint={done ? "Saved. Use it next time you sign in." : undefined} good={done} error={error}>
          <Input type="password" required minLength={6} value={password} placeholder="At least 6 characters"
            autoComplete="new-password" onChange={(e) => { setPassword(e.target.value); setDone(false); }} />
        </Field>
        <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
          <Button type="submit" disabled={busy || password.length === 0}>{busy ? "Saving…" : done ? "Saved" : "Save"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>{done ? "Done" : "Cancel"}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** One Account row (.li): what it is, what it's set to, and Change (#47). */
function AccountRow({ label, value, action, onClick }: { label: string; value: string; action: string; onClick: () => void }) {
  return (
    <div className={LI}>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-[1.2]">{label}</b>
        <small className="block text-[12px] font-semibold text-soft truncate">{value}</small>
      </span>
      <button onClick={onClick} className={`${LINK} text-soft shrink-0`}>{action}</button>
    </div>
  );
}

/** You, signed in (#46 top, #47 further down). */
function MemberView() {
  const { user, profile, signOut } = useAuth();
  const [sheet, setSheet] = useState<"name" | "password" | null>(null);
  const p = useProgress();
  const name = profile?.username ?? "You";
  const best = Math.max(p.bestScore.picto ?? 0, p.bestScore.trivia ?? 0);
  // The signup trigger makes prefix_abcd. Anyone still carrying one has never
  // chosen a name, and is about to appear on a public board under it.
  const generated = /_[0-9a-f]{4}$/.test(profile?.username ?? "");
  const since = profile?.created_at ?? user?.created_at;
  const hasPassword = isSynthetic(user?.email);   // a name account always has one; an email one may not

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-[11px] pb-6">
      <Title />
      <ProfileCard id={user?.id ?? "anon"} name={name} since={since} answered={p.answered} streak={p.streak} />
      <NextRank answered={p.answered} />
      <Ladder answered={p.answered} />

      <motion.section variants={stagger(0.05)} className="grid grid-cols-3 gap-2">
        <Stat value={p.streak} label="Day streak" gold={p.streak > 0} />
        <Stat value={p.answered ? Math.round((p.correct / p.answered) * 100) + "%" : "—"} label="Right" />
        <Stat value={best || "—"} label="Best round" />
      </motion.section>

      <EveryoneCard userId={user?.id} />

      <motion.section variants={riseIn} className="grid gap-2" aria-label="Account">
        <span className="text-[12px] font-extrabold text-soft">Account</span>
        {generated && (
          <p className="card shadow-lift-sm rounded-[16px] bg-petal px-3 py-[9px] text-[13px] font-semibold text-ink">
            This name was made up for you at signup. Pick your own before anyone sees you on the leaderboard.
          </p>
        )}
        <AccountRow label="Name" value={name} action="Change" onClick={() => setSheet("name")} />
        <AccountRow label="Password" value={hasPassword ? "Set" : "Not set"} action={hasPassword ? "Change" : "Set"}
          onClick={() => setSheet("password")} />
        <NotificationsRow />
      </motion.section>

      <motion.div variants={riseIn}>
        <SignOut name={profile?.username ?? null} signOut={signOut} />
      </motion.div>

      {sheet === "name" && <NameSheet onClose={() => setSheet(null)} />}
      {sheet === "password" && <PasswordSheet has={hasPassword} onClose={() => setSheet(null)} />}
    </motion.div>
  );
}

/**
 * You, as a guest (#51, F13). The rank still shows; the account part is one
 * thing: keep all of it. No Sign out and no Set a password (F12): a guest has
 * no sign-in to come back with. Starting over is small, and warned.
 */
function GuestYou() {
  const { profile, signOut, claimedAs } = useAuth();
  const [haveAccount, setHaveAccount] = useState(false);
  const p = useProgress();
  const name = profile?.username ?? null;
  const { current } = rankFor(p.answered);
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-[11px] pb-6">
      <Title />
      {/* #51: the flower, your rank and what it's counted from, the badge. */}
      <motion.section variants={riseIn} className={CARD}>
        <div className="flex items-center gap-2.5">
          <Sunflower state="look-right" size={58} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <b className="block font-display font-normal text-[21px] leading-tight">{current.name}</b>
            <small className="block text-[14px] font-semibold text-soft tabular-nums">
              {p.answered.toLocaleString()} answered on this phone{p.streak > 0 ? `, ${p.streak}-day streak` : ""}
            </small>
          </div>
          <RankBadge rank={current.key} size={52} className="shrink-0" />
        </div>
      </motion.section>
      {claimedAs ? (
        <motion.div variants={riseIn}><ClaimCard /></motion.div>
      ) : haveAccount ? (
        <motion.div variants={riseIn} className="grid gap-2">
          <AuthCard start="signin"
            note={`Signing in leaves ${name ? `${name}'s` : "these"} guest games behind. To keep them, save them instead.`} />
          <button onClick={() => setHaveAccount(false)} className={`${LINK} text-soft mx-auto`}>
            Save my progress instead
          </button>
        </motion.div>
      ) : (
        <>
          <motion.section variants={riseIn} className={CARD}>
            <b className="font-display font-normal text-[20px] leading-tight">Keep all of it</b>
            <p className="text-[14px] font-semibold text-soft">
              Kept for 30 days after you last play. Add a password to keep it for good and get on the board.
            </p>
            <ClaimCard inline />
          </motion.section>
          <motion.button variants={riseIn} onClick={() => setHaveAccount(true)} className={`${LINK} text-soft mx-auto`}>
            I have an account
          </motion.button>
        </>
      )}
      {!claimedAs && <StartOver name={name} signOut={signOut} />}
    </motion.div>
  );
}

export function ProfilePage() {
  const { user, offline, isGuest, claimedAs } = useAuth();
  const authError = useLinkError();

  if (offline) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold">No account needed yet</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          There is no backend configured, so progress is saved in this browser only.
          Add Supabase keys for accounts, sync and head-to-head.
        </p>
      </div>
    );
  }
  if (!user) return <GuestView authError={authError} />;
  // A guest who has just saved stays here until they tap "Got it" on the Saved card.
  return isGuest || claimedAs ? <GuestYou /> : <MemberView />;
}

/**
 * Sign out asks once, and says what happens (F5): a member's games are on the
 * server, so the sheet says so and names the sign-in to come back with.
 */
function SignOut({ name, signOut }: { name: string | null; signOut: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    // Last, and small (#47): nobody needs it often, and it's never an accident.
    return <button onClick={() => setAsking(true)} className={`${LINK} text-soft mx-auto`}>Sign out</button>;
  }
  return (
    <div className="card shadow-lift-sm rounded-[20px] p-3.5 grid gap-2.5 text-ink" role="alertdialog" aria-label="Sign out?">
      <p className="text-[14px] font-semibold">Your games are saved. Sign back in as {name ?? "your name"}.</p>
      <div className="grid grid-cols-2 gap-[9px]">
        <Button variant="ghost" onClick={() => setAsking(false)} disabled={busy}>Stay</Button>
        <Button disabled={busy}
          onClick={async () => { setBusy(true); await signOut(); }}>
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

/**
 * A guest has no sign-in to come back with, so there is no Sign out (F12): a
 * guest who signed out lost everything, and nothing said so. Saving comes first
 * and big (the ClaimCard above); starting over is small, and says plainly that
 * it's for good.
 */
function StartOver({ name, signOut }: { name: string | null; signOut: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)}
        className="block mx-auto text-[12px] font-bold text-soft underline underline-offset-4">
        Start over as someone new
      </button>
    );
  }
  return (
    <div className="card shadow-lift-sm rounded-[20px] bg-petal-hi p-3.5 grid gap-2.5 text-ink" role="alertdialog" aria-label="Start over?">
      <p className="text-[14px] font-semibold">
        This loses {name ? `${name}'s` : "these"} games, streak and friends for good. There's no way back.
      </p>
      <div className="grid grid-cols-2 gap-[9px]">
        <Button onClick={() => setAsking(false)} disabled={busy}>Keep playing</Button>
        <Button variant="ghost" disabled={busy}
          onClick={async () => { setBusy(true); await signOut(); }}>
          {busy ? "One moment…" : "Start over"}
        </Button>
      </div>
    </div>
  );
}
