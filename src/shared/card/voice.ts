/**
 * What a result card says, in the sender's words.
 *
 * A card goes out twice: once as a brag for whoever sends it, once as an
 * invitation to whoever sees it. So the hook is first person ("I beat Tobi 3–1"),
 * the dare is aimed at the viewer, and the text that rides along with the image
 * carries the link back in. A loss is worth sending too: the flower is bored and
 * the dare asks for a rematch.
 */
import type { FlowerState } from "@/shared/brand/Sunflower";
import { ellipsize } from "./frame";

type Mark = "x" | "o";
interface Seat { mark: Mark; name: string; score: number }

export interface Voice {
  headline: string;
  dare: string;
  flower: FlowerState;
  /** goes out with the image; the link is added by shareResult */
  text: string;
}

const NAME = 14;
const dash = (a: number, b: number) => `${a}–${b}`;

/** "CONNECT 4 TRIVIA" -> "Connect 4 Trivia" */
export const gameName = (title: string) =>
  title.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

/** Where a viewer lands to play the same game. */
const PATHS: Record<string, string> = {
  "tic tac toe": "/tictactoe", "square off": "/squareoff", "catapult squares": "/catapultsquares",
  "connect 4": "/connect4", "connect 4 trivia": "/connect4trivia", "connect 4 catapult": "/connect4catapult",
  "memory match": "/memory", "ball sort": "/ballsort",
  "picto phrase": "/picto", "star trivia": "/trivia", "today's round": "/daily",
};
export const gamePath = (title: string) => PATHS[title.toLowerCase()] ?? "/play";
export const linkTo = (path: string) =>
  (typeof location === "undefined" ? "" : location.origin) + path;

/** Two people, one of whom may be me. */
export function matchVoice(title: string, a: Seat, b: Seat, me: Mark | null): Voice {
  const game = gameName(title);
  const n = (s: Seat) => ellipsize(s.name, NAME);
  if (a.score === b.score) {
    const other = me === "o" ? a : b;
    const who = me ? `with ${n(other)}` : `${n(a)} and ${n(b)}`;
    return {
      headline: me ? `${dash(a.score, b.score)} ${who}` : `${who}, ${dash(a.score, b.score)}`,
      dare: "Settle it?", flower: "awake",
      text: `${dash(a.score, b.score)} ${me ? `with ${other.name}` : `between ${a.name} and ${b.name}`} at ${game} on BoredGame. Settle it:`,
    };
  }
  const [w, l] = a.score > b.score ? [a, b] : [b, a];
  const score = dash(w.score, l.score);
  if (me === w.mark) return {
    headline: `I beat ${n(l)} ${score}`, dare: "Your move?", flower: "bloom",
    text: `I beat ${l.name} ${score} at ${game} on BoredGame. Your move:`,
  };
  if (me === l.mark) return {
    headline: `${n(w)} beat me ${score}`, dare: "Rematch?", flower: "bored",
    text: `${w.name} beat me ${score} at ${game}. Anyone want to get them back?`,
  };
  return {
    headline: `${n(w)} beat ${n(l)} ${score}`, dare: "Your move?", flower: "bloom",
    text: `${w.name} beat ${l.name} ${score} at ${game} on BoredGame. Your move:`,
  };
}

/** Me against the bot. */
export function botVoice(title: string, mine: number, its: number): Voice {
  const game = gameName(title);
  const score = mine >= its ? dash(mine, its) : dash(its, mine);
  if (mine === its) return {
    headline: `${score} with the bot`, dare: "Beat the bot?", flower: "awake",
    text: `${score} with the bot at ${game}. Can you beat it?`,
  };
  return mine > its
    ? { headline: `I beat the bot ${score}`, dare: "Beat the bot?", flower: "bloom",
        text: `I beat the bot ${score} at ${game} on BoredGame. Your turn:` }
    : { headline: `The bot got me ${score}`, dare: "Can you beat it?", flower: "bored",
        text: `The bot beat me ${score} at ${game}. Can you do better?` };
}
