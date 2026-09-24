/**
 * A name that can't be used says why (F3, J, P8).
 *
 * "Jo" got the browser's grey tooltip; "Tobi!" and "Tayo B" were told the name
 * was taken; a taken name got no way forward. The sentences live in
 * src/shared/lib/names.ts, every name form asks the same question through the
 * AuthProvider, and the rule itself is the server's.
 */
import { readFileSync } from "node:fs";
import { nameProblem, nameIdeas, takenSentence, NAME_RULE } from "../src/shared/lib/names.ts";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); bad++; } };
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

ok(nameProblem("Jo") === "At least 3 letters or numbers.", `"Jo" is too short: ${nameProblem("Jo")}`);
ok(nameProblem("Tobi!") === "Letters, numbers and _ only.", `"Tobi!" has a stray character: ${nameProblem("Tobi!")}`);
ok(nameProblem("Tayo B") === "No spaces. Tayo_B would work.", `"Tayo B" has a space, and gets one that works: ${nameProblem("Tayo B")}`);
ok(nameProblem("   ") === "Pick a name first.", "an empty name asks for one");
ok(nameProblem("a".repeat(21)) === "20 characters at most.", "21 characters is too long");
for (const good of ["Dara", "Dara_7", "abc", "x".repeat(20), "  Tayo  "]) ok(nameProblem(good) === null, `"${good}" can be used`);
ok(nameProblem("Tobi ! x")?.startsWith("No spaces") ?? false, "spaces are named before stray characters");

const ideas = nameIdeas("Dara", () => 0.5);
ok(ideas.length >= 1 && ideas.every((i) => NAME_RULE.test(i) && i.startsWith("Dara_")), `ideas for a taken name are usable: ${ideas}`);
ok(nameIdeas("A_very_long_name_here").every((i) => i.length <= 20 && NAME_RULE.test(i)), "ideas for a long name still fit 20");
ok(takenSentence("Dara_52") === "Taken. Dara_52 is free.", "a taken name comes with a free one");

// The rule is the server's: the same pattern in all three places it's enforced.
const schema = read("supabase/schema.sql");
ok(NAME_RULE.source === "^[A-Za-z0-9_]{3,20}$", "names.ts holds the server's pattern");
ok((schema.match(/'\^\[A-Za-z0-9_\]\{3,20\}\$'/g) ?? []).length >= 3, "schema.sql enforces the same pattern (trigger, username_available, set_username)");

// Every way to pick a name goes through the one check.
const auth = read("src/app/providers/AuthProvider.tsx");
for (const fn of ["signUp", "signInAsGuest", "claimAccount", "setUsername"]) {
  const at = auth.indexOf(`async function ${fn}(`);
  const body = auth.slice(at, auth.indexOf("\n  }\n", at));
  ok(at >= 0 && /nameBlocked\(/.test(body), `${fn} checks the name with nameBlocked`);
}
ok(!/isn't 3–20 letters|already using that name/.test(auth), "the old catch-all sentences are gone");

// Keeping a guest account: the name first, then the login (F4, K). The other
// way round, a name taken in the moment between left a login of one name on a
// profile of another.
{
  const at = auth.indexOf("async function claimAccount(");
  const body = auth.slice(at, auth.indexOf("\n  }\n", at));
  const name = body.indexOf("await setUsername("), login = body.indexOf("supabase.auth.updateUser(");
  ok(name > 0 && login > 0 && name < login, "claimAccount saves the name before the login");
  ok(/if \(named\.error\) return named;/.test(body), "and stops if the name didn't save");
  ok(/set_username", \{ p_name: before \}/.test(body), "a name that can't be a login is given back");
  ok(/setClaimedAs\(username\)/.test(body), "success leaves a 'Saved' card");
  const card = read("src/features/profile/GuestCard.tsx");
  ok(/useNameCheck\(/.test(card) && /Next time, sign in as/.test(card), "the claim form checks the name as you type and says what to sign in as");
}

// Renaming moves the sign-in with the name (F10): the name first, then the
// login; a login that won't move gives the name back, so they never differ.
{
  const at = auth.indexOf("async function setUsername(");
  const body = auth.slice(at, auth.indexOf("\n  }\n", at));
  const name = body.indexOf('rpc("set_username", { p_name: want })'), login = body.indexOf("supabase.auth.updateUser({ email: asLogin(want)");
  ok(name > 0 && login > name, "setUsername saves the name, then moves the sign-in to match");
  ok(/!user\.is_anonymous && isSynthetic\(login\)/.test(body), "only an account that signs in with its name has its sign-in moved");
  ok(/rpc\("set_username", \{ p_name: before \}\)/.test(body), "a sign-in that won't move gives the old name back");
  ok(/You'll sign in as \$\{draft\.trim\(\)\} from now on\./.test(read("src/features/profile/ProfilePage.tsx")), "the rename says what you sign in as now");
}

// A guest can't lose everything by accident (F12): no Sign out for a guest,
// saving first and big, starting over small and warned.
{
  const page = read("src/features/profile/ProfilePage.tsx");
  const guestSide = page.indexOf("{(isGuest || claimedAs) ? ("), memberSide = page.indexOf("<SignOut ");
  ok(guestSide > 0 && memberSide > guestSide && /<ClaimCard \/>/.test(page.slice(guestSide, memberSide)), "a guest's You screen offers saving, not Sign out");
  ok(/Start over as someone new/.test(page) && /for good\. There's no way back\./.test(page), "starting over is there, small, and says it's for good");
}

// Our words, not the browser's tooltip: the name forms don't let it speak.
for (const f of ["src/features/profile/AuthCard.tsx", "src/features/profile/GuestCard.tsx", "src/features/profile/ProfilePage.tsx"]) {
  const src = read(f);
  const forms = src.match(/<form[^>]*>/g) ?? [];
  const nameForms = f.endsWith("ProfilePage.tsx") ? forms.slice(0, 1) : forms;
  ok(nameForms.length > 0 && nameForms.every((t) => /noValidate/.test(t)), `${f}: every name form is noValidate`);
}

if (bad) { console.error(`\n${bad} of ${n} name assertions failed`); process.exit(1); }
console.log(`${n} name assertions hold`);
