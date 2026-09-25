/**
 * The bot check on sign-in and sign-up (talk item 20, Daramola: build it now,
 * switch it on at launch). Cloudflare Turnstile, free and usually invisible:
 * it only shows a checkbox when a visitor looks risky.
 *
 * Off until VITE_TURNSTILE_SITE_KEY is set in Vercel: then `captchaToken()`
 * returns undefined and every sign-in goes as it always has. To switch it on:
 *   1. Cloudflare > Turnstile > add a widget for the site (Managed). It gives
 *      a site key and a secret key.
 *   2. Vercel: VITE_TURNSTILE_SITE_KEY = the site key, and redeploy.
 *   3. Only then, Supabase > Authentication > Attack Protection: turn on
 *      CAPTCHA, provider Turnstile, paste the secret key.
 * That order matters: with Supabase switched on first, an app that sends no
 * token can't sign anyone in.
 *
 * Supabase then wants a token on sign-up, password sign-in, guest sign-in and
 * the email link. Each token works once, so each of those asks for a fresh one.
 */
const SITE = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: Turnstile } }

export const captchaOn = () => !!SITE;

/** A failed check, carrying the sentence a player sees (our words, never the
    widget's). */
export class CaptchaFailed extends Error {
  constructor(readonly say: string) { super(say); }
}

let loading: Promise<Turnstile> | null = null;
function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((done, fail) => {
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onload = () => (window.turnstile ? done(window.turnstile) : fail(new Error("no turnstile")));
    s.onerror = () => { loading = null; fail(new Error("couldn't load the check")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** A one-use token, or undefined when the check is switched off. Rejects with
    a sentence a player can read if the check can't be passed. */
export async function captchaToken(): Promise<string | undefined> {
  if (!SITE) return undefined;
  const ts = await load().catch(() => { throw new CaptchaFailed("Couldn't load the quick safety check. Check your connection and try again."); });
  // Where the checkbox appears if Cloudflare wants one; empty and out of the
  // way otherwise ("interaction-only").
  const box = document.createElement("div");
  box.setAttribute("data-captcha", "");
  box.style.cssText = "position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:60";
  document.body.appendChild(box);
  let id = "";
  try {
    return await new Promise<string>((done, fail) => {
      const timer = setTimeout(() => fail(new CaptchaFailed("The safety check took too long. Try again.")), 30_000);
      id = ts.render(box, {
        sitekey: SITE,
        appearance: "interaction-only",
        callback: (token: string) => { clearTimeout(timer); done(token); },
        "error-callback": () => { clearTimeout(timer); fail(new CaptchaFailed("Couldn't pass the safety check. Try again, or try another browser.")); },
      });
    });
  } finally {
    if (id) ts.remove(id);
    box.remove();
  }
}
