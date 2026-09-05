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
  /** Other spellings that count. A puzzle has one answer and many ways to say
      it — "six feet under" for "six feet underground", and so on. */
  accept?: string[];
  /** Picto only. Trivia uses a runtime 50/50 instead — a letter count on four
      options usually identifies the answer outright. */
  altHint?: string;
  charHint?: string;
  /** Shown AFTER answering. The reason to play twice is finding out why. */
  explanation?: string;
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
