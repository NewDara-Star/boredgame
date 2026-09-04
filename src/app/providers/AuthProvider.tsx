import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isConfigured } from "@/shared/lib/supabase";
import type { Profile } from "@/shared/types/db";

interface AuthValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True when there is no backend at all — the app runs on local content only. */
  offline: boolean;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signUp(email: string, password: string): Promise<{ error: string | null }>;
  signInWithLink(email: string): Promise<{ error: string | null }>;
  setPassword(password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
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
  async function signIn(email: string, password: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
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

  async function signOut() {
    await supabase?.auth.signOut();
    setProfile(null);
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, offline: !isConfigured, signIn, signUp, signInWithLink, setPassword, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
