/** Hand-written to match supabase/schema.sql. Regenerate with `supabase gen types` once the CLI is set up. */

export type GameKey = "picto" | "trivia";
export type Difficulty = "easy" | "medium" | "hard";
export type PubStatus = "draft" | "live" | "rejected";

/** A rebus drawn from data rather than uploaded as a picture. Rendered as SVG, so it scales anywhere. */
export interface RebusItem {
  text: string;
  /** centre position as a percentage of the square canvas */
  x: number;
  y: number;
  /** font size in canvas units (canvas is 100x100) */
  size?: number;
  /** exact rendered width in canvas units. Set it whenever two items share a row —
      without it, layout depends on font metrics you cannot predict, which is how
      words end up on top of each other. */
  w?: number;
  rotate?: number;
  weight?: number;
  /** letter-spacing in canvas units; negative tightens */
  spacing?: number;
  color?: string;
  font?: "sans" | "serif" | "mono";
  sup?: string;
  sub?: string;
  strike?: boolean;
  opacity?: number;
}

export interface RebusSpec {
  items: RebusItem[];
}

export interface Puzzle {
  id: number;
  game: GameKey;
  /** picto: "text" is drawn from `spec`, "image" from `image_url`. trivia rows are always "text" with no spec. */
  render: "text" | "image";
  spec: RebusSpec | null;
  image_url: string | null;
  prompt: string | null;
  choices: string[] | null;
  answer: string;
  alt_hint: string | null;
  char_hint: string | null;
  explanation: string | null;
  difficulty: Difficulty;
  category_id: number | null;
  status: PubStatus;
  created_by: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  game: GameKey | null;
}

export interface Profile {
  id: string;
  username: string;
  avatar: string | null;
  total_answered: number;
  total_correct: number;
  /** consecutive days played, advanced server-side by touch_streak() */
  streak: number;
  best_streak: number;
  /** YYYY-MM-DD, in whatever calendar the player's device was on */
  last_played: string | null;
  created_at: string;
}

export interface Attempt {
  id: number;
  user_id: string;
  puzzle_id: number;
  correct: boolean;
  ms_taken: number | null;
  created_at: string;
}

export type RoomStatus = "waiting" | "playing" | "finished" | "abandoned";

export interface Room {
  id: number;
  code: string;
  host_id: string;
  game: GameKey;
  status: RoomStatus;
  best_of: number;
  created_at: string;
}

export interface RoomPlayer {
  room_id: number;
  user_id: string;
  username: string;
  score: number;
  joined_at: string;
}

export interface RoomRound {
  id: number;
  room_id: number;
  puzzle_id: number;
  round_no: number;
  winner_id: string | null;
  started_at: string;
  ended_at: string | null;
}
