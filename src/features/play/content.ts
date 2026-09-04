import { supabase } from "@/shared/lib/supabase";
import { PICTO_SEED } from "@/shared/data/picto";
import { TRIVIA_SEED } from "@/shared/data/trivia";
import type { Puzzle, GameKey } from "@/shared/types/db";
import type { PlayItem } from "./types";

function fromSeedPicto(): PlayItem[] {
  return PICTO_SEED.map((p) => ({
    id: p.slug,
    game: "picto" as const,
    render: "text" as const,
    spec: { items: p.items },
    answer: p.answer,
    altHint: p.alt_hint,
    charHint: p.char_hint,
    difficulty: p.difficulty,
    category: p.category,
  }));
}

function fromSeedTrivia(): PlayItem[] {
  return TRIVIA_SEED.map((q) => ({
    id: q.slug,
    game: "trivia" as const,
    render: "text" as const,
    prompt: q.prompt,
    choices: q.choices.slice(),
    answer: q.choices[0],
    altHint: q.alt_hint,
    charHint: q.char_hint,
    difficulty: q.difficulty,
    category: q.category,
  }));
}

function fromRow(row: Puzzle): PlayItem {
  return {
    id: String(row.id),
    game: row.game,
    render: row.render,
    spec: row.spec ?? undefined,
    imageUrl: row.image_url ?? undefined,
    prompt: row.prompt ?? undefined,
    choices: row.choices ?? undefined,
    answer: row.answer,
    altHint: row.alt_hint,
    charHint: row.char_hint,
    difficulty: row.difficulty,
    category: "",
  };
}

/**
 * Database first, bundled content as the fallback. The app is fully playable
 * before Supabase exists, which is what makes it testable on day one.
 */
export async function loadContent(game: GameKey): Promise<PlayItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("puzzles")
      .select("*")
      .eq("game", game)
      .eq("status", "live");
    if (!error && data && data.length > 0) return (data as Puzzle[]).map(fromRow);
  }
  return game === "picto" ? fromSeedPicto() : fromSeedTrivia();
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
