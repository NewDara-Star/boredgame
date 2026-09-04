import { motion } from "framer-motion";
import type { GameKey } from "@/shared/types/db";
import { PICTO_SEED } from "@/shared/data/picto";
import { PictoRenderer } from "@/features/picto/PictoRenderer";

export type RoomMode = "race" | "squareoff";

export interface GameDef {
  slug: string;
  name: string;
  tagline: string;
  badge: string;
  /** which puzzle bank it draws on — decides whether it has any content live */
  bank: GameKey;
  path: string;
  /** a tailwind bg-* class for the badge */
  chip: string;
  /** how it plays in a room, or null if it is solo only */
  room: { mode: RoomMode; blurb: string } | null;
  /** Sized in pixels, never in percentages: a percentage-sized SVG inside a
      centring container has no definite box to resolve against and blows the
      card apart. Every caller passes an explicit size. */
  Art: (p: { size: number }) => JSX.Element;
}

/**
 * One entry per game, and the single place a game is declared. Before this,
 * adding a game meant editing the nav, the home page, the router and the room
 * lobby, and the bottom bar had one tab per game — which works at three and
 * falls over at six, never mind five hundred.
 */
export const GAMES: GameDef[] = [
  {
    slug: "picto", name: "Picto Phrase", tagline: "Read the picture, name the phrase.",
    badge: "Word puzzle", bank: "picto", path: "/picto", chip: "bg-picto text-surface",
    room: { mode: "race", blurb: "Same rebus on both screens. First correct answer takes the round." },
    Art: ({ size }) => {
      // Only the sparse ones. A six-item rebus at 62px is noise, not a preview —
      // the card is meant to say "word puzzle", not pose one.
      const simple = PICTO_SEED.filter((t) => t.items.length <= 3);
      const pool = simple.length ? simple : PICTO_SEED;
      const teaser = pool[Math.floor(Math.random() * pool.length)];
      return (
        <div className="text-picto shrink-0" style={{ width: size, height: size }}>
          <PictoRenderer spec={{ items: teaser.items }} animate seed={teaser.slug} />
        </div>
      );
    },
  },
  {
    slug: "trivia", name: "Star Trivia", tagline: "Four options, one right, ten questions.",
    badge: "Quiz", bank: "trivia", path: "/trivia", chip: "bg-trivia text-surface",
    room: { mode: "race", blurb: "Same question on both screens. First correct answer takes the round." },
    Art: ({ size }) => (
      <motion.span className="leading-none text-trivia block text-center shrink-0"
        style={{ fontSize: size * 0.86, width: size, height: size }}
        animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}>★</motion.span>
    ),
  },
  {
    slug: "squareoff", name: "Square Off", tagline: "Answer right to claim a square.",
    badge: "Board game", bank: "trivia", path: "/squareoff", chip: "bg-hot text-surface",
    room: { mode: "squareoff", blurb: "Tic-tac-toe. A square costs a right answer, and missing gives your opponent one shot at it." },
    Art: ({ size }) => (
      <motion.svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0"
        animate={{ rotate: [0, 4, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}>
        <g stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M36 12 V88 M64 12 V88 M12 36 H88 M12 64 H88" />
        </g>
        <g strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M18 18 L30 30 M30 18 L18 30" stroke="var(--color-picto)" />
          <circle cx="50" cy="50" r="9" stroke="var(--color-trivia)" />
          <path d="M70 70 L82 82 M82 70 L70 82" stroke="var(--color-picto)" />
        </g>
      </motion.svg>
    ),
  },
];

export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug) ?? null;

/** The ones that can be played against another person, for the room lobby. */
export const ROOM_GAMES = GAMES.filter((g): g is GameDef & { room: NonNullable<GameDef["room"]> } => !!g.room);
