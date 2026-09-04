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

  { slug: "misunderstanding", items: [t("STANDING", 50, 34, { size: 12, w: 60 }), t("MIS", 50, 66, { size: 14, w: 26 })],
    answer: "misunderstanding", alt_hint: "One word sits beneath the other", char_hint: "1 word · what a row usually is", difficulty: "medium", category: "Idioms" },

  { slug: "water-under-the-bridge", items: [t("BRIDGE", 50, 33, { size: 14, w: 52 }), t("WATER", 50, 67, { size: 14, w: 44 })],
    answer: "water under the bridge", alt_hint: "Read the lower word's position", char_hint: "4 words · about letting things go", difficulty: "easy", category: "Idioms" },

  { slug: "all-over-the-world", items: [t("ALL", 50, 34, { size: 15, w: 28 }), t("WORLD", 50, 66, { size: 14, w: 44 })],
    answer: "all over the world", alt_hint: "The top word is sitting on the bottom one", char_hint: "4 words · everywhere", difficulty: "easy", category: "Places" },

  { slug: "long-underwear", items: [t("LONG", 50, 34, { size: 15, w: 37 }), t("WEAR", 50, 66, { size: 15, w: 37 })],
    answer: "long underwear", alt_hint: "One word is beneath the other", char_hint: "2 words · you put it on when it's cold", difficulty: "medium", category: "Everyday" },

  { slug: "play-on-words", items: [t("PLAY", 50, 34, { size: 15, w: 37 }), t("WORDS", 50, 66, { size: 14, w: 44 })],
    answer: "play on words", alt_hint: "The top word rests on the bottom one", char_hint: "3 words · what this whole game is", difficulty: "easy", category: "Idioms" },

  { slug: "eggs-over-easy", items: [t("EGGS", 50, 34, { size: 15, w: 37 }), t("EASY", 50, 66, { size: 15, w: 37 })],
    answer: "eggs over easy", alt_hint: "Position tells you the middle word", char_hint: "3 words · a breakfast order", difficulty: "easy", category: "Food" },

  { slug: "hand-over-hand", items: [t("HAND", 50, 34, { size: 15, w: 37 }), t("HAND", 50, 66, { size: 15, w: 37 })],
    answer: "hand over hand", alt_hint: "The same word twice, one above the other", char_hint: "3 words · how you climb a rope", difficulty: "easy", category: "Everyday" },

  { slug: "walking-on-air", items: [t("WALKING", 50, 34, { size: 12, w: 52 }), t("AIR", 50, 66, { size: 15, w: 28 })],
    answer: "walking on air", alt_hint: "The top word rests on the bottom one", char_hint: "3 words · how delight feels", difficulty: "easy", category: "Idioms" },

  { slug: "banana-split", items: [t("BAN", 30, 50, { size: 15, w: 28 }), t("ANA", 70, 50, { size: 15, w: 28 })],
    answer: "banana split", alt_hint: "One word has been divided in two", char_hint: "2 words · a dessert", difficulty: "medium", category: "Food" },

  { slug: "one-in-a-million", items: [t("MIL", 22, 50, { size: 15, w: 28 }), t("1", 50, 50, { size: 20, w: 8 }), t("ION", 78, 50, { size: 15, w: 28 })],
    answer: "one in a million", alt_hint: "A number has been placed inside a word", char_hint: "4 words · high praise", difficulty: "hard", category: "Idioms" },

  { slug: "time-after-time", items: [t("TIME", 28, 50, { size: 13, w: 32 }), t("TIME", 72, 50, { size: 13, w: 32 })],
    answer: "time after time", alt_hint: "The same word twice, left to right", char_hint: "3 words · again and again", difficulty: "medium", category: "Idioms" },

  { slug: "face-to-face", items: [t("FACE", 28, 50, { size: 13, w: 32 }), t("FACE", 72, 50, { size: 13, w: 32 })],
    answer: "face to face", alt_hint: "Two of the same, side by side", char_hint: "3 words · in person", difficulty: "easy", category: "Idioms" },

  { slug: "side-by-side", items: [t("SIDE", 28, 50, { size: 13, w: 32 }), t("SIDE", 72, 50, { size: 13, w: 32 })],
    answer: "side by side", alt_hint: "Two of the same, next to each other", char_hint: "3 words · the layout is the clue", difficulty: "easy", category: "Idioms" },

  { slug: "forgive", items: [t("GIVE", 14, 50, { size: 9, w: 22 }), t("GIVE", 38, 50, { size: 9, w: 22 }), t("GIVE", 62, 50, { size: 9, w: 22 }), t("GIVE", 86, 50, { size: 9, w: 22 })],
    answer: "forgive", alt_hint: "Count them, then say the number out loud", char_hint: "1 word · what you do after an apology", difficulty: "medium", category: "Idioms" },

  { slug: "about-face", items: [t("ECAF", 50, 50, { size: 17, w: 42 })],
    answer: "about face", alt_hint: "The word has been turned around", char_hint: "2 words · a sharp reversal", difficulty: "medium", category: "Idioms" },

  { slug: "broken-record", items: [t("RECORD", 50, 50, { size: 15, w: 56, strike: true })],
    answer: "broken record", alt_hint: "A line has been drawn through it", char_hint: "2 words · someone who repeats themselves", difficulty: "easy", category: "Music" },

  { slug: "broken-english", items: [t("ENGLISH", 50, 50, { size: 14, w: 60, strike: true })],
    answer: "broken english", alt_hint: "A line has been drawn through it", char_hint: "2 words · about halting speech", difficulty: "easy", category: "Everyday" },

  { slug: "turn-around", items: [t("AROUND", 50, 50, { size: 15, w: 56, rotate: 180 })],
    answer: "turn around", alt_hint: "The word is doing what it says", char_hint: "2 words · 4 then 6", difficulty: "easy", category: "Everyday" },

  { slug: "water-h-to-o", items: [t("H  I J K L M N  O", 50, 50, { size: 11, w: 86 })],
    answer: "water", alt_hint: "Read the first letter, then where the run ends", char_hint: "1 word · H to O", difficulty: "hard", category: "Food" },

  { slug: "i-see-you", items: [t("I", 32.5, 50, { size: 17, w: 5.1 }), t("C", 47.3, 50, { size: 17, w: 10.5 }), t("U", 64.8, 50, { size: 17, w: 10.5 })],
    answer: "i see you", alt_hint: "Say each letter out loud instead of reading it", char_hint: "3 words", difficulty: "easy", category: "Everyday" },

  { slug: "before", items: [t("B", 41.2, 50, { size: 17, w: 10.5 }), t("4", 58.8, 50, { size: 17, w: 10.5 })],
    answer: "before", alt_hint: "A letter and a number, both said aloud", char_hint: "1 word · 6 letters", difficulty: "easy", category: "Everyday" },

  { slug: "cucumber", items: [t("Q", 12.7, 50, { size: 17, w: 10.5 }), t("CUMBER", 58.8, 50, { size: 17, w: 67.7 })],
    answer: "cucumber", alt_hint: "The first letter is doing a syllable's work", char_hint: "1 word · a salad vegetable", difficulty: "medium", category: "Food" },

  { slug: "excel", items: [t("X", 41.8, 50, { size: 17, w: 10.5 }), t("L", 58.8, 50, { size: 17, w: 9.4 })],
    answer: "excel", alt_hint: "Two letters, said out loud", char_hint: "1 word · to do very well", difficulty: "medium", category: "Everyday" },

  { slug: "envy", items: [t("N", 41.2, 50, { size: 17, w: 10.5 }), t("V", 58.8, 50, { size: 17, w: 10.5 })],
    answer: "envy", alt_hint: "Two letters, said out loud", char_hint: "1 word · a deadly sin", difficulty: "medium", category: "Everyday" },

  { slug: "empty", items: [t("M", 41.6, 50, { size: 17, w: 15 }), t("T", 61, 50, { size: 17, w: 9.9 })],
    answer: "empty", alt_hint: "Two letters, said out loud", char_hint: "1 word · the opposite of full", difficulty: "medium", category: "Everyday" },

  { slug: "enemy", items: [t("N", 30.3, 50, { size: 17, w: 10.5 }), t("M", 50, 50, { size: 17, w: 15 }), t("E", 69.7, 50, { size: 17, w: 10.5 })],
    answer: "enemy", alt_hint: "Three letters, said out loud", char_hint: "1 word · not a friend", difficulty: "medium", category: "Everyday" },

  { slug: "energy", items: [t("N", 32.5, 50, { size: 17, w: 10.5 }), t("R", 50, 50, { size: 17, w: 10.5 }), t("G", 67.5, 50, { size: 17, w: 10.5 })],
    answer: "energy", alt_hint: "Three letters, said out loud", char_hint: "1 word · what you run on", difficulty: "medium", category: "Science" },

  { slug: "tennis", items: [t("10", 41.2, 50, { size: 17, w: 17.3 }), t("S", 62.2, 50, { size: 17, w: 10.5 })],
    answer: "tennis", alt_hint: "Say the number, then the letter", char_hint: "1 word · a racket sport", difficulty: "medium", category: "Sport" },

  { slug: "wonderful", items: [t("1", 15.5, 50, { size: 17, w: 6.8 }), t("DERFUL", 56.9, 50, { size: 17, w: 62.1 })],
    answer: "wonderful", alt_hint: "The number replaces a syllable", char_hint: "1 word · 9 letters", difficulty: "medium", category: "Everyday" },

  { slug: "together", items: [t("2", 15.2, 50, { size: 17, w: 10.5 }), t("GETHER", 58.8, 50, { size: 17, w: 62.6 })],
    answer: "together", alt_hint: "The number replaces a syllable", char_hint: "1 word · 8 letters", difficulty: "easy", category: "Everyday" },

  { slug: "tooth", items: [t("2", 36.3, 50, { size: 17, w: 10.5 }), t("TH", 58.8, 50, { size: 17, w: 20.4 })],
    answer: "tooth", alt_hint: "Say the number, then the letters", char_hint: "1 word · you have about 32", difficulty: "medium", category: "Everyday" },

  { slug: "great", items: [t("GR", 41.2, 50, { size: 17, w: 21.1 }), t("8", 64, 50, { size: 17, w: 10.5 })],
    answer: "great", alt_hint: "The number is the end of the word", char_hint: "1 word · 5 letters", difficulty: "easy", category: "Everyday" },

  { slug: "pig-in-a-blanket", items: [t("BLAN", 20.9, 50, { size: 13.2, w: 31.7 }), t("PIG", 53.9, 50, { size: 13.2, w: 20.3 }), t("KET", 83, 50, { size: 13.2, w: 24 })],
    answer: "pig in a blanket", alt_hint: "One word has been placed inside another", char_hint: "4 words · something wrapped", difficulty: "medium", category: "Food" },

  { slug: "cat-in-the-bag", items: [t("B", 17, 50, { size: 17, w: 10.5 }), t("CAT", 44.7, 50, { size: 17, w: 30.9 }), t("AG", 77.7, 50, { size: 17, w: 21.1 })],
    answer: "cat in the bag", alt_hint: "One word has been placed inside another", char_hint: "4 words · a secret, nearly out", difficulty: "medium", category: "Idioms" },

  { slug: "fly-in-the-ointment", items: [t("OINT", 17.2, 50, { size: 11.5, w: 24.4 }), t("FLY", 46.7, 50, { size: 11.5, w: 20.6 }), t("MENT", 79.5, 50, { size: 11.5, w: 31 })],
    answer: "fly in the ointment", alt_hint: "One word has been placed inside another", char_hint: "4 words · the one thing spoiling it", difficulty: "hard", category: "Idioms" },

  { slug: "ace-in-the-hole", items: [t("H", 12, 50, { size: 17, w: 10.5 }), t("ACE", 40.1, 50, { size: 17, w: 31.6 }), t("OLE", 78.1, 50, { size: 17, w: 30.4 })],
    answer: "ace in the hole", alt_hint: "One word has been placed inside another", char_hint: "4 words · a hidden advantage", difficulty: "medium", category: "Idioms" },

  { slug: "bee-in-your-bonnet", items: [t("BON", 17.8, 50, { size: 13.7, w: 25.5 }), t("BEE", 50.3, 50, { size: 13.7, w: 25.5 }), t("NET", 82.5, 50, { size: 13.7, w: 25 })],
    answer: "bee in your bonnet", alt_hint: "One word has been placed inside another", char_hint: "4 words · an obsession", difficulty: "hard", category: "Idioms" },

  { slug: "stitch-in-time", items: [t("TI", 10.9, 50, { size: 13.3, w: 11.7 }), t("STITCH", 45.9, 50, { size: 13.3, w: 44.3 }), t("ME", 85, 50, { size: 13.3, w: 20 })],
    answer: "a stitch in time", alt_hint: "One word has been placed inside another", char_hint: "4 words · saves nine", difficulty: "medium", category: "Idioms" },

  { slug: "storm-in-a-teacup", items: [t("TEA", 14.9, 50, { size: 10.9, w: 19.8 }), t("STORM", 49.8, 50, { size: 10.9, w: 36 }), t("CUP", 84.9, 50, { size: 10.9, w: 20.2 })],
    answer: "storm in a teacup", alt_hint: "One word has been placed inside another", char_hint: "4 words · a fuss over nothing", difficulty: "medium", category: "Idioms" },

  { slug: "head-in-the-clouds", items: [t("CLO", 16.1, 50, { size: 12.4, w: 22.2 }), t("HEAD", 49.6, 50, { size: 12.4, w: 30.7 }), t("UDS", 83.5, 50, { size: 12.4, w: 23.1 })],
    answer: "head in the clouds", alt_hint: "One word has been placed inside another", char_hint: "4 words · not paying attention", difficulty: "medium", category: "Idioms" },

  { slug: "foot-in-mouth", items: [t("MO", 14.9, 50, { size: 13.2, w: 19.8 }), t("FOOT", 47.9, 50, { size: 13.2, w: 32.2 }), t("UTH", 83, 50, { size: 13.2, w: 24 })],
    answer: "foot in mouth", alt_hint: "One word has been placed inside another", char_hint: "3 words · said the wrong thing", difficulty: "medium", category: "Idioms" },

  { slug: "spanner-in-the-works", items: [t("WOR", 15.5, 50, { size: 9.9, w: 20.9 }), t("SPANNER", 54.3, 50, { size: 9.9, w: 42.8 }), t("KS", 88.9, 50, { size: 9.9, w: 12.2 })],
    answer: "spanner in the works", alt_hint: "One word has been placed inside another", char_hint: "4 words · something that ruins the plan", difficulty: "hard", category: "Idioms" },

  { slug: "feeling-blue", items: [t("FEELING", 50, 50, { size: 20, w: 79, color: "#4B5BD6" })],
    answer: "feeling blue", alt_hint: "The colour is the clue, not the word", char_hint: "2 words · low spirits", difficulty: "easy", category: "Idioms" },

  { slug: "green-with-envy", items: [t("ENVY", 50, 50, { size: 20, w: 49.6, color: "#17914B" })],
    answer: "green with envy", alt_hint: "The colour is the clue", char_hint: "3 words · jealous", difficulty: "easy", category: "Idioms" },

  { slug: "caught-red-handed", items: [t("HANDED", 50, 50, { size: 20, w: 74.4, color: "#D93A34" })],
    answer: "caught red handed", alt_hint: "The colour is the clue", char_hint: "3 words · caught in the act", difficulty: "medium", category: "Idioms" },

  { slug: "out-of-the-blue", items: [t("OUT", 50, 50, { size: 20, w: 36.4, color: "#4B5BD6" })],
    answer: "out of the blue", alt_hint: "The colour is the clue", char_hint: "4 words · completely unexpected", difficulty: "medium", category: "Idioms" },

  { slug: "black-sheep", items: [t("SHEEP", 50, 50, { size: 20, w: 62, color: "#191510" })],
    answer: "black sheep", alt_hint: "The colour is the clue", char_hint: "2 words · the odd one in a family", difficulty: "easy", category: "Idioms" },

  { slug: "red-tape", items: [t("TAPE", 50, 50, { size: 20, w: 48.8, color: "#D93A34" })],
    answer: "red tape", alt_hint: "The colour is the clue", char_hint: "2 words · bureaucracy", difficulty: "easy", category: "Everyday" },

  { slug: "green-thumb", items: [t("THUMB", 50, 50, { size: 20, w: 66.4, color: "#17914B" })],
    answer: "green thumb", alt_hint: "The colour is the clue", char_hint: "2 words · a knack for plants", difficulty: "easy", category: "Everyday" },

  { slug: "blueprint", items: [t("PRINT", 50, 50, { size: 20, w: 54.8, color: "#4B5BD6" })],
    answer: "blueprint", alt_hint: "The colour is the clue", char_hint: "1 word · a technical drawing", difficulty: "easy", category: "Design" },

  { slug: "green-light", items: [t("LIGHT", 50, 50, { size: 20, w: 53.4, color: "#17914B" })],
    answer: "green light", alt_hint: "The colour is the clue", char_hint: "2 words · permission to go", difficulty: "easy", category: "Everyday" },

  { slug: "red-alert", items: [t("ALERT", 50, 50, { size: 20, w: 59.8, color: "#D93A34" })],
    answer: "red alert", alt_hint: "The colour is the clue", char_hint: "2 words · highest urgency", difficulty: "easy", category: "Everyday" },

  { slug: "fading-memory", items: [t("MEMORY", 50, 50, { size: 20, w: 84.8, opacity: 0.25 })],
    answer: "fading memory", alt_hint: "The word is barely there", char_hint: "2 words · what you can't quite recall", difficulty: "medium", category: "Everyday" },

  { slug: "fade-away", items: [t("AWAY", 50, 50, { size: 20, w: 54.8, opacity: 0.25 })],
    answer: "fade away", alt_hint: "The word is barely there", char_hint: "2 words · 4 then 4", difficulty: "medium", category: "Music" },

  { slug: "noel", items: [t("J K M N O", 50, 50, { size: 16, w: 69.4 })],
    answer: "noel", alt_hint: "Read the letters in order — one is missing", char_hint: "1 word · a Christmas carol", difficulty: "hard", category: "Music" },

  { slug: "unfinished-business", items: [t("BUSINES", 50, 50, { size: 20, w: 80.4 })],
    answer: "unfinished business", alt_hint: "Something is missing from the end", char_hint: "2 words · what you left undone", difficulty: "medium", category: "Everyday" },

  { slug: "overtime", items: [t("TIME", 50, 14, { size: 15, w: 37 })],
    answer: "overtime", alt_hint: "Where the word sits is the clue", char_hint: "1 word · extra hours", difficulty: "medium", category: "Everyday" },

  { slug: "overhead", items: [t("HEAD", 50, 14, { size: 15, w: 37 })],
    answer: "overhead", alt_hint: "Where the word sits is the clue", char_hint: "1 word · above you", difficulty: "medium", category: "Everyday" },

  { slug: "underline", items: [t("LINE", 50, 86, { size: 15, w: 37 })],
    answer: "underline", alt_hint: "Where the word sits is the clue", char_hint: "1 word · 9 letters", difficulty: "easy", category: "Design" },

  { slug: "above-board", items: [t("BOARD", 50, 14, { size: 14, w: 43 })],
    answer: "above board", alt_hint: "Where the word sits is the clue", char_hint: "2 words · honest and open", difficulty: "medium", category: "Idioms" },

  { slug: "small-talk", items: [t("TALK", 50, 50, { size: 6, w: 14.2 })],
    answer: "small talk", alt_hint: "The size of the word is the point", char_hint: "2 words · chat about nothing", difficulty: "easy", category: "Everyday" },

  { slug: "big-deal", items: [t("DEAL", 50, 50, { size: 22, w: 53 })],
    answer: "big deal", alt_hint: "The size of the word is the point", char_hint: "2 words · 3 then 4", difficulty: "easy", category: "Everyday" },

  { slug: "small-print", items: [t("PRINT", 50, 50, { size: 6, w: 16.4 })],
    answer: "small print", alt_hint: "The size of the word is the point", char_hint: "2 words · where the catch hides", difficulty: "easy", category: "Design" },

  { slug: "big-bang", items: [t("BANG", 50, 50, { size: 22, w: 54.6 })],
    answer: "big bang", alt_hint: "The size of the word is the point", char_hint: "2 words · how it all started", difficulty: "easy", category: "Science" },

  { slug: "square-feet", items: [t("FEET", 50, 50, { size: 20, w: 48.8, sup: "2" })],
    answer: "square feet", alt_hint: "A small number is doing the work", char_hint: "2 words · a unit of area", difficulty: "medium", category: "Maths" },

  { slug: "square-meal", items: [t("MEAL", 50, 50, { size: 20, w: 53.4, sup: "2" })],
    answer: "square meal", alt_hint: "A small number is doing the work", char_hint: "2 words · a proper dinner", difficulty: "medium", category: "Food" },

  { slug: "chip-on-your-shoulder", items: [t("CHIP", 50, 34, { size: 15, w: 32.4 }), t("SHOULDER", 50, 66, { size: 15, w: 73.4 })],
    answer: "chip on your shoulder", alt_hint: "The top word rests on the bottom one", char_hint: "4 words · a grudge", difficulty: "medium", category: "Idioms" },

  { slug: "cards-on-the-table", items: [t("CARDS", 50, 34, { size: 15, w: 46.5 }), t("TABLE", 50, 66, { size: 15, w: 44.9 })],
    answer: "cards on the table", alt_hint: "The top word rests on the bottom one", char_hint: "4 words · being open", difficulty: "easy", category: "Idioms" },

  { slug: "grace-under-pressure", items: [t("PRESSURE", 50, 34, { size: 15, w: 74.4 }), t("GRACE", 50, 66, { size: 15, w: 46.5 })],
    answer: "grace under pressure", alt_hint: "Read the lower word's position", char_hint: "3 words · composure when it's hard", difficulty: "medium", category: "Idioms" },
];
