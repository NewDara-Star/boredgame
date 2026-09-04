import type { RebusItem } from "@/shared/types/db";

/**
 * Rebus puzzles as data. Each is drawn by PictoRenderer on a 100x100 canvas,
 * so adding a puzzle costs a few lines rather than an afternoon in Figma.
 * This was the actual reason the 2025 version only ever had five.
 */
export interface PictoSeed {
  slug: string;
  items: RebusItem[];
  answer: string;
  alt_hint: string;
  char_hint: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

const t = (text: string, x: number, y: number, extra: Partial<RebusItem> = {}): RebusItem =>
  ({ text, x, y, ...extra });

export const PICTO_SEED: PictoSeed[] = [
  { slug: "head-over-heels", items: [t("HEAD", 50, 34, { size: 15 }), t("HEELS", 50, 66, { size: 15 })],
    answer: "head over heels", alt_hint: "One word is sitting on top of another", char_hint: "3 words · 5th letter: o", difficulty: "easy", category: "Idioms" },

  { slug: "mind-over-matter", items: [t("MIND", 50, 34, { size: 15 }), t("MATTER", 50, 66, { size: 15 })],
    answer: "mind over matter", alt_hint: "The top word wins", char_hint: "3 words · starts with M, ends with R", difficulty: "easy", category: "Idioms" },

  { slug: "man-overboard", items: [t("MAN", 50, 34, { size: 16 }), t("BOARD", 50, 66, { size: 16 })],
    answer: "man overboard", alt_hint: "Somebody has gone into the water", char_hint: "2 words · 4th letter: o", difficulty: "easy", category: "Idioms" },

  { slug: "youre-under-arrest", items: [t("ARREST", 50, 34, { size: 14 }), t("YOU'RE", 50, 66, { size: 14 })],
    answer: "you are under arrest", alt_hint: "The bottom word is beneath the top one — and it's about you", char_hint: "Something a police officer says", difficulty: "medium", category: "Idioms" },

  { slug: "under-the-weather", items: [t("WEATHER", 50, 33, { size: 13 }), t("FEELING", 50, 67, { size: 13 })],
    answer: "under the weather", alt_hint: "How you feel is sitting below the sky", char_hint: "3 words · starts with U", difficulty: "medium", category: "Idioms" },

  { slug: "life-after-death", items: [t("DEATH", 27, 50, { size: 12, w: 37 }), t("LIFE", 73, 50, { size: 12, w: 30 })],
    answer: "life after death", alt_hint: "One word comes after the other, left to right", char_hint: "3 words · middle word is 5 letters", difficulty: "medium", category: "Idioms" },

  { slug: "good-afternoon", items: [t("NOON", 27, 50, { size: 12, w: 30 }), t("GOOD", 73, 50, { size: 12, w: 30 })],
    answer: "good afternoon", alt_hint: "Read the position, not the order", char_hint: "2 words · a greeting", difficulty: "medium", category: "Everyday" },

  { slug: "tricycle", items: [t("CYCLE", 18, 50, { size: 9, w: 28 }), t("CYCLE", 50, 50, { size: 9, w: 28 }), t("CYCLE", 82, 50, { size: 9, w: 28 })],
    answer: "tricycle", alt_hint: "Count them", char_hint: "1 word · 8 letters", difficulty: "easy", category: "Everyday" },

  { slug: "second-chance", items: [t("CHANCE", 26, 50, { size: 11, w: 41 }), t("CHANCE", 74, 50, { size: 11, w: 41 })],
    answer: "second chance", alt_hint: "Two of the same thing — which one matters?", char_hint: "2 words · 6 then 6", difficulty: "easy", category: "Idioms" },

  { slug: "forearm", items: [t("ARM", 14, 50, { size: 11, w: 20 }), t("ARM", 38, 50, { size: 11, w: 20 }), t("ARM", 62, 50, { size: 11, w: 20 }), t("ARM", 86, 50, { size: 11, w: 20 })],
    answer: "forearm", alt_hint: "Count them, then say it out loud", char_hint: "1 word · part of the body", difficulty: "medium", category: "Everyday" },

  { slug: "forget-it", items: [t("GET IT", 27, 32, { size: 10, w: 37 }), t("GET IT", 73, 32, { size: 10, w: 37 }), t("GET IT", 27, 68, { size: 10, w: 37 }), t("GET IT", 73, 68, { size: 10, w: 37 })],
    answer: "forget it", alt_hint: "Four of them. Say the number first", char_hint: "2 words · dismissive", difficulty: "medium", category: "Idioms" },

  { slug: "backward-glance", items: [t("ECNALG", 50, 50, { size: 16 })],
    answer: "backward glance", alt_hint: "Read it the other way", char_hint: "2 words · second word is 6 letters", difficulty: "medium", category: "Idioms" },

  { slug: "looking-back", items: [t("GNIKOOL", 50, 50, { size: 14 })],
    answer: "looking back", alt_hint: "The word has turned around", char_hint: "2 words · 7 then 4", difficulty: "medium", category: "Idioms" },

  { slug: "unfinished-symphony", items: [t("SYMPHON", 50, 50, { size: 15 })],
    answer: "unfinished symphony", alt_hint: "Something is missing from the end", char_hint: "2 words · classical music", difficulty: "hard", category: "Music" },

  { slug: "history-repeats", items: [t("HISTORY", 50, 34, { size: 13 }), t("HISTORY", 50, 66, { size: 13 })],
    answer: "history repeats itself", alt_hint: "It happened, and then it happened again", char_hint: "3 words · starts with H", difficulty: "medium", category: "Idioms" },

  { slug: "man-in-the-moon", items: [t("MO", 27, 50, { size: 14, w: 18 }), t("MAN", 50, 50, { size: 14, w: 26 }), t("ON", 73, 50, { size: 14, w: 18 })],
    answer: "man in the moon", alt_hint: "One word is sitting inside another", char_hint: "4 words · look up at night", difficulty: "hard", category: "Places" },

  { slug: "one-after-another", items: [t("ONE", 20, 50, { size: 13, w: 24 }), t("ANOTHER", 68, 50, { size: 11, w: 48 })],
    answer: "one after another", alt_hint: "Left to right, and the position is the clue", char_hint: "3 words · middle word is 5 letters", difficulty: "medium", category: "Idioms" },

  { slug: "small-world", items: [t("WORLD", 50, 50, { size: 6 })],
    answer: "small world", alt_hint: "The size of the word is the point", char_hint: "2 words · said when you bump into someone", difficulty: "easy", category: "Idioms" },

  { slug: "big-business", items: [t("BUSINESS", 50, 50, { size: 18, w: 90 })],
    answer: "big business", alt_hint: "The size of the word is the point", char_hint: "2 words · 3 then 8", difficulty: "easy", category: "Everyday" },

  { slug: "travel-overseas", items: [t("TRAVEL", 50, 33, { size: 13, w: 48 }), t("C C C C", 50, 67, { size: 13, w: 56 })],
    answer: "travel overseas", alt_hint: "The letters below sound like water", char_hint: "2 words · about going abroad", difficulty: "hard", category: "Places" },

  { slug: "seven-seas", items: [t("C C C C C C C", 50, 50, { size: 11, w: 88 })],
    answer: "seven seas", alt_hint: "Count the letters, then say the letter out loud", char_hint: "2 words · 5 then 4", difficulty: "medium", category: "Places" },

  { slug: "three-degrees-below-zero", items: [t("0", 50, 30, { size: 24 }), t("B.A.  M.A.  PhD", 50, 68, { size: 8, w: 74 })],
    answer: "three degrees below zero", alt_hint: "Qualifications underneath a number", char_hint: "4 words · about temperature", difficulty: "hard", category: "Everyday" },

  { slug: "scrambled-eggs", items: [t("G", 32, 44, { size: 18, rotate: -14 }), t("E", 46, 56, { size: 18, rotate: 8 }), t("S", 60, 43, { size: 18, rotate: -6 }), t("G", 73, 52, { size: 18, rotate: 15 })],
    answer: "scrambled eggs", alt_hint: "The word is scattered", char_hint: "2 words · 5th letter: m, 12th letter: g", difficulty: "hard", category: "Food" },

  { slug: "ice-cube", items: [t("ICE", 47, 50, { size: 26, font: "serif", sup: "3" })],
    answer: "ice cube", alt_hint: "A small number is doing the work", char_hint: "2 words · 3 then 4", difficulty: "medium", category: "Food" },

  { slug: "i-understand", items: [t("I", 50, 32, { size: 18 }), t("STAND", 50, 66, { size: 15 })],
    answer: "i understand", alt_hint: "One letter is above one word", char_hint: "2 words · means 'I get it'", difficulty: "medium", category: "Idioms" },

  { slug: "six-feet-underground", items: [t("GROUND", 50, 28, { size: 13 }), t("FEET FEET FEET", 50, 58, { size: 8 }), t("FEET FEET FEET", 50, 74, { size: 8 })],
    answer: "six feet underground", alt_hint: "Count what is below the ground", char_hint: "3 words · not a cheerful one", difficulty: "hard", category: "Idioms" },

  { slug: "broken-promise", items: [t("PROMISE", 50, 50, { size: 15, strike: true })],
    answer: "broken promise", alt_hint: "A line has been drawn through it", char_hint: "2 words · 6 then 7", difficulty: "easy", category: "Idioms" },

  { slug: "broken-heart", items: [t("HEART", 50, 50, { size: 18, strike: true })],
    answer: "broken heart", alt_hint: "A line has been drawn through it", char_hint: "2 words · 6 then 5", difficulty: "easy", category: "Idioms" },

  { slug: "paradise", items: [t("DICE", 26, 50, { size: 12, w: 30 }), t("DICE", 74, 50, { size: 12, w: 30 })],
    answer: "paradise", alt_hint: "Two of them — say what a set of two is called", char_hint: "1 word · 8 letters, somewhere lovely", difficulty: "hard", category: "Places" },

  { slug: "excuse-me", items: [t("X", 13, 50, { size: 15, w: 10 }), t("Q Q Q", 47, 50, { size: 12, w: 37 }), t("ME", 84, 50, { size: 13, w: 17 })],
    answer: "excuse me", alt_hint: "Say each letter out loud rather than reading it", char_hint: "2 words · polite interruption", difficulty: "hard", category: "Everyday" },

  { slug: "touchdown", items: [t("TOUCH", 50, 34, { size: 15 }), t("DOWN", 50, 66, { size: 15 })],
    answer: "touchdown", alt_hint: "Read the top, then where it sits", char_hint: "1 word · American football", difficulty: "easy", category: "Sport" },

  { slug: "just-under-the-wire", items: [t("WIRE", 50, 33, { size: 15 }), t("JUST", 50, 67, { size: 15 })],
    answer: "just under the wire", alt_hint: "Barely made it", char_hint: "4 words · about being on time", difficulty: "medium", category: "Idioms" },

  { slug: "reading-between-the-lines", items: [
      t("————————", 50, 26, { size: 11 }), t("READING", 50, 50, { size: 13 }), t("————————", 50, 74, { size: 11 })],
    answer: "reading between the lines", alt_hint: "Where is the word sitting?", char_hint: "4 words · about hidden meaning", difficulty: "medium", category: "Idioms" },

  { slug: "split-second", items: [t("SEC", 27, 50, { size: 14, w: 26 }), t("OND", 73, 50, { size: 14, w: 26 })],
    answer: "split second", alt_hint: "The word itself has been divided", char_hint: "2 words · a very short time", difficulty: "medium", category: "Everyday" },

  { slug: "downtown", items: [t("TOWN", 50, 70, { size: 15 })],
    answer: "downtown", alt_hint: "Position on the canvas is the clue", char_hint: "1 word · 8 letters, part of a city", difficulty: "medium", category: "Places" },

  { slug: "upside-down", items: [t("UPSIDE", 50, 50, { size: 15, rotate: 180 })],
    answer: "upside down", alt_hint: "The word is doing what it says", char_hint: "2 words · 6 then 4", difficulty: "easy", category: "Everyday" },
];
