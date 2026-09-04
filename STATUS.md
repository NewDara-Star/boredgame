# STATUS — BoredGame

Last updated: 2026-09-04 (design pass)

## Verified working

Each claim below was checked by running it, not by reading the code.

| Claim | Proof |
|---|---|
| Typechecks clean | `npm run typecheck` — no output |
| Builds clean | `npm run build` — 101 modules, 218 kB / 70 kB gzip |
| Home, Picto and Trivia render and navigate | Playwright screenshots, 420×900 viewport |
| Picto play loop works end to end | submitted a wrong answer, got the reveal + correct answer |
| Trivia options shuffle | correct answer was not in first position on screen |
| All 36 rebus puzzles render legibly | contact sheet screenshot of every puzzle, inspected |
| No console errors | Playwright console listener |
| Rebus letters animate into place | screenshot captured mid-assembly, letters in flight |
| Coloured states render correctly | wrong-answer panel screenshot — red, not white |
| Header fits at 420px | screenshot at phone width, nothing clipped |

## Content

- 36 rebus puzzles (`src/shared/data/picto.ts`)
- 51 trivia questions (`src/shared/data/trivia.ts`)

Both bundled into the app, so it is playable with no backend at all.

## Design

Identity is "playful toy": ink outlines with hard offset shadows, saturated flat
colour, rounded heavy type, everything presses down onto its own shadow.
Deliberately light-only — a toy in a dark room is a different product.

Motion is choreographed with framer-motion. One spring (`src/shared/ui/motion.ts`)
is used everywhere so the whole app moves with the same weight. The signature
move: **rebus letters fly in and assemble**, so the puzzle builds in front of you.
Correct answers burst; wrong answers shake; scores count up rather than jumping.
All of it respects `prefers-reduced-motion`.

**One thing not verified:** Fredoka and Nunito load from Google Fonts, which my
sandbox blocks — every screenshot above is the system-font fallback. The layout
and colour are confirmed; the *typography* is not. Check it locally first.

## Not yet verified

These are built but have **not** been run against a live database:

- Supabase auth (magic link)
- Publishing from the admin screen
- Progress syncing to `attempts` / `profiles`
- **Head-to-head rooms** — the realtime code is written and typechecks, but has
  never had two browsers in a room. Treat it as unproven until it has.

## Next, in order

1. Create a Supabase project. Put the URL and anon key in `.env`.
2. Run `supabase/schema.sql` in the SQL editor.
3. `VITE_SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/seed.mjs`
4. Sign in, then add yourself to the `admins` table so the admin screen can publish.
5. Test rooms with two browsers. This is the step most likely to surface bugs.
6. Deploy to Netlify, point the Namecheap domain's DNS at it.

## Known gaps

- No image upload yet — the admin screen takes an image URL. Supabase Storage
  is the intended home; not wired.
- No round timer on screen. Scoring uses elapsed time but nothing counts down.
- Rooms only serve puzzles that live in the database, not bundled ones —
  `startNextRound` says so rather than failing silently.
- Product name undecided: folder and header say BoredGame, the two games are
  Picto Phrase and Star Trivia. Decide before buying/pointing a domain.
