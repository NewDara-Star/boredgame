import type { Difficulty, RebusSpec, GameKey } from "@/shared/types/db";

/** The single runtime shape both games play against, whatever the source. */
export interface PlayItem {
  id: string;
  game: GameKey;
  render: "text" | "image";
  spec?: RebusSpec;
  imageUrl?: string;
  prompt?: string;
  choices?: string[];
  answer: string;
  altHint: string;
  charHint: string;
  difficulty: Difficulty;
  category: string;
}

export interface RoundResult {
  item: PlayItem;
  correct: boolean;
  given: string;
  msTaken: number;
  hintsUsed: number;
}
