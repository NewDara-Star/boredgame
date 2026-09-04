import type { RebusItem } from "@/shared/types/db";

export interface DraftPuzzle {
  game: "picto" | "trivia";
  render: "text" | "image";
  items: RebusItem[];
  imageUrl: string;
  prompt: string;
  choices: string[];
  answer: string;
  altHint: string;
  charHint: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

export type Errors = Partial<Record<keyof DraftPuzzle, string>>;

/** Rejects the exact junk the 2025 review modal waved through: "aaa", "hdghg", "jfhcgh". */
const LOW_EFFORT = /^(.)\1*$/;              // aaa, ....
const NO_VOWEL   = /^[^aeiou\s]+$/i;        // jfhcgh, hdghg

function looksLikeJunk(s: string): boolean {
  const t = s.trim();
  if (t.length < 3) return true;
  if (LOW_EFFORT.test(t.replace(/\s/g, ""))) return true;
  if (t.length < 12 && NO_VOWEL.test(t.replace(/\s/g, ""))) return true;
  return false;
}

export function validate(d: DraftPuzzle): Errors {
  const e: Errors = {};

  if (d.answer.trim().length < 2) e.answer = "An answer is required.";
  else if (looksLikeJunk(d.answer)) e.answer = "That doesn't look like a real answer.";

  if (d.altHint.trim().length < 8) e.altHint = "Give a real description — at least 8 characters.";
  else if (looksLikeJunk(d.altHint)) e.altHint = "That reads as placeholder text.";

  if (d.charHint.trim().length < 3) e.charHint = "Give a letter or length hint.";
  else if (looksLikeJunk(d.charHint)) e.charHint = "That reads as placeholder text.";

  if (!d.category) e.category = "Pick a category.";

  if (d.game === "picto") {
    if (d.render === "image" && !d.imageUrl.trim()) e.imageUrl = "Upload or paste an image URL.";
    if (d.render === "text" && d.items.filter((i) => i.text.trim()).length === 0)
      e.items = "Add at least one piece of text to the canvas.";
  } else {
    if (d.prompt.trim().length < 10) e.prompt = "Write the question out in full.";
    const filled = d.choices.filter((c) => c.trim());
    if (filled.length !== 4) e.choices = "All four options are required.";
    else if (new Set(filled.map((c) => c.toLowerCase())).size !== 4) e.choices = "Options must be different from each other.";
    else if (!filled.some((c) => c.trim() === d.answer.trim())) e.answer = "The answer must be one of the four options.";
  }

  return e;
}

export const isValid = (e: Errors) => Object.keys(e).length === 0;
