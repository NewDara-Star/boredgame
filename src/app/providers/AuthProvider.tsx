import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isConfigured } from "@/shared/lib/supabase";

/**
 * Supabase Auth has no username login, so a name becomes an address on a domain
 * nothing ever sends to. That is not a workaround for the uniqueness problem —
 * it IS the uniqueness guarantee: two people cannot hold the same address, so
 * the race for a name is settled by auth rather than by checking first and
 * hoping. Lower-cased, so Dara and dara are the same person.
 */
const HOME = "players.boredgame.app";
export const asLogin = (id: string) =>
  id.includes("@") ? id.trim() : `${id.trim().toLowerCase()}@${HOME}`;
export const isSynthetic = (email?: string | null) => !!email?.endsWith(`@${HOME}`);
import type { Profile } from "@/shared/types/db";

interface AuthValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True when there is no backend at all — the app runs on local content only. */
  offline: boolean;
  signIn(id: string, password: string): Promise<{ error: string | null }>;
  /** `id` is a username, or an email for the accounts made before names. */
  signUp(id: string, password: string): Promise<{ error: string | null }>;
  signInWithLink(email: string): Promise<{ error: string | null }>;
  /** A name and nothing else. The wall in front of a nine-year-old or a
      grandparent was "and a password", so a guest gets neither an email nor
      one — just an anonymous session and the name they typed. */
  signInAsGuest(name: string): Promise<{ error: string | null }>;
  /** Turns that same account into a real one, keeping its id, so a guest who
      decides to stay does not lose the games they already played. */
  claimAccount(name: string, password: string): Promise<{ error: string | null }>;
  /** True while the session is anonymous. Guests are kept off the leaderboard. */
  isGuest: boolean;
  setPassword(password: string): Promise<{ error: string | null }>;
  /** Names are chosen, not generated — everything social shows one. */
  setUsername(name: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  /** Drop in a profile row we already have — touch_streak returns one, and
      refetching it just to see the same numbers is a wasted round trip. */
  applyProfile(p: Profile): void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (!supabase || !user) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile((data as Profile | null) ?? null);
  }

  useEffect(() => { void refreshProfile(); /* eslint-disable-next-line */ }, [user?.id]);

  /**
   * Password is the primary method on purpose. Supabase's built-in mailer allows
   * roughly two messages an hour and is documented as test-only, so magic links
   * cannot be the only way in until custom SMTP exists.
   */
  async function signIn(id: string, password: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email: asLogin(id), password });
    if (!error) return { error: null };
    return {
      error: /invalid login/i.test(error.message)
        ? "That name and password don't match an account."
        : error.message,
    };
  }

  async function signUp(id: string, password: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const username = id.includes("@") ? undefined : id.trim();

    if (username) {
      const { data: free } = await supabase.rpc("username_available", { p_name: username });
      if (free === false) {
        return { error: "That name is taken, or it isn't 3–20 letters, numbers and underscores." };
      }
    }

    const { error } = await supabase.auth.signUp({
      email: asLogin(id), password,
      // The trigger reads this, so the name you chose is the name you get
      // rather than one derived from the address we invented for you.
      options: { data: username ? { username } : undefined,
                 emailRedirectTo: window.location.origin },
    });
    if (!error) return { error: null };
    return {
      error: /already registered|already been/i.test(error.message)
        ? "That name is already taken."
        : error.message,
    };
  }

  async function signInAsGuest(name: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const username = name.trim();
    if (username) {
      // Same check the real sign-up does. Without it the trigger silently falls
      // back to guest_ab12 and the player wonders who that is.
      const { data: free } = await supabase.rpc("username_available", { p_name: username });
      if (free === false) {
        return { error: "Someone's already using that name — try another." };
      }
    }
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: username ? { username } : undefined },
    });
    if (!error) return { error: null };
    // The one failure worth naming, because it is a project setting rather
    // than anything the player did.
    return {
      error: /anonymous/i.test(error.message)
        ? "Guest play is switched off for this app. Enable anonymous sign-ins in Supabase → Authentication → Sign In / Providers."
        : error.message,
    };
  }

  /**
   * Anonymous → permanent, on the same row, so the id survives and with it every
   * room, score and streak already attached to it. The trigger on auth.users
   * clears is_guest when is_anonymous flips.
   */
  async function claimAccount(name: string, password: string) {
    if (!supabase || !user) return { error: "Supabase is not configured yet." };
    const username = name.trim();
    const { data: free } = await supabase.rpc("username_available", { p_name: username });
    if (free === false && profile?.username.toLowerCase() !== username.toLowerCase()) {
      return { error: "That name is already taken." };
    }
    const { error } = await supabase.auth.updateUser({
      email: asLogin(username), password, data: { username },
    });
    if (error) {
      return {
        error: /already registered|already been/i.test(error.message)
          ? "That name is already taken."
          : error.message,
      };
    }
    if (username) await setUsername(username);
    // `is_anonymous` is a JWT claim, so `isGuest` keeps reading true until the
    // token is reissued. Refresh it now, or a freshly-claimed account still sees
    // the guest "claim your account" prompts until the next refresh.
    await supabase.auth.refreshSession();
    await refreshProfile();
    return { error: null };
  }

  /** Kept as a fallback. Will hit the rate limit until custom SMTP is set up. */
  async function signInWithLink(email: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }

  /**
   * Accounts created by magic link have no password at all, so once password
   * became the primary method those users were locked out with no route back.
   * This is that route — chosen by them, never set on their behalf.
   */
  async function setPassword(password: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  async function setUsername(name: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { data, error } = await supabase.rpc("set_username", { p_name: name });
    if (error) return { error: error.message };
    if (data === "taken") return { error: "That name is already taken." };
    if (data === "invalid") return { error: "3–20 characters, letters, numbers and underscores only." };
    await refreshProfile();
    return { error: null };
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setProfile(null);
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, offline: !isConfigured, isGuest: !!user?.is_anonymous,
      signIn, signUp, signInWithLink, signInAsGuest, claimAccount,
      setPassword, setUsername, signOut, refreshProfile, applyProfile: setProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
