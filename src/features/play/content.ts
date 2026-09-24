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
type PuzzleRow = Pick<Puzzle, "id" | "game" | "render" | "spec" | "image_url" | "prompt" | "choices"
  | "answer" | "accept" | "alt_hint" | "char_hint" | "explanation" | "difficulty">
  & { categories?: { name: string } | null };

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
 * The server hands back at most PAGE rows per request, whatever is asked for,
 * and says nothing when it stops short. Asked once, the 1,787-question trivia
 * bank came back as 1,000: two thirds of Film & TV never played, and rounds ran
 * 36% hard instead of 20%. So: the first page carries the total, the rest are
 * fetched together, all in id order so the pages can't overlap or skip.
 */
export const PAGE = 1000;

/** Only what fromRow reads: about a quarter less than select("*"). */
const COLUMNS = "id, game, render, spec, image_url, prompt, choices, answer, accept, alt_hint, char_hint, explanation, difficulty, categories(name)";

async function loadLive(game: GameKey): Promise<PuzzleRow[]> {
  const page = (from: number, count = false) => supabase!
    .from("puzzles")
    .select(COLUMNS, count ? { count: "exact" } : undefined)
    .eq("game", game)
    .eq("status", "live")
    .order("id")
    .range(from, from + PAGE - 1);
  const first = await page(0, true);
  if (first.error) throw first.error;
  // The untyped client guesses the category join is a list; it is one row.
  const rows = (first.data ?? []) as unknown as PuzzleRow[];
  const total = first.count ?? rows.length;
  const rest = [];
  for (let from = PAGE; from < total; from += PAGE) rest.push(page(from));
  for (const r of await Promise.all(rest)) {
    // A later page failing keeps what arrived rather than dropping to the
    // bundled set: 1,000 real questions beat the handful in the app.
    if (r.error) { console.error("puzzles page failed", r.error.message); continue; }
    rows.push(...((r.data ?? []) as unknown as PuzzleRow[]));
  }
  return rows;
}

/**
 * Database first, bundled content as the fallback. The app is fully playable
 * before Supabase exists, which is what makes it testable on day one.
 */
export const CONTENT_TIMEOUT_MS = 6000;

/**
 * The bank is downloaded once and kept for the visit (about 0.8 MB for trivia),
 * instead of at the start of every round, board game and room. Callers share
 * one request in flight. It is fetched again after CACHE_MS, so an open tab
 * still picks up new questions, and a failed or timed-out load is never kept:
 * the next round tries the database again.
 */
export const CACHE_MS = 30 * 60_000;
const cache = new Map<GameKey, { at: number; items: Promise<PlayItem[] | null> }>();

/** Drop a game's kept bank, e.g. after publishing a puzzle. */
export function forgetContent(game?: GameKey) {
  if (game) cache.delete(game); else cache.clear();
}

export async function loadContent(game: GameKey): Promise<PlayItem[]> {
  const bundled = () => (game === "picto" ? fromSeedPicto() : fromSeedTrivia());
  if (!supabase) return bundled();

  let hit = cache.get(game);
  if (!hit || Date.now() - hit.at > CACHE_MS) {
    // Bounded, because an error is not the only way this goes wrong. A request
    // that simply never comes back — bad signal, captive-portal wifi — used to
    // leave every game sitting on "Dealing questions…" for as long as the tab
    // was open, with a perfectly good bundled set sitting unused in the file.
    const items = withTimeout(loadLive(game), CONTENT_TIMEOUT_MS, () => [] as PuzzleRow[])
      .then((rows) => (rows.length > 0 ? rows.map(fromRow) : null));
    hit = { at: Date.now(), items };
    cache.set(game, hit);
    void items.then((v) => { if (!v && cache.get(game)?.items === items) cache.delete(game); });
  }
  const items = await hit.items;
  // A copy of the list, so no caller can reorder or trim everyone else's.
  return items ? [...items] : bundled();
}

// Re-exported so the many call sites that reach for `shuffle` here keep working.
export { shuffle, shuffleSeeded } from "@/shared/lib/shuffle";
