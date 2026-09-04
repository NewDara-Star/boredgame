# BoredGame

A hub for two short games. Built Sept 2026 as a clean rewrite of the 2025
Picto Phrase prototype (which had 5 puzzles and no working backend).

- **Picto Phrase** — rebus puzzles, free-text answer
- **Star Trivia** — four options, one right

## Architecture: vertical slices

`src/features/<slice>/` owns its UI, its data access and its types together.
`src/shared/` is only for things genuinely used by more than one slice.
Do not create a top-level `components/`, `hooks/` or `services/` folder —
that is the horizontal layering this structure exists to avoid.

| Slice | Owns |
|---|---|
| `auth` | (folded into `app/providers/AuthProvider`) |
| `picto` | the rebus renderer and the Picto game screen |
| `trivia` | the Star Trivia game screen |
| `play` | primitives both games share: round engine, scoring, ranks, progress |
| `admin` | authoring puzzles, and the validation that keeps junk out |
| `profile` | rank display and sign-in |
| `rooms` | head-to-head over Supabase Realtime |
| `home` | the game picker |

## Two ideas worth not breaking

**1. A rebus is data, not a picture.** `RebusItem[]` is rendered as SVG on a
100×100 canvas by `PictoRenderer`. Adding a puzzle costs three lines, not an
afternoon in Figma. That is the whole reason there is content this time.

When two items share a row, **set `w`** (exact width in canvas units). Without
it, layout depends on font metrics you cannot predict and words land on top of
each other. Verify any new puzzle by rendering the contact sheet.

**2. The app works with no backend.** `src/shared/data/` is bundled content and
`loadContent()` falls back to it whenever Supabase is absent or empty. Single
player is fully playable before any database exists. Do not make the app depend
on Supabase to boot.

## Realtime

There is no socket code. Both browsers subscribe to `rooms`, `room_players` and
`room_rounds`; Postgres pushes changes. `claimWin()` updates `winner_id` with an
`is("winner_id", null)` filter, so only the first correct answer can land.

## Commands

```
npm run dev        # local
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
```

## Conventions

- `normalise()` in `src/shared/lib/normalise.ts` must stay identical to
  `normalise_answer()` in `supabase/schema.sql`.
- The Supabase client is deliberately **not** generically typed. Hand-written
  `Database` types look like safety while being unverified against the real
  schema. Cast at the call site, or generate real types with `supabase gen types`.
- No .md sprawl: this file and STATUS.md only.
