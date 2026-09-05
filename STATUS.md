# STATUS — BoredGame

Last updated: 2026-09-04 (three more games, and the whole bank is live)

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
| Square Off rules hold | `npm run check:squareoff` — turn order, endings, the bot and the stall deadlines |
| A frozen reveal resolves without its owner | `check:squareoff`: at REVEAL+GRACE the opponent is named, and `advance()` gives the transition the owner owed |
| The stall is not a regression | `git log -L` on the advance effect: the owner-only guard is present at `59a67e7`, the first Square Off commit — the code the 14:40 session ran on. Two touches ever, and the other only changed the pause length |
| Room 14 proves the timer is suspended, not lost | froze at 17:33 with `last.by = x`; moved on its own at 17:53:41 with no fix deployed, landing on `phase: picking, turn: o, last: null` — byte-for-byte what `advance()` predicts. A closed tab cannot fire 20 minutes late |
| Room 13 is the permanent variant | `phase: revealed` for 61 minutes and counting; that client is gone, not asleep |
| Both real rows unstick under the new rule | replayed the stored `ttt_games` rows through `decode()` + `stallWriter()`: names `iamdamobi` and `Newdara` respectively, and `advance()` gives a valid `picking` state for each |
| NOT reproduced: which OS behaviour suspends it | headless Chromium ignores `Page.setWebLifecycleState: frozen` — the timeout fired at 1364ms frozen and unfrozen, twice, including with nothing touching the page. The suspension is real in production and unreproducible in this lab |
| A full solo Square Off game plays | Playwright drove 60 turns to "The bot wins", no console errors |
| A miss costs the turn and nothing else | `check:squareoff` walks 400 random games and never sees `advance()` land on `asking`; `check:engines` asserts the same for every game. Putting the steal back fails both |
| Board and answers fit one phone screen | board shrinks while a question is up; verified at 390x844 |
| Profiles cannot be self-inflated | `information_schema.column_privileges`: authenticated has UPDATE on `username`, `avatar` only |

| 1,517 new trivia questions loaded as draft | 1,787 trivia rows total: 270 live + 1,517 draft, every category at 197-200 |
| The load is byte-identical to the source files | order-independent checksum over prompt + all four choices in stored order + answer + difficulty + category + explanation: 3,279,460,029,714 on both sides, 1,517 rows, 1,517 distinct |
| Every loaded row is structurally sound | SQL over the drafts: 0 rows without exactly 4 choices, 0 rows whose answer is absent from its own choices |
| Every trivia question is live | 1,787 trivia rows, all `live`: 713 easy, 714 medium, 360 hard. 0 draft |
| Connect 4 and Tic Tac Toe rules hold | `check-connect4.mts` 53 assertions, `check-tictactoe.mts` — both pass, plus 31 on Square Off |
| No reducer state can violate the c4_games CHECKs | 600 games played to completion through the real `rules.ts` + `wire.ts`: 201,925 assertions that every intermediate state satisfies `char_length(board)=42`, the phase enum, `target between 0 and 6` and the winner enum, and round-trips through `decode(encode(g))` unchanged |
| c4_games is in the realtime publication | it was NOT — created outside `supabase_realtime`, which shows each player only their own moves. `pg_publication_tables` now lists it alongside `ttt_games`, both `relreplident = d` |
| The database refuses an unknown room mode | `set_room_setup` and `rooms_mode_check` both list exactly the five modes, read back from `pg_get_functiondef` and `pg_get_constraintdef` |
| All six games render on the catalogue | headless Chromium at 420x900 against the built bundle: six cards, the two bankless ones showing "Head-to-head" instead of a bank count, no page errors |
| The answer is not parked at index 0 | 371 of 1,517 have the answer first — the seeded insert shuffle, matching the generator's own count exactly |

## Content

**1,891 puzzles live in Supabase.** Square Off and Connect 4 Trivia draw on the
same trivia bank, so neither needed new content.

- 104 rebus — 39 easy, 51 medium, 14 hard
- 1,787 trivia — 713 easy, 714 medium, 360 hard, all with explanations

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

- **The three new games have never been played by two people.** The reducers are
  unit-checked to exhaustion and the wiring typechecks and builds, but nothing
  has driven a Connect 4 board through a browser, let alone two. This is the
  next thing to prove, and it needs two devices — which is how you test anyway.
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
2. Play a Connect 4 Trivia room on two devices. It is the newest code and the
   only one whose realtime path has never carried a move.
3. Come back tomorrow and check the streak reads 2, not 1.
4. Decide the product name before pointing a domain at it.

## Known gaps

- Tapping Tic Tac Toe or Connect 4 in the catalogue lands on `/rooms` with
  nothing preselected — you make a room and pick the game again in the lobby.
- Neither plain game has a solo-versus-bot page. `botColumn` exists in
  `connect4/rules.ts` and is unit-checked, but nothing calls it yet.
- No image upload — the admin screen takes an image URL.
- No round timer on screen. Scoring uses elapsed time but nothing counts down.
- Rooms only serve puzzles that live in the database, not bundled ones.
- Idioms are not tagged by cultural register, so a UK-specific phrase can land
  on someone who has never heard it.
- Product name undecided: folder and header say BoredGame, the games are Picto
  Phrase and Star Trivia.
