import { supabase } from "@/shared/lib/supabase";
import { shuffleSeeded } from "@/shared/lib/shuffle";
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
    choices: shuffleSeeded(q.choices, q.slug),
    answer: q.choices[0],
    altHint: q.alt_hint,
    charHint: q.char_hint,
    difficulty: q.difficulty,
    category: q.category,
  }));
}

/** Rows come back with the joined category, which the bare Puzzle type doesn't carry. */
type PuzzleRow = Puzzle & { categories?: { name: string } | null };

function fromRow(row: PuzzleRow): PlayItem {
  return {
    id: String(row.id),
    game: row.game,
    render: row.render,
    spec: row.spec ?? undefined,
    imageUrl: row.image_url ?? undefined,
    prompt: row.prompt ?? undefined,
    // Seeded on the puzzle id, so the order is stable for everyone. Every
    // authored question was stored with the answer in position 1, which any
    // screen rendering the stored order turned into a 100% tell — that is what
    // happened in rooms. Permuting here means no screen can depend on storage
    // order again, and two browsers in a room still see the same arrangement,
    // which a per-client random shuffle would not give them.
    choices: row.choices ? shuffleSeeded(row.choices, String(row.id)) : undefined,
    answer: row.answer,
    altHint: row.alt_hint ?? undefined,
    charHint: row.char_hint ?? undefined,
    explanation: row.explanation ?? undefined,
    difficulty: row.difficulty,
    // Joined, not blank: without this every database-backed puzzle loses its
    // category label while bundled ones keep theirs — which is exactly how you
    // spot that the app is reading the database.
    category: row.categories?.name ?? "",
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
      .select("*, categories(name)")
      .eq("game", game)
      .eq("status", "live");
    if (!error && data && data.length > 0) return (data as PuzzleRow[]).map(fromRow);
  }
  return game === "picto" ? fromSeedPicto() : fromSeedTrivia();
}

// Re-exported so the many call sites that reach for `shuffle` here keep working.
export { shuffle, shuffleSeeded } from "@/shared/lib/shuffle";
