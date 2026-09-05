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
  /** Signed in anonymously — playing, but not on the leaderboard yet. */
  is_guest: boolean;
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

export type Challenge = "trivia" | "catapult";

export interface Room {
  id: number;
  code: string;
  host_id: string;
  game: GameKey;
  /** 'race' is the original first-correct-answer-wins; the rest are boards.
      Kept in step by hand with the rooms_mode_check constraint and with
      RoomMode in features/play/registry. */
  mode: "race" | "squareoff" | "tictactoe" | "connect4" | "connect4trivia";
  /** null means every category; stored on the room so both players share a pool */
  categories: string[] | null;
  /** null means every level. Rooms drew from the whole bank before this existed,
      so one trivia question in five was hard whoever was sitting there. */
  difficulty: string[] | null;
  /** What a move costs: answering a question, or landing a shot. Trivia is a
      knowledge test, which an eight-year-old loses to an adult at any setting. */
  challenge: Challenge;
  status: RoomStatus;
  best_of: number;
  /** seats. Both game modes are two-player, but the cap is data, not an assumption. */
  capacity: number;
  created_at: string;
}

export interface RoomPlayer {
  room_id: number;
  user_id: string;
  username: string;
  score: number;
  /** agreed to the current setup; any settings change clears it */
  ready: boolean;
  /** heartbeat, so "they have gone" is knowable rather than inferred */
  last_seen: string;
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
