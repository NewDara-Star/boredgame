import { motion } from "framer-motion";
import type { GameKey } from "@/shared/types/db";
import { PICTO_SEED } from "@/shared/data/picto";
import { PictoRenderer } from "@/features/picto/PictoRenderer";

export type RoomMode =
  | "race" | "squareoff" | "tictactoe" | "connect4" | "connect4trivia" | "memory"
  | "ballsort";

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
  /** How this game is set up in a room. `challenge` is what a move costs
      where the mode supports both — Square Off and Catapult Squares are the
      same mode and the same board, and only this tells them apart. Leave it
      out for a game where the question does not arise. */
  room: { mode: RoomMode; blurb: string; challenge?: "trivia" | "catapult" } | null;
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
    room: { mode: "squareoff", challenge: "trivia", blurb: "Tic-tac-toe. A square costs a right answer, and missing gives your opponent one shot at it." },
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
    slug: "memory", name: "Memory Match",
    tagline: "Turn two over. Keep the pairs you find.",
    badge: "Card game", bank: null, path: "/memory", chip: "bg-trivia text-surface",
    room: { mode: "memory", blurb: "Sixteen tiles, eight pairs. Find one and you go again." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        {[0, 1].map((r) => [0, 1].map((c) => (
          <rect key={`${r}-${c}`} x={12 + c * 40} y={12 + r * 40} width="32" height="32" rx="6"
            fill={r === 0 && c === 1 ? "var(--color-trivia)" : "var(--color-surface)"}
            stroke="var(--color-ink)" strokeWidth="4" />
        )))}
        <text x="28" y="38" textAnchor="middle" fontSize="20">⭐</text>
        <text x="68" y="78" textAnchor="middle" fontSize="20">⭐</text>
      </svg>
    ),
  },
  {
    slug: "ballsort", name: "Ball Sort",
    tagline: "Today's tubes, against the clock. Or race a friend.",
    badge: "Puzzle", bank: null, path: "/ballsort", chip: "bg-hot text-surface",
    room: { mode: "ballsort",
      blurb: "The same tubes on both screens, both of you at once. First to sort wins." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        <defs>
          <radialGradient id="bs-r" cx="36%" cy="30%" r="72%"><stop offset="0" stopColor="#FF8A96"/><stop offset=".4" stopColor="#E5233B"/><stop offset="1" stopColor="#8E0D1E"/></radialGradient>
          <radialGradient id="bs-b" cx="36%" cy="30%" r="72%"><stop offset="0" stopColor="#8FA4FF"/><stop offset=".4" stopColor="#2B4BFF"/><stop offset="1" stopColor="#15258F"/></radialGradient>
          <radialGradient id="bs-y" cx="36%" cy="30%" r="72%"><stop offset="0" stopColor="#FFE98A"/><stop offset=".4" stopColor="#FFD028"/><stop offset="1" stopColor="#B88A00"/></radialGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${16 + i * 26} 22 V 78 A 10 10 0 0 0 ${36 + i * 26} 78 V 22 Z`}
            fill="rgba(20,16,13,.05)" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" />
        ))}
        {[["bs-r", 0, 0], ["bs-b", 0, 1], ["bs-y", 0, 2], ["bs-b", 1, 0], ["bs-r", 1, 1], ["bs-y", 1, 2], ["bs-y", 2, 0], ["bs-r", 2, 2]]
          .map(([g, tube, k], n) => (
            <circle key={n} cx={26 + (tube as number) * 26} cy={74 - (k as number) * 17} r="8" fill={`url(#${g})`} />
          ))}
        <ellipse cx="34" cy="70" rx="3" ry="2" fill="#fff" opacity=".8" />
        <ellipse cx="60" cy="53" rx="3" ry="2" fill="#fff" opacity=".8" />
      </svg>
    ),
  },
  {
    slug: "catapultsquares", name: "Catapult Squares",
    tagline: "Land the shot, claim the square.",
    badge: "Board game", bank: null, path: "/catapultsquares", chip: "bg-good text-surface",
    room: { mode: "squareoff", challenge: "catapult", blurb: "Tic-tac-toe, but a square costs a shot rather than a right answer." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        <path d="M8 78 H92" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" />
        <path d="M14 78 Q46 8 84 74" fill="none" stroke="var(--color-ink)"
          strokeWidth="3" strokeDasharray="5 5" opacity="0.55" />
        <rect x="70" y="66" width="24" height="12" rx="3"
          fill="var(--color-good)" stroke="var(--color-ink)" strokeWidth="3" />
        <circle cx="18" cy="70" r="7" fill="var(--color-picto)"
          stroke="var(--color-ink)" strokeWidth="3" />
      </svg>
    ),
  },
  {
    slug: "connect4catapult", name: "Connect 4 Catapult",
    tagline: "Hit the target, drop the disc.",
    badge: "Board game", bank: null, path: "/connect4catapult", chip: "bg-good text-surface",
    room: { mode: "connect4trivia", challenge: "catapult", blurb: "Name a column, then land a shot to earn it." },
    Art: ({ size }) => (
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        <rect x="8" y="34" width="84" height="58" rx="10"
          fill="none" stroke="var(--color-ink)" strokeWidth="4" />
        {[0, 1, 2, 3].map((c) => [0, 1].map((r) => (
          <circle key={`${c}-${r}`} cx={20 + c * 20} cy={50 + r * 22} r="8"
            stroke="var(--color-ink)" strokeWidth="3"
            fill={(c === 2 && r === 1) ? "var(--color-picto)" : "var(--color-surface)"} />
        )))}
        <path d="M6 26 Q40 -6 78 22" fill="none" stroke="var(--color-good)"
          strokeWidth="4" strokeDasharray="5 4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    slug: "connect4trivia", name: "Connect 4 Trivia", tagline: "Answer right or the disc never drops.",
    badge: "Board game", bank: "trivia", path: "/connect4trivia", chip: "bg-hot text-surface",
    room: { mode: "connect4trivia", challenge: "trivia", blurb: "Name a column, answer a question. Get it wrong and you lose the turn — no second chances." },
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
