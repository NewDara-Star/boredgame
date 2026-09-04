# STATUS — BoredGame

Last updated: 2026-09-04 (a stuck reveal can be unstuck)

## Verified working

Each claim below was checked by running it, not by reading the code.

| Claim | Proof |
|---|---|
| Typechecks clean | `npx tsc --noEmit` — no output |
| Builds clean | `npx vite build --emptyOutDir false` — 516 modules, 664 kB / 199 kB gzip |
| Home, Profile, Leaderboard, Trivia render and navigate | Playwright screenshots, 390×844 and 1120×900 |
| A full trivia round plays end to end | 10 questions answered by automation, summary reached |
| Crossing a rank line fires the unlock modal | seeded 19 answered, played 10, Apprentice card appeared |
| Streak lands on the summary and in the header | "Day 1 streak" chip after the round; flame chip in the header |
| Leaderboard podium, list and sticky row render | stubbed 8 players; podium, rows 4–8 and the signed-out CTA all correct |
| Locked vs unlocked ranks read differently | profile screenshot: 5 unlocked in colour, 5 greyed with "n to go" |
| Type is the real Fredoka/Nunito | fonts substituted locally from `@fontsource-variable`, not the system fallback |
| The match card renders with the real score | screenshot of the drawn PNG: dara_star wins, 3-1, winner panel highlighted |
| Saving the card produces a real PNG file | headless Chromium: download event fires, `square-off-3avsxd.png`, 190,720 bytes, PNG magic `89 50 4e 47` |
| A long name no longer runs under the sparkles | rendered names of 7, 9, 18, 19 and 20 chars with the keep-out columns (x=190, x=918) drawn on: every headline sits inside both |
| The share sheet is feature-tested, not assumed | same run: `navigator.canShare({files})` false on desktop, so it took the link path — the branch that used to be the only one |
| Guest sees an account first, not a dashboard | Playwright at 390x844, fresh and with 214 answered |
| Category filter shows real counts and restarts the round | screenshot: chips with per-category counts |
| Options are not guessable by position | `npm run check:options` — seeded shuffle spreads answer-first input 25.1/25.5/24.9/24.5 over 2000 ids |
| Square Off rules hold | `npm run check:squareoff` — 31 assertions, including the steal and turn order |
| A frozen reveal resolves without its owner | `check:squareoff`: at REVEAL+GRACE the opponent is named, and `advance()` gives the transition the owner owed |
| Two production rooms were frozen this way | `3AVSXD` and `GYVACH`, both `phase: revealed`, one mark on the board, stalled 4 and 30 minutes |
| A full solo Square Off game plays | Playwright drove 60 turns to "The bot wins", no console errors |
| The steal fires and is narrated correctly | screenshot: "You miss. The bot gets one shot at it." |
| Board and answers fit one phone screen | board shrinks while a question is up; verified at 390x844 |
| Profiles cannot be self-inflated | `information_schema.column_privileges`: authenticated has UPDATE on `username`, `avatar` only |

## Content

**374 puzzles live in Supabase.** Square Off draws on the same trivia bank, so
it needed no new content at all.

- 104 rebus — 39 easy, 51 medium, 14 hard
- 270 trivia — 128 easy, 119 medium, 23 hard, all with explanations

`src/shared/data/*.ts` holds a smaller bundled starter set so the app is
playable with no backend. It is a starter set, not a mirror of the database.

## Design

Identity is "playful toy": ink outlines with hard offset shadows, saturated flat
colour, rounded heavy type, everything presses down onto its own shadow.
Deliberately light-only.

Motion is choreographed with framer-motion. One spring (`src/shared/ui/motion.ts`)
is used everywhere. Signature moves: rebus letters fly in and assemble; correct
answers burst; wrong answers shake; scores count up; the nav pill slides between
tabs; crossing a rank line drops a confetti card.

Navigation is a bottom bar on phones and header tabs from `sm` up. Five labelled
tabs do not fit 390px, and the header now carries status — streak and rank badge
— instead.

## Not yet verified

- **Rooms now have one real two-player game behind them.** A Square Off room was
  played to completion by two people on 4 September — the first time any room
  has had two browsers in it. Seat assignment, the transition writer rule and
  the shared clock all held. The race mode still has not been played by two
  people, and no room has been tested across a disconnect.
- **The streak across a real day boundary.** `touch_streak` is unit-obvious and
  the same-day path is exercised, but nothing has yet played on two consecutive
  real days. Worth checking tomorrow.
- Publishing from the admin screen against the live database.

## Next, in order

1. Push the waiting commits, confirm the Vercel build.
2. Test rooms with two browsers — a Square Off room is the best test, since it
   exercises far more of the realtime path than the race mode does.
3. Come back tomorrow and check the streak reads 2, not 1.
4. Decide the product name before pointing a domain at it.

## Known gaps

- Trivia hard tier is thin: 23 of 270, about 8.5%.
- No image upload — the admin screen takes an image URL.
- No round timer on screen. Scoring uses elapsed time but nothing counts down.
- Rooms only serve puzzles that live in the database, not bundled ones.
- Idioms are not tagged by cultural register, so a UK-specific phrase can land
  on someone who has never heard it.
- Product name undecided: folder and header say BoredGame, the games are Picto
  Phrase and Star Trivia.
