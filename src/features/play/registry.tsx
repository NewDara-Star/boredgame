import { GameTile } from "@/shared/brand/tiles";
import type { Family } from "@/shared/brand/tokens";
import type { GameKey } from "@/shared/types/db";

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
  /** The game's family sets its tile and share-card colour (BRAND.md, "Game families"). */
  family: Family;
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
    badge: "Word puzzle", bank: "picto", path: "/picto", chip: "bg-sky text-ink",
    room: { mode: "race", blurb: "Same rebus on both screens. First correct answer takes the round." },
    family: "quiz",
    Art: ({ size }) => <GameTile slug="picto" size={size} label="Picto Phrase" />,
  },
  {
    slug: "trivia", name: "Star Trivia", tagline: "Four options, one right, ten questions.",
    badge: "Quiz", bank: "trivia", path: "/trivia", chip: "bg-sky text-ink",
    room: { mode: "race", blurb: "Same question on both screens. First correct answer takes the round." },
    family: "quiz",
    Art: ({ size }) => <GameTile slug="trivia" size={size} label="Star Trivia" />,
  },
  {
    slug: "squareoff", name: "Square Off", tagline: "Answer right to claim a square.",
    badge: "Board game", bank: "trivia", path: "/squareoff", chip: "bg-leaf text-ink",
    room: { mode: "squareoff", challenge: "trivia", blurb: "Tic-tac-toe. A square costs a right answer, and missing gives your opponent one shot at it." },
    family: "board",
    Art: ({ size }) => <GameTile slug="squareoff" size={size} label="Square Off" />,
  },
  {
    slug: "tictactoe", name: "Tic Tac Toe", tagline: "Three in a row. No questions asked.",
    badge: "Board game", bank: null, path: "/tictactoe", chip: "bg-leaf text-ink",
    room: { mode: "tictactoe", blurb: "The plain game. Take a square, first to three in a row." },
    family: "board",
    Art: ({ size }) => <GameTile slug="tictactoe" size={size} label="Tic Tac Toe" />,
  },
  {
    slug: "connect4", name: "Connect 4", tagline: "Drop a disc, line up four.",
    badge: "Board game", bank: null, path: "/connect4", chip: "bg-leaf text-ink",
    room: { mode: "connect4", blurb: "The plain game. Tap a column, the disc falls, four in a row wins." },
    family: "board",
    Art: ({ size }) => <GameTile slug="connect4" size={size} label="Connect 4" />,
  },
  {
    slug: "memory", name: "Memory Match",
    tagline: "Turn two over. Keep the pairs you find.",
    badge: "Card game", bank: null, path: "/memory", chip: "bg-grape text-board",
    room: { mode: "memory", blurb: "Sixteen tiles, eight pairs. Find one and you go again." },
    family: "puzzle",
    Art: ({ size }) => <GameTile slug="memory" size={size} label="Memory Match" />,
  },
  {
    slug: "ballsort", name: "Ball Sort",
    tagline: "Today's tubes, against the clock. Or race a friend.",
    badge: "Puzzle", bank: null, path: "/ballsort", chip: "bg-grape text-board",
    room: { mode: "ballsort",
      blurb: "The same tubes on both screens, both of you at once. First to sort wins." },
    family: "puzzle",
    Art: ({ size }) => <GameTile slug="ballsort" size={size} label="Ball Sort" />,
  },
  {
    slug: "catapultsquares", name: "Catapult Squares",
    tagline: "Land the shot, claim the square.",
    badge: "Board game", bank: null, path: "/catapultsquares", chip: "bg-ember text-ink",
    room: { mode: "squareoff", challenge: "catapult", blurb: "Tic-tac-toe, but a square costs a shot rather than a right answer." },
    family: "skill",
    Art: ({ size }) => <GameTile slug="catapultsquares" size={size} label="Catapult Squares" />,
  },
  {
    slug: "connect4catapult", name: "Connect 4 Catapult",
    tagline: "Hit the target, drop the disc.",
    badge: "Board game", bank: null, path: "/connect4catapult", chip: "bg-ember text-ink",
    room: { mode: "connect4trivia", challenge: "catapult", blurb: "Name a column, then land a shot to earn it." },
    family: "skill",
    Art: ({ size }) => <GameTile slug="connect4catapult" size={size} label="Connect 4 Catapult" />,
  },
  {
    slug: "connect4trivia", name: "Connect 4 Trivia", tagline: "Answer right or the disc never drops.",
    badge: "Board game", bank: "trivia", path: "/connect4trivia", chip: "bg-leaf text-ink",
    room: { mode: "connect4trivia", challenge: "trivia", blurb: "Name a column, answer a question. Get it wrong and you lose the turn — no second chances." },
    family: "board",
    Art: ({ size }) => <GameTile slug="connect4trivia" size={size} label="Connect 4 Trivia" />,
  },
];

/** The ones that can be played against another person, for the room lobby. */
export const ROOM_GAMES = GAMES.filter((g): g is GameDef & { room: NonNullable<GameDef["room"]> } => !!g.room);
