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

## Adding rebus puzzles

Run the gate before anything reaches the database:

```
node --experimental-strip-types scripts/check-rebus.mts
```

It catches the two things that actually go wrong:

- **the visual is wrong** — items overlap, run off the 100x100 canvas, or are
  too small to read. Eleven of the first 36 puzzles shipped with colliding text
  because nothing checked this.
- **the puzzle doesn't work** — the canvas spells the answer outright, the hints
  are placeholder, or two puzzles share an answer.

Geometry is *estimated*, not measured: SVG text width depends on font metrics the
renderer never exposes. So the gate flags suspects — it is a filter, not a judge.
**Always render the contact sheet and look at it too.** The gate cannot tell you
that six puzzles in a row use the same trick, which is its own quality problem.

### Sourcing: generate, don't collect

A rebus has three parts and only one of them can belong to anyone.

| Part | Owned? |
|---|---|
| The phrase — "water under the bridge" | No. Idioms and compound words are common language. |
| The mechanism — "above means *over*" | No. A method is not expression. |
| A specific rendered image | **Yes** — that particular drawing is its author's. |

Since puzzles here are generated from a spec in our own type and palette, we
never touch the owned part. Two people can independently make a "head over
heels" rebus; neither owes the other anything.

So: **source phrases, then apply a mechanism.** Do not lift finished puzzles
from Reddit or puzzle apps — those are someone's original work, and most are
images this renderer cannot use anyway. (Not legal advice; the practical line
is that we copy nobody's picture.)

**Phrase sources, all free:** idioms, proverbs, compound words, common
expressions, film and song titles (titles aren't copyrightable), place names.

### Generating layout

Use `scripts/layout.mts` — `row()`, `stack()`, `solo()`. They tile the canvas
arithmetically, so overlap is impossible by construction rather than caught
afterwards. Two failures taught this:

- Hand-computed x/w produced eleven colliding puzzles in the first batch.
- A first version of `row()` divided the canvas *proportionally*, which gave a
  one-character item the same slot share as its neighbours and left
  `lengthAdjust` stretching the glyphs. "B 4" and "X L" came out visibly wide.
  Widths now come from the text itself and the slack becomes margin.
- Width is estimated **per character**, not by a flat average. A lone "I" given
  the average width gets stretched into a solid bar, which is how "I C U" first
  rendered. `textWidth()` in layout.mts is the shared estimate, used by the
  generator and the gate alike.

### The mechanism catalogue

Everything the renderer can express. Cross these with any phrase list and the
supply is effectively unlimited.

| Mechanism | Spec | Reads as | Example |
|---|---|---|---|
| Vertical position | two items, differing `y` | over, under, on, above, below | MIND / MATTER |
| Horizontal order | two items, differing `x` | after, before, by, to | DEATH LIFE → life after death |
| Repetition | N copies | tri-, for(four)-, second, seven | CYCLE ×3 → tricycle |
| Reversal | text written backwards | back, backward, about, return | ECAF → about face |
| Size | very large or small `size` | big, small, large, little | tiny WORLD → small world |
| Strike-through | `strike: true` | broken, crossed, no, cancelled | ~~PROMISE~~ |
| Rotation | `rotate: 180` | upside down, turn around, flipped | AROUND rotated |
| Superscript | `sup` | cube, square, to the power of | ICE³ → ice cube |
| Nesting | short item between halves of a long one | in, inside, within | MO-MAN-ON → man in the moon |
| Splitting | one word broken across two items | split, divided, apart | BAN ANA → banana split |
| Omission | letters left off | unfinished, missing, incomplete | SYMPHON |
| Letters as sounds | single letters | C=sea/see, Q=queue, X=ex, U=you, B=be, R=are, I=eye, T=tea | X Q Q Q ME |
| Numbers as sounds | digits | 1=one/won, 2=two/to, 4=four/for, 8=ate | MIL 1 ION |
| Canvas position | `y` near 0 or 100 | up, down, high, low, top, bottom | TOWN low → downtown |
| Letter sequence | a run of the alphabet | "H to O" | H I J K L M N O → water |
| Colour | `color` | blue, red, green, off-colour | blue MOOD → feeling blue |
| Opacity | `opacity` low | fading, faint, disappearing | — |

**Two rules the gate enforces, learned the hard way:**

1. If the canvas spells the answer, it is not a rebus. `TOUCH` over `DOWN` for
   "touchdown" is a word cut in half. The mechanism must *add* something the
   letters do not already say.
2. Any two items sharing a row need an explicit `w`. Without it, layout depends
   on font metrics and words land on top of each other.

And one rule the gate cannot enforce: **vary the mechanism.** Six puzzles in a
row using "same word twice" is a quality problem even when each is fine alone.

## Realtime

There is no socket code. Both browsers subscribe to `rooms`, `room_players` and
`room_rounds`; Postgres pushes changes. `claimWin()` updates `winner_id` with an
`is("winner_id", null)` filter, so only the first correct answer can land.

## Installing dependencies — read this before running npm

**`npm install` must be run on macOS, in a normal Terminal.**

When Claude installs through the remote-device bridge, that shell is Linux. npm
only fetches the platform binary for the machine it is running on, so the tree
ends up with `@esbuild/linux-arm64` and no `@esbuild/darwin-arm64`. The build
then dies with "Host version does not match binary version", which looks like a
version conflict and is actually a platform mismatch.

If that happens:

```
rm -rf node_modules package-lock.json
npm install
```

Claude can edit files, typecheck and run the dev server through the bridge.
Dependency installs and production builds belong in your own Terminal.

## Commands

```
npm run dev        # local
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
```

## Deployment

Vercel, static build of `dist/`. **`vercel.json` is load-bearing**: this is a
single-page app, so every path has to be rewritten to `index.html`. Without that
rewrite, `/picto` works when you click to it and 404s when you refresh or share
the link — and a room URL like `/rooms/ABC123` never works at all, which would
quietly kill head-to-head.

Environment variables to set in the Vercel dashboard (Settings → Environment
Variables), not in the repo:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_KEY` is for `scripts/seed.mjs` only. It never goes near Vercel
and never gets committed — it bypasses row-level security entirely.

## Conventions

- `normalise()` in `src/shared/lib/normalise.ts` must stay identical to
  `normalise_answer()` in `supabase/schema.sql`.
- The Supabase client is deliberately **not** generically typed. Hand-written
  `Database` types look like safety while being unverified against the real
  schema. Cast at the call site, or generate real types with `supabase gen types`.
- No .md sprawl: this file and STATUS.md only.
