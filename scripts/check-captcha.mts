/**
 * The bot check (talk item 20) is built but off until launch. Two promises to
 * keep: while VITE_TURNSTILE_SITE_KEY is unset nothing changes, and once it is
 * set every call Supabase will check carries a fresh token. Checked in the
 * source, since the switch lives in Vercel and Supabase, not here.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const cap = src("../src/shared/lib/captcha.ts");
ok(/const SITE = import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/.test(cap) && /if \(!SITE\) return undefined;/.test(cap),
   "with no site key the check returns nothing and loads nothing");
ok(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/.test(cap) && /appearance: "interaction-only"/.test(cap),
   "with a key it uses Turnstile, showing a checkbox only when Cloudflare wants one");
ok(/finally \{[\s\S]*ts\.remove\(id\)/.test(cap), "each widget is removed after use (a token works once)");

const auth = src("../src/app/providers/AuthProvider.tsx");
// Supabase checks these four once CAPTCHA is on: each must send a fresh token.
for (const call of ["signInWithPassword", "signUp", "signInAnonymously", "signInWithOtp"]) {
  const at = auth.indexOf(`supabase.auth.${call}(`);
  ok(at > 0, `${call} is still where the check expects it`);
  const before = auth.slice(Math.max(0, at - 400), at), args = auth.slice(at, at + 400);
  ok(/const captcha = await tokenOr\(\);/.test(before) && /captchaToken: captcha/.test(args),
     `${call} asks for a fresh token and sends it`);
}
ok(!/VITE_TURNSTILE_SECRET|TURNSTILE_SECRET/.test(cap + auth), "the secret key is never in the app (it goes in Supabase)");

console.log(`${n} captcha assertions hold`);
