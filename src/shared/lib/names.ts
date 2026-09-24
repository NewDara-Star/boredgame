/**
 * Why a name can't be used, in our words (F3, J, P8).
 *
 * The rule is the server's: 3 to 20 letters, numbers and underscores, and not
 * taken by anyone in any capitals (username_available, set_username and the
 * sign-up trigger all hold it). Before this, "Jo" got the browser's grey
 * tooltip, "Tobi!" and "Tayo B" were told the name was taken, and a taken name
 * got no way forward. Each now gets its own sentence, and a taken name comes
 * with one that's free.
 */
export const NAME_RULE = /^[A-Za-z0-9_]{3,20}$/;

/** A sentence when the name breaks the rule, null when it could be used. */
export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Pick a name first.";
  if (/\s/.test(name)) {
    const joined = name.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
    return NAME_RULE.test(joined) ? `No spaces. ${joined} would work.` : "No spaces: letters, numbers and _ only.";
  }
  if (/[^A-Za-z0-9_]/.test(name)) return "Letters, numbers and _ only.";
  if (name.length < 3) return "At least 3 letters or numbers.";
  if (name.length > 20) return "20 characters at most.";
  return null;
}

/** Names to offer when one is taken: the name with a short number on it. */
export function nameIdeas(raw: string, random: () => number = Math.random): string[] {
  const base = raw.trim().replace(/[^A-Za-z0-9_]/g, "").slice(0, 17);
  const out = new Set<string>();
  for (let i = 0; i < 12 && out.size < 4; i++) out.add(`${base}_${Math.floor(random() * 90) + 7}`.slice(0, 20));
  return [...out].filter((n) => NAME_RULE.test(n));
}

/** The sentence for a taken name, with a free one when there is one. */
export const takenSentence = (free: string | null) =>
  free ? `Taken. ${free} is free.` : "Taken. Try adding a number.";

/**
 * Which box an account-form error belongs under (F15, P7). Every error used to
 * land under Name, so a short or wrong password read as a problem with the
 * name. A sentence about the password goes under Password, one about the name
 * under Name, and the rest ("That name and password don't match", "You seem to
 * be offline") under the whole form.
 */
export function errorField(message: string): "name" | "password" | "form" {
  if (/name and (your )?password/i.test(message)) return "form";
  if (/password/i.test(message)) return "password";
  if (/^(Taken|At least 3|Letters, numbers|No spaces|Pick a name|20 characters|That name|Someone)/.test(message)) return "name";
  return "form";
}
