/**
 * The sunflower identity, as data. The ONLY file allowed to write a colour as hex
 * (scripts/check-brand.mjs enforces it). CSS gets the same values through
 * src/index.css @theme; canvas code (share cards, clips) imports them from here.
 *
 * Spec: project doc boredgame/BRAND.md (v4). Each colour is a ramp of four, lit
 * from the top left: hi (light plane), base, lo (shade), deep (the plane underneath).
 */
export type Ramp = { hi: string; base: string; lo: string; deep: string };

export const RAMPS = {
  petal: { hi: "#FFEA5C", base: "#FFC81A", lo: "#FF9E0B", deep: "#E07A06" },
  sky:   { hi: "#78D5FF", base: "#1F9BFF", lo: "#1469E0", deep: "#0E4AB0" },
  leaf:  { hi: "#93E544", base: "#4CC22A", lo: "#23931F", deep: "#176E16" },
  ember: { hi: "#FF8F62", base: "#FF4B2B", lo: "#D22C1A", deep: "#A31D12" },
  grape: { hi: "#D995FF", base: "#A646F0", lo: "#7424C4", deep: "#551896" },
  gum:   { hi: "#FFA3CF", base: "#FF4FA0", lo: "#D62A7A", deep: "#A81C5E" },
  seed:  { hi: "#B7784A", base: "#7E4826", lo: "#56301A", deep: "#3E2211" },
} as const satisfies Record<string, Ramp>;
export type Hue = keyof typeof RAMPS;

/** Neutrals. Ink is a violet navy, never black; the ground is a cool sky-white. */
export const INK = "#231A3D";
export const PENCIL = "#5B5775";
export const GROUND = "#EAF5FF";
export const BOARD = "#FFFFFF";
export const MIST = "#E6EEF9";
export const HAIR = "#D3DCEF";

/** Letters on colour are ink, except on grape (4.4:1 white). */
export const onColour = (h: Hue) => (h === "grape" ? BOARD : INK);

/** Game families set a game's tile and card world. New games pick one. */
export const FAMILIES = { quiz: "sky", board: "leaf", puzzle: "grape", skill: "ember", party: "gum" } as const;
export type Family = keyof typeof FAMILIES;
export const familyRamp = (f: Family): Ramp => RAMPS[FAMILIES[f]];

/** Button roles (from Clash Royale's one-colour-one-job rule). */
export const ROLES = { main: "petal", join: "leaf", second: "sky", leave: "ember" } as const;

/** The sky clock. The phone's own hour picks the sky; neighbours blend over 30 minutes. */
export type SkyName = "morning" | "midday" | "golden" | "night";
export const SKIES: Record<SkyName, { from: number; to: number; stops: [string, string, string]; hill: [string, string]; light: { from: "left" | "above" | "right"; colour: string }; star: string }> = {
  morning: { from: 5, to: 11, stops: ["#FFE3B8", "#A8DDFF", "#6CC4FF"], hill: ["#8EDB5A", "#4CB02E"], light: { from: "left", colour: "#FFE9B0" }, star: "#FFE58A" },
  midday:  { from: 11, to: 17, stops: ["#8FDBFF", "#3FAEFF", "#1F8BF0"], hill: ["#93E544", "#4CC22A"], light: { from: "above", colour: "#FFFBE0" }, star: "#FFF3A0" },
  golden:  { from: 17, to: 20, stops: ["#FFC27A", "#FF8A5C", "#B55BD6"], hill: ["#7CC24A", "#3E8F2A"], light: { from: "right", colour: "#FFD08A" }, star: "#FFD166" },
  night:   { from: 20, to: 5, stops: ["#2A2466", "#1D1A52", "#120F36"], hill: ["#1F5A4A", "#123F35"], light: { from: "left", colour: "#AFC3FF" }, star: "#E8EEFF" },
};
export function skyAt(date = new Date()): SkyName {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "midday";
  if (h >= 17 && h < 20) return "golden";
  return "night";
}

/** Type. Bagel Fat One has one weight: never let the browser fake a bold. */
export const FONT = {
  display: '"Bagel Fat One", "Arial Rounded MT Bold", system-ui, sans-serif',
  text: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, -apple-system, sans-serif',
  mono: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, monospace',
} as const;

/** Soft shadow for UI surfaces (cards, sheets). The world has no outlines. */
export const LIFT = "0 10px 24px rgba(14,74,176,.16), 0 2px 0 rgba(14,74,176,.10)";
/** The outline that subjects (flower, pieces, badges, icons) carry. */
export const OUTLINE = INK;
