import { supabase } from "@/shared/lib/supabase";
import { shuffleSeeded } from "@/shared/lib/shuffle";
import { withTimeout } from "@/shared/lib/timeout";
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
    accept: p.accept,
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
    accept: row.accept ?? undefined,
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
export const CONTENT_TIMEOUT_MS = 6000;

export async function loadContent(game: GameKey): Promise<PlayItem[]> {
  const bundled = () => (game === "picto" ? fromSeedPicto() : fromSeedTrivia());
  if (!supabase) return bundled();

  // Bounded, because an error is not the only way this goes wrong. A request
  // that simply never comes back — bad signal, captive-portal wifi — used to
  // leave every game sitting on "Dealing questions…" for as long as the tab was
  // open, with a perfectly good bundled set sitting unused in the same file.
  const rows = await withTimeout(
    (async () => {
      const { data, error } = await supabase!
        .from("puzzles")
        .select("*, categories(name)")
        .eq("game", game)
        .eq("status", "live");
      if (error) throw error;
      return (data ?? []) as PuzzleRow[];
    })(),
    CONTENT_TIMEOUT_MS,
    () => [] as PuzzleRow[],
  );

  return rows.length > 0 ? rows.map(fromRow) : bundled();
}

/**
 * Loads specific puzzles, in the order asked for. The daily round is a fixed
 * list and everyone must see it in the same sequence, so this deliberately does
 * not shuffle or filter by what you have already seen.
 */
export async function loadByIds(ids: number[]): Promise<PlayItem[]> {
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase
    .from("puzzles").select("*, categories(name)").in("id", ids);
  const byId = new Map(((data as PuzzleRow[] | null) ?? []).map((r) => [r.id, fromRow(r)]));
  return ids.map((id) => byId.get(id)).filter((i): i is PlayItem => !!i);
}

// Re-exported so the many call sites that reach for `shuffle` here keep working.
export { shuffle, shuffleSeeded } from "@/shared/lib/shuffle";
