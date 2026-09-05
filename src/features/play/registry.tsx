import { motion } from "framer-motion";
import type { GameKey } from "@/shared/types/db";
import { PICTO_SEED } from "@/shared/data/picto";
import { PictoRenderer } from "@/features/picto/PictoRenderer";

export type RoomMode = "race" | "squareoff" | "tictactoe" | "connect4" | "connect4trivia";

export interface GameDef {
  slug: string;
  name: string;
  tagline: string;
  badge: string;
  /** Which puzzle bank it draws on, or null for a pure board game. A null bank
      is not an empty bank: Tic Tac Toe is never waiting for content. */
  bank: GameKey | null;
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
  {
    slug: "tictactoe", name: "Tic Tac Toe", tagline: "Three in a row. No questions asked.",
    badge: "Board game", bank: null, path: "/tictactoe", chip: "bg-sand text-ink",
    room: { mode: "tictactoe", blurb: "The plain game. Take a square, first to three in a row." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        <g stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M36 12 V88 M64 12 V88 M12 36 H88 M12 64 H88" />
        </g>
        <g strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M18 18 L30 30 M30 18 L18 30" stroke="var(--color-picto)" />
          <circle cx="50" cy="50" r="9" stroke="var(--color-trivia)" />
          <path d="M70 18 L82 30 M82 18 L70 30" stroke="var(--color-picto)" />
        </g>
      </svg>
    ),
  },
  {
    slug: "connect4", name: "Connect 4", tagline: "Drop a disc, line up four.",
    badge: "Board game", bank: null, path: "/connect4", chip: "bg-sand text-ink",
    room: { mode: "connect4", blurb: "The plain game. Tap a column, the disc falls, four in a row wins." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        <rect x="8" y="20" width="84" height="72" rx="10"
          fill="none" stroke="var(--color-ink)" strokeWidth="4" />
        {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => {
          const filled = (c === 1 && r === 2) || (c === 2 && r === 2) || (c === 2 && r === 1);
          const mine = c === 2;
          return (
            <circle key={`${c}-${r}`} cx={20 + c * 20} cy={34 + r * 20} r="7.5"
              stroke="var(--color-ink)" strokeWidth="3"
              fill={filled ? (mine ? "var(--color-picto)" : "var(--color-trivia)") : "var(--color-surface)"} />
          );
        }))}
      </svg>
    ),
  },
  {
    slug: "connect4trivia", name: "Connect 4 Trivia", tagline: "Answer right or the disc never drops.",
    badge: "Board game", bank: "trivia", path: "/connect4trivia", chip: "bg-hot text-surface",
    room: { mode: "connect4trivia", blurb: "Name a column, answer a question. Get it wrong and you lose the turn — no second chances." },
    Art: ({ size }) => (
      <motion.svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0"
        animate={{ rotate: [0, 3, -3, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}>
        <rect x="8" y="28" width="84" height="64" rx="10"
          fill="none" stroke="var(--color-ink)" strokeWidth="4" />
        {[0, 1, 2, 3].map((c) => [0, 1].map((r) => {
          const filled = (c === 1 && r === 1) || (c === 2 && r === 1);
          return (
            <circle key={`${c}-${r}`} cx={20 + c * 20} cy={48 + r * 22} r="8"
              stroke="var(--color-ink)" strokeWidth="3"
              fill={filled ? (c === 2 ? "var(--color-picto)" : "var(--color-trivia)") : "var(--color-surface)"} />
          );
        }))}
        <text x="60" y="22" textAnchor="middle" fontSize="30" fontWeight="700"
          fill="var(--color-hot)" fontFamily="Fredoka, system-ui, sans-serif">?</text>
      </motion.svg>
    ),
  },
];

export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug) ?? null;

/** The ones that can be played against another person, for the room lobby. */
export const ROOM_GAMES = GAMES.filter((g): g is GameDef & { room: NonNullable<GameDef["room"]> } => !!g.room);
