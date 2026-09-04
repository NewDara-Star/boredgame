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

## Where the content actually lives

The database is the content. `src/shared/data/` is a **small offline starter
set**, not a mirror — the bank is 374 puzzles and bundling all of it would ship
a few hundred KB of JSON to every visitor for a fallback most will never hit.

So the counts on the home page query the database, and `loadContent()` reaches
for the seed only when Supabase is absent or empty. Do not try to keep the two
in sync; that is not what the seed is for.

### Flags

Flag questions are written **as descriptions**, not images. Emoji flags (🇳🇬)
render on Apple and Android but Microsoft ships no flag glyphs at all, so
Windows players would see two grey letters. An SVG set would mean ~200 assets
for one category. Describing the flag works everywhere, needs nothing, and asks
a better question — whether you know the flag, not whether you recognise a
picture of it.

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

## Square Off

Tic-tac-toe where claiming a square costs a right answer. The rule that makes it
a game rather than a speed quiz with a grid drawn on it:

    X picks a square, X answers
      correct -> X claims it
      wrong   -> O gets ONE shot at that same square, on a fresh question
                   correct -> O claims it
                   wrong   -> the square stays open
    ...and either way the next pick is O's.

Turns alternate by **pick**. A steal is an interrupt that never changes whose
pick comes next, so missing costs you the square and hands your opponent a free
attempt, but never costs you a turn outright.

`rules.ts` is pure and holds every one of those rules. The solo game and the
two-player room both reduce through it — that is the only way the rules are
guaranteed to match on both sides of a network. It is checked by
`npm run check:squareoff`, not eyeballed.

Two things that will bite if you change them:

- **Deal the question in the same tick the phase becomes "asking"**
  (`commit` in `useSquareOff`). Dealing it from a separate effect leaves one
  render where the phase and the question disagree, and the bot answers the
  previous question.
- **Exactly one client writes each transition.** The picker writes the pick, the
  answerer writes the answer, and the answerer also writes the move on from the
  reveal. Any other arrangement has both browsers racing to write the same row.

**Handing over a file has exactly one correct shape, and it is not `<a download>`
on a data: URL.** That was a 254KB base64 string in an href: iOS Safari ignores
the download attribute on data: URLs and opens the image instead, and desktop
Safari saves an unnamed "Unknown" file. `drawMatchCard()` now returns a real
`File` alongside the data URL for `<img src>`, and `saveCard()` offers the share
sheet — "Save Image" is one tap there — before falling back to a blob: URL link.

Two rules inside `saveCard()`, both easy to break by tidying it:

- **Nothing may be awaited before `navigator.share()`.** iOS needs transient
  activation, and one await between the tap and the call loses it. That is the
  whole reason the `File` is built when the card is drawn rather than on click.
- **Feature-test with `canShare({ files })`, never `navigator.share`.** Desktop
  Chrome has `share` and refuses files, so testing for the wrong one sends every
  desktop user down a path that silently does nothing.

The bot is deliberately not a solved player — win, block, centre, corner. A
minimax opponent makes every solo game a draw, and the tension here is meant to
come from the questions. It answers the same questions you do at a rate set by
difficulty and can be watched getting them wrong, so its skill is visible rather
than a hidden dice roll on the outcome.

Rooms carry a `mode` rather than there being a second room system. Board state
lives in `ttt_games`, one row per room, nine characters of text for the board.

## The other three board games

`tictactoe`, `connect4` and `connect4trivia` are room modes alongside `race` and
`squareoff`. Square Off's questions were too hard for half the people he plays
with, so the plain versions exist to give them a game with no bank behind it at
all.

Plain Tic Tac Toe is not a second engine. `place()` lives in
`squareoff/rules.ts`, next to `pick`/`answer`/`advance`, and `useTttRoom` takes
a `plain` flag — the board, the row and the reducer are the ones already in
production. `place()` is in that file rather than its own because a rules module
may not import another one: the check scripts run under bare Node, which needs
file extensions in import paths, while tsconfig sets
`allowImportingTsExtensions: false`. No cross-module imports, no conflict.

Connect 4 is its own slice: 7×6, `row 0 is the TOP`, board stored as 42
characters in `c4_games`. Plain drops on tap; the trivia version names a column
first, then asks. **A miss loses the turn and nothing else** — there is no steal,
so `advance()` always flips the turn. That was his call, not a simplification.

A bankless game still writes a `game_key` (rooms.game is NOT NULL) and ignores
it. `GameDef.bank` is `null` for those two, which is what the catalogue, the home
page and the lobby key off — a null bank is not an empty bank, so they are never
greyed out for want of questions, and the lobby hides the category step entirely.

`c4_games` needs to be in the `supabase_realtime` publication. It was created
without it, and the symptom is the worst kind: your own moves appear instantly
and your opponent's board never changes.

## A room outlives one game

Rematch replays the same game and keeps the running tally. **Play something
else** sends the room back to its lobby — same code, same two people, any game.
That is `reopen_room`, and it clears the ready flags, zeroes the scores and
deletes the room's rounds. Rounds because `startNextRound` derives the round
number from the highest one already stored, so a reopened race room would
resume at 6 of 5 and finish the instant it started. Scores because a rematch is
what keeps a score running; changing the game is a new match.

Both of those, and `end_match`, are SECURITY DEFINER for the same reason:
`room_players` UPDATE is own-row only and `rooms` UPDATE is host-only, so no
client can clear the other person's ready flag, and the guest's "end match" was
a direct update matching zero rows — which is not an error, so it failed in
silence for months.

The room's bank follows `rooms.game` in an effect of its own. It used to be read
once when the room was found, which meant changing the game in the lobby left
the previous bank in place: the category chips described the game you had just
left, and a race dealt out of it.

## Brand: sticker on neon, but only where you are not reading

The references are logo boards and packaging — saturated grounds, white fills,
heavy ink outlines, hard offset shadows. Translated literally that would be a
hot pink page under 15px option text, which is a worse product. So the split is:

- **Reading surfaces stay light.** Paper `#FBF4E6`, dot grid, questions and
  options on white pieces. Nothing changed about legibility.
- **Brand moments carry the neon.** Header is `--color-hot` (#FF2E88), the phone
  nav bar is ink with a hot active pill, and the share card is a full pink board.

`--color-hot` and `--color-acid` are the new pair; picto orange and trivia blue
were pushed hotter (#FF5A1F, #2B4BFF) rather than replaced, because they are the
two games' identities and people already associate them.

The logo is now `Wordmark` — real SVG, not two styled spans, so it can go on the
share card and the favicon as well as the DOM. `textLength` pins its width so it
is the same shape before and after the webfont loads, the same trick the rebus
renderer uses. `.sticker` in index.css is the reusable version of the treatment.

## Signing up is a name and a password

Nothing is ever sent to an email — confirmation is off and the built-in mailer
is rate-limited and test-only — so asking for one was a step that bought
nothing. Sign-up takes a username.

Supabase Auth has no username login, so the name becomes an address on
`players.boredgame.app`, a domain nothing sends to. That is not a workaround for
uniqueness, it **is** the uniqueness guarantee: two people cannot hold the same
address, so the race for a name is settled by auth rather than by checking first
and hoping. Lower-cased, so `Dara` and `dara` are one person. `handle_new_user`
reads the wanted name out of `raw_user_meta_data`, so the name you picked is the
name you get instead of one derived from the synthetic address.

The same field still accepts an email, because four accounts predate this, and
the magic-link fallback only appears when what you typed contains an `@`.

**There is no password reset, and now there structurally cannot be one.** That
was already true — the mailer allows about two messages an hour — but a name
makes it permanent. Custom SMTP plus a recovery email is the unblock, and it is
a prerequisite for "many people", not a nicety.

## The signed-out player is a different screen

Profile used to render the full dashboard for guests with the sign-in form
below four sections of it — which reads as "you are already logged in" and hides
the only action on the page. There are now two views: `GuestView` leads with the
auth card, `MemberView` is the dashboard. Signing UP is the default mode; a
returning user knows to look for the other tab, a first-timer who lands on a
login form assumes the app is not for them yet.

The header shows a Sign up button when signed out rather than a rank badge, and
Home offers an account only once there is progress worth keeping.

## Adding a game

`src/features/play/registry.tsx` is the single declaration of a game. Adding one
is an entry there plus a route and its component — not edits to the nav, the
home page, the router AND the room lobby, which is what it used to be.

The nav holds **sections, not instances**: Home · Games · Rooms · Ranks. One tab
per game works at three and falls over at six, so the games live behind `/play`,
which grows a search box past eight of them and marks any game whose bank is
empty as unplayable rather than letting you walk into a round with nothing in it.

The lobby's game choices are `ROOM_GAMES` — every registry entry with a `room`
block — so a new head-to-head game appears there without touching the lobby.

**Art is sized in pixels, never percentages.** A percentage-sized SVG inside a
centring container has no definite box to resolve against, and the first version
of the catalogue rendered a 62px emblem at about 700px, squeezing the text to one
character per line. Every `Art` takes an explicit `size`.

## Home is an overview, not a second games list

Greeting with the date · daily challenge with the faces of who has played · the
week strip · a swipeable stat carousel · then games and rooms behind section
headers. Games is the catalogue; Home is you.

A 148px stat card at 34px display type fits about five characters. "Skilled"
was already clipping and "Accomplished" is twice that, so a card whose subject
is a word rather than a number carries `art` and a headline instead of
pretending the word is a figure — the rank card shows its badge. The remaining
figures scale down by length as a guard, so a number that grows unexpectedly
shrinks rather than running off the card.

Both the stats and the games rows are `Carousel` — the negative margin plus
matching padding is the whole trick, letting cards run off the screen edge
rather than stopping at the page gutter, which is what reads as "there is more
over there". The games row ends on a card through to the catalogue, so swiping
to the end lands somewhere instead of stopping dead.

**The week strip is derived, not queried.** A streak of N ending on `lastPlayed`
means exactly those N consecutive days were played, so the strip is true without
another round trip. That stops being true the moment a streak can survive a
missed day — don't let it.

Two things that bit, both caught by looking at a screenshot:

- **Normalise both sides to midnight.** Comparing a date parsed at `T00:00:00`
  against a `new Date()` carrying the current time put every day out by one — at
  14:30 the difference to today was −0.6 days, rounded to −1, so today read as
  unplayed and the four days *before* it lit up instead.
- **Never contradict your own data.** The card said "nobody has played yet" while
  showing two avatars, because an exact count needs a `content-range` header that
  can go missing. It takes the larger of the count and the faces it actually has.

## The daily round

Ten questions, the same ten for everyone, once a day — the thing that makes a
streak and a leaderboard mean anything.

The set is **pinned in `daily_rounds`, not derived on the fly.** Computed from
the live bank, publishing a puzzle at noon would hand the afternoon a different
round from the morning and the scores would not be comparable, which is the
entire point. Whoever plays first creates the row; a racing second caller takes
the row that landed rather than their own draft.

**One attempt.** `daily_scores` has no insert or update policy — everything goes
through `submit_daily()`, which is `on conflict do nothing`. A score you can
retake after seeing the board is not a score.

**The board ranks on correct answers, with time as the tiebreak — not on score.**
Score is speed-and-streak weighted, which is right for a solo round and wrong for
a shared one: a tester clicking instantly scored 1992 on 2 of 10 and beat 920 on
9 of 10. Where everyone plays the same questions, being right has to be what wins.

Names are chosen, not generated (`set_username()`, unique on `lower(username)`).
The signup trigger had to be fixed in the same migration — it was producing names
longer than the new shape rule, which would have turned every new signup into a
failed insert.

## An invite link is the whole growth loop

Arriving on `/rooms/CODE` signed out used to render one sentence — "Sign in on
the Profile tab first" — with the code nowhere on screen and no way back. Someone
shared a link and their friend read the code out of the URL by hand to get in.

Now that screen shows what they were invited to (the code, who is waiting) with
the sign-up card **inline**. No redirect, so nothing has to remember where they
were headed. And following an invite IS the intent to join, so joining happens on
arrival rather than behind one more button — `join_room` refuses a full or
started room, and that refusal now has somewhere to show.

The rule this is an instance of: never send someone to another screen to do the
thing the current screen is for.

## Seats, and writes that report themselves

**Rooms have a capacity** (`rooms.capacity`, default 2) and joining goes through
`join_room()`, which locks the room row so two people reaching for the last seat
are serialised rather than both counting one and both inserting. It also refuses
anyone once `status` has left `waiting`. The open INSERT policy is gone — that is
what let a third person walk in, and starting needs EVERY player ready, so one
extra person who never tapped Ready blocked the lobby permanently. Creating a
room seats the host through the same function.

**Every room write goes through `attempt()`** in `shared/lib/write.ts`. Before
that, every `await supabase.from(...)` discarded its result, so a refused write
and a hang looked identical — the board simply never moved. An expired session
in particular was indistinguishable from a broken game. `attempt` returns null on
success or a sentence to put on screen, and it names the common cases: expired
sign-in, RLS refusal, and no network.

A failed write no longer blanks the screen either. The room used to early-return
on `error`, so one bad write replaced the game you were in the middle of with a
line of red text.

## Dealing the next puzzle

`deal()` in `features/play/dealer.ts` is the only place that picks one, and
`npm run check:dealer` covers it. The inline version it replaced was:

```
pool.find(i => !seen.has(i.id)) ?? scoped[0] ?? pool[0]
```

Both fallbacks were bugs. Once everything had been served, `find` returned
undefined and it handed back `scoped[0]` — **the same question every turn for the
rest of the session**, which in a room means whoever saw the answer wins every
square. And when the category filter matched nothing, the last fallback served
from the whole bank, ignoring the filter with no message at all.

So: exhaustion is normal and starts a fresh cycle (excluding the item just
served, or the last of one cycle is the first of the next). An empty pool is a
misconfiguration and is reported — `poolError` — never papered over.

**Categories belong to a bank, not to a room.** Five categories are picto-only
and have zero live trivia: Idioms, Everyday, Food, Places, Music. Picking Idioms
for a Picto race and then switching to Square Off used to leave the room filtered
to nothing. The lobby clears the selection when the bank changes, and
`set_room_setup()` strips categories with no live puzzles for the chosen game so
it holds whichever client is asking — the chips visibly un-select rather than
the filter silently doing nothing.

## Why a turn feels slow, and what actually fixes it

Two separate things, and it is worth not confusing them.

**The pause was the real cost.** A fixed 2300ms sat between answering and the
next pick, and a turn with a steal has two of them — nearly five seconds of
deliberate waiting per turn. The fix is not a shorter timer, it is a **skippable**
one: whoever owes the advance gets a Next button, and the timer stays only as
the fallback so an idle player cannot stall the board. Agency, not milliseconds.
The remaining pause is adaptive — a correct answer has nothing to read.

**Nothing was applied locally.** Every move wrote to the database and then waited
for the realtime echo before the *acting* player's own screen moved. In practice
realtime is fast, so this was not what made turns feel long — but it means a
realtime hiccup froze the board completely for the person who had just tapped.
Writes are optimistic now: apply, then confirm, and revert if the write is
refused. Measured with realtime absent entirely: 50ms to render the next state,
against never.

## Starting, and leaving

**Who starts is decided in the database.** `claim_room_start()` moves a room out
of `waiting` and reports whether this caller was the one that moved it; only the
winner deals the board. The old client-side host check held against two people
but not against one client's effect firing twice — and a second deal upserts a
fresh board over one already in play. Verified: first claim updates 1 row,
second updates 0, and `ttt_games`' primary key refuses a duplicate board.

**A board can no longer hang, in either of the two ways it could.**
`stallWriter()` names exactly one client at any instant and says what it owes —
unit-checked across the whole timeline, because two writers means the round
jumps twice at once.

- *Nobody answered.* The answerer's own clock expires first; after a grace
  period the opponent writes the miss instead.
- *Nobody moved on from the reveal.* This one shipped broken and was found in
  production: two live rooms frozen at `phase: revealed` with one mark on the
  board. The pause after an answer is a `setTimeout` in the answerer's tab, and
  a phone that locks or an app switch suspends it — so the board stopped with
  nothing running anywhere and the opponent not allowed to write. Same shape as
  above now: the answerer owns it for `REVEAL_MS`, then the opponent takes it,
  and gets a "Move it on" button rather than sitting out the grace.

`REVEAL_MS` (4500) must stay above the longest reveal pause in `useTttRoom`
(2900) or the rescue races the timer it exists to back up. The check asserts the
relationship, not just the behaviour.

A pick has no deadline on purpose: there is no correct square to choose on
someone else's behalf, so an abandoned pick is quit, not resolved.

**Presence is a heartbeat on a row both players already subscribe to.**
`touch_presence()` every 20s; the update itself is what tells the other browser
you are still there. Past 50s of silence the room says so, rather than leaving
someone staring at a screen that will never change.

## The lobby is where a match is agreed

Creating a room decides nothing any more. `createRoom` makes an empty room and
both people settle the game and the categories in the lobby, because the person
joining used to arrive at a match someone else had already configured without
them.

- **Either member can change the setup**, through `set_room_setup()` — the
  guest cannot update `rooms` directly and should not have to ask.
- **Any change clears both ready flags.** That is the whole mechanism: without
  it, "ready" means "I agreed to whatever this was thirty seconds ago", and the
  host can silently swap the game after you have agreed.
- **Both ready starts it, and only the host's client writes that.** Both
  browsers see the same flags, so letting either start races to deal twice.
- Categories are derived from the pool already loaded for the room's current
  game, so switching from Trivia race to Picto race re-lists the categories that
  game actually has, with counts that describe what this room can serve.

## A session is a run of games, everywhere

Both Square Off modes keep a tally across games, and both can be ended to
produce a result card. Solo used to just say "Play again" and drop every result
on the floor, which is what made it feel like the lesser mode.

Room scores are incremented by `bump_room_score()` in the database, NOT
read-modify-written from the winning client's copy of the players list. Across a
rematch that copy can lag behind realtime, and the next win then writes
(stale + 1) straight over the real score.

Race mode has a finished state now. Past `best_of`, `startNextRound` returns
early — so without one the screen sat on the last question with a Next round
button that silently did nothing.

## Rooms keep a session tally

`room_players.score` counts games won in that room across rematches. The client
that writes the winning transition also books the win, so it increments exactly
once however many browsers are watching. Rematch keeps the tally; Quit match
sets `rooms.status = 'finished'`, which is what turns a rally of games into a
result — and that result draws to a 1080px PNG in `matchCard.ts`, straight onto
a canvas rather than screenshotting the DOM.

## Categories

Solo rounds filter client-side; the picker is built from the pool `useRound`
already loaded, so counts can never disagree with what a round can serve. Rooms
store `rooms.categories` instead, because a per-client filter lets one browser
be served a puzzle the other has filtered out and cannot render.

## Option order is never storage order

Every trivia question was authored and stored with the correct answer in
`choices[1]`. Solo Trivia and solo Square Off shuffle on render, so it looked
fine; the room screens rendered the stored order, and the top option was the
answer 100% of the time. A player found it in about ten minutes.

Two fixes, and the second is the one that matters:

1. The stored arrays were permuted once in the database, so the systematic bias
   is gone from the data.
2. `loadContent` now permutes with `shuffleSeeded(choices, puzzleId)` on the way
   out, so **no screen can depend on storage order again**. It is seeded rather
   than random because two browsers in a room have to see the same arrangement —
   a per-client random shuffle means the players are not looking at the same
   thing. Solo screens shuffle again on top of that, so a repeated question does
   not sit in the same place twice.

Never render `choices` straight from a row you fetched yourself, and never
shuffle again inside a room screen. `npm run check:options` asserts the seeded
permutation spreads a worst-case answer-first input across all four slots.

## Status, streaks and the leaderboard

`profiles` carries `streak`, `best_streak` and `last_played`. None of them are
writable from the client: `update` on `profiles` is granted per-column and only
covers `username` and `avatar`. Everything else moves through triggers or the
`touch_streak(p_local_date date)` RPC, which `recordRound` calls once a round
ends and which returns the whole updated profile row so nothing has to refetch it.

`touch_streak` takes the player's OWN calendar date rather than deriving one
from `now()`. A streak that breaks at 1am because the server counts days in
London is the fastest way to make the number worthless. The server trusts a
date within a day of UTC and falls back to UTC past that.

The leaderboard reads `profiles` directly — it is already `select using (true)`
— ordered by `total_answered`, then `total_correct`, then `id`. The last key is
not decoration: without it ties reshuffle between loads. Ranking on answers
rather than accuracy or score is deliberate; accuracy rewards answering less and
score rewards farming the easy tier.

Anonymous play keeps its own streak in the same per-user localStorage key as the
rest of local progress. `useProgress` shows a streak of 0 once the run is dead
rather than the number you used to have.

## Git in an agent shell leaves locks

Every git write here creates `.git/index.lock` or `.git/HEAD.lock` and then
fails to remove it, because this shell has no delete permission in the folder —
so the NEXT git command dies on a stale lock. `rm` cannot clear them, but `mv`
can: rename needs write permission on the directory, not delete permission.

Clean before every git command, not after:

```
unlock() { for f in HEAD index; do [ -e ".git/$f.lock" ] && \
  mv ".git/$f.lock" "_to_delete/gitlocks/$f.$(date +%s%N)"; done; return 0; }
unlock; git add -A
unlock; git commit -F msg.txt
```

## Commands

```
npm run dev        # local
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build

for f in scripts/check-*.mts; do node --experimental-strip-types "$f"; done
```

`npm run build` fails from an agent shell with `EPERM ... unlink dist/assets/…`:
emptying `dist/` needs delete permission that shell does not have. Use
`npx vite build --emptyOutDir false` instead — old hashed assets pile up in a
gitignored folder, which costs nothing. Your own terminal is unaffected.

## Screenshots without a display

Nothing here can run a browser against a dev server: each `device_bash` call is
a fresh network-isolated sandbox, so a server started in one call is gone by the
next. The way to actually look at a change is:

1. `npx vite build --emptyOutDir false`
2. copy `dist/` somewhere with a filesystem and a browser
3. serve it with an SPA fallback and drive it with Playwright, stubbing
   `**://*.supabase.co/**` and seeding `localStorage` to reach a given state

Google Fonts is not reachable from that environment either — substitute
`@fontsource-variable/fredoka` and `@fontsource-variable/nunito` locally, or the
screenshots lie about every line-wrap. Three separate rendering bugs in this
project were found only by rendering and looking; none of them were type errors.

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
