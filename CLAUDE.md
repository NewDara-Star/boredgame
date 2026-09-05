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
    ...and either way the next pick is O's.

**A miss costs your turn and nothing else** — the same rule as Connect 4.

There used to be a steal: miss, and the reducer offered your square to your
opponent for one free attempt. It went for a reason that is not about balance.
The opponent never had to *spot* the opening — the game handed it to them — and
a windfall neither player earned is not tension. Worse, it compounds across a
skill gap: the stronger player converts the weaker one's misses and not the
other way round, which is exactly backwards for a game meant to be playable
across an age gap. The drama survives without it. Miss the winning square and
it stays open; your opponent can go for it next turn, but they have to spend
their own turn and land their own answer.

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
first, then asks. **A miss loses the turn and nothing else** — the rule every
game now shares, enforced for all of them by `check-engines.mts`: `advance()`
may never land on `asking`.

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

## A guest is a real account with the password left out

Rooms required an account. "A name and a password" is not hard, but it reads as
a commitment before you have seen the thing, and that is where a nine-year-old
or a grandparent stops. `signInAsGuest` is `signInAnonymously` with the typed
name in user metadata, so the same trigger that names a real account names a
guest, and `profiles.is_guest` keeps them off the leaderboard — ranking someone
who can never sign back in puts a permanent stranger on the board.

`claimAccount` is `updateUser({email, password})` on the SAME row, so the id
survives and every game already attached to it comes along. The flag is cleared
by a trigger on `auth.users` UPDATE, because claiming is an update and nothing
else would ever clear it.

Two things to know. **It needs "Anonymous sign-ins" ON** in Supabase →
Authentication → Sign In / Providers; with it off, `signInAnonymously` errors
and the card says exactly that rather than failing silently. And every guest is
a permanent row in `auth.users` that nothing removes, so
`select public.sweep_stale_guests(30);` deletes anonymous accounts older than 30
days that never joined a room and never answered anything. Run by hand, read the
number, then decide — it is deliberately not scheduled.

### What a guest can and cannot do

An anonymous user gets the `authenticated` role, so every policy written for
"a signed-in person" now also describes someone who costs nothing to create.
Audited by impersonating one with RLS actually enforced, not by reading the
policies. Held: `admins` (RLS on, zero policies — nobody can read it or insert
themselves), other people's profiles (own-row, and UPDATE granted only on
`username` and `avatar`), other people's boards, and draft puzzles — 0 of 1,891
rows visible.

Two did not hold, and both pre-dated guests. `rooms` was `SELECT USING (true)`,
so a stranger listed all 14 rooms and their codes in one query; and
`room_rounds` had `USING (member)` with `WITH CHECK (true)`, so a stranger
inserted a round into a room they were not in — the probe did exactly that
before the fix. Rooms, players, rounds and both boards are now members-only,
with `find_room(code)` and `room_peek(code)` as the deliberate way in for
someone holding a code.

Accepted, and worth knowing: every live puzzle's answer is downloadable by any
client, so a determined person can win a race — that is inherent to a quiz that
runs in the browser. And `attempts` lets an account inflate its own
`total_answered`, so the leaderboard is honour-system; guests are excluded from
it, but a guest who claims their account keeps whatever numbers they arrived
with.

## One board hook, three games

Square Off and Connect 4 had a hook each — 234 and 223 lines whose
subscription, optimistic write, win booking, quit, reopen and start scored
0.98-1.00 against each other on a structural diff. `useBoardRoom` is the one
copy; `BoardEngine` is the difference, and the difference is small: the table
name, the codec, the reducer functions, and who owes a pending answer (Square
Off can hand it to the opponent on a miss, Connect 4 cannot).

The engine has one rule worth knowing. **A question is dealt exactly when the
state being written is `asking`** — read off the state, not passed in by the
caller. That replaced a boolean at every call site, which Connect 4 got wrong
at three of them, dealing a question for a phase that never asks one.
`check-engines.mts` plays both games to completion many times over and asserts
the invariant holds, because the whole hook now rests on it.

The three room screens share `useMatchChrome` (the clock, the seats, the
result card), `MatchOver`, and `useStallRescue`. The last of those is the
frozen-board fix, and it existed in two copies — which is exactly how the
reveal case came to be missing from one of them.

Writing this found one real inconsistency: `answer()` left `answerer` set while
the phase was `revealed`, though `decode()` has always derived it from the
phase. Nothing read the wrong one, because every reader is guarded by the
phase. It is nulled now — two versions of the truth with nothing standing on
the wrong one is a bug waiting for its first reader.

## 12px is the floor, and the clock follows the question

The interface had 61 uses of 10 and 11px text, plus eight more between 7.5 and
9.5px that a grep for "10 or 11" never saw. They are labels, not decoration —
"3 to go", the category counts, whose turn it is — and that size is where an
older player stops being able to read them. Everything is 12px or above now,
and `check-type-size.mts` fails the build if anything drops below it, because
the next arbitrary value someone reaches for will be 10px again.

Where a bumped label got tight, the fix was letter-spacing rather than size:
`tracking-widest` is what costs the width, and dropping it buys back more than
12px costs. "WORD PUZZLE" broke over two lines in a carousel card until the
tracking came off. Size is the part that has to be legible.

The question clock was a flat 15 seconds — generous for "what colour is the
sky", mean for four long options, and the same fifteen seconds for a
nine-year-old reading aloud as for someone on their hundredth round. `askMs()`
takes it from the question's own difficulty: 15 / 18 / 22. Derived from the
puzzle rather than stored on the room, so both clients compute the same
deadline from the same row without another column to keep in step — which is
what `check-clock.mts` pins down, along with the rule that the clock always
stays longer than the reveal pause it would otherwise race.

## The bundle is split by how often things change

Every route below `/` is `lazy()`; only Home is eager. Vendor code is split by
churn rather than size: `react` (with the router) and `supabase` and
`framer-motion` are the same bytes for months, so a content-hashed copy of each
survives every deploy, while app code does not — verified by changing a source
file and confirming all three vendor hashes stay put.

First paint went from 774 kB in one file to 652 kB across four, which is a
smaller win than it sounds and worth being straight about: React, framer-motion
and Supabase are all still needed at boot, because `AuthProvider` calls
`getSession()` on mount. The real gain is elsewhere. A redeploy now re-downloads
about 120 kB instead of 774. The admin screen, both room games, solo Square Off,
the leaderboard and the profile no longer land on someone who opens the home
page and stops there.

What is left is `@supabase/supabase-js` at 217 kB, a third of first paint.
Deferring it means the app renders before it knows whether anyone is signed in,
which is a flash of the signed-out home page on every load — a worse trade than
the bytes are worth, until the auth check itself gets faster.

## Solo is a hook AND a page, not one per game

`useSoloBoard(engine, plain, challenge)` plays any board against the bot and
`BoardSoloPage` draws every one of them. Every solo screen is now a handful of
lines naming an engine.

That was not true twice, and it broke the same way both times. `MemorySoloPage`
was hand-written and shipped with a dead **End session** button, because the
shared page owns the session-over screen and a copy of it does not — the button
set a flag nothing rendered. If you are about to write a solo screen by hand,
this is the paragraph telling you not to.

The board is a render function rather than a component with fixed props. It was
the latter while every board was a grid of marks, and broke the moment Memory
needed the deck too. Each game also decides what "you may tap this" means for
it: Memory's second tap lands during `asking`, where a Square Off board must
look untappable.

The bot is deliberately not a solved player in either game. A perfect Tic Tac
Toe opponent draws every single time, which is not a game — `botSquare` and
`botColumn` win, block, take the middle, and are otherwise loose, and
`botIsRight` makes the bot miss questions at a rate set by their difficulty so
its skill is visible rather than a hidden dice roll.

Routes are `/tictactoe`, `/connect4`, `/connect4trivia`, and the catalogue
cards point at them instead of at `/rooms`. They shipped room-only, which meant
the games most likely to be played with a younger sibling could not be played
unless she was holding a second phone.

## Content has a deadline, not just an error path

`loadContent` falls back to the bundled puzzle set when the database returns an
error — but a request that never comes back is not an error. Patchy signal or a
captive portal used to leave every game on "Dealing questions…" for as long as
the tab stayed open, with a perfectly good bundled set unused in the same file.
`withTimeout` bounds it at `CONTENT_TIMEOUT_MS` (6s) and treats silence and
failure the same, because they are the same to whoever is staring at the
screen. Six seconds is a compromise: shorter and a merely-slow connection gets
the 51 bundled questions instead of the 1,787 live ones.

## A move can cost a shot instead of an answer

`rooms.challenge` is `trivia` or `catapult`. It exists because trivia gates a
square on knowledge, and an eight-year-old loses that to an adult at every
difficulty setting — the dial was worth building but it is not what an age gap
needs. Aim is close to age-neutral, and it is learnable: the target moves every
turn but the physics never do.

The board never learns which it was. `phase === "asking"` has always meant "a
thing must resolve true or false before the move lands", and a shot resolves it
through the same `answer()` as a question. That is what the `useBoardRoom`
refactor bought.

The target is seeded on `updated_at` — the moment the turn was written, which
both clients already read off the same row — so two phones show the same target
with no extra column. `challenge/rules.ts` is import-free and pure: the
component draws with it, the bot aims with it, and `check-catapult.mts` holds
all three to the same rules, including that the arc drawn on screen ENDS where
the verdict says it landed.

The first version had no preview at all, on the theory that showing one turns
aiming into tracing. That was wrong, and it made the thing unplayable: every
shot was a blind guess and the only feedback arrived after the turn was already
spent. It now shows the opening 55% of the flight as dots — the genre
convention — which reads direction and curvature and leaves the distance to
you. The dots are spaced by a fixed distance ALONG THE GROUND rather than by
equal slices of time, because equal time bunches them at the top of the arc
where the shot is slowest and least informative.

**The pull is a vector, not a position.** It used to be measured from the
launcher to your finger, and the launcher sits near the left edge where it
belongs — you are shooting rightwards across the field. That left nothing
behind it to pull from: reaching full power meant dragging your thumb off the
side of the phone, so most of the power range was physically unreachable and
every shot came out weak. The drag now starts wherever you touch and only the
delta matters, so the whole range is available from anywhere on the field. The
arm still draws at the catapult, and the gesture draws a faint line back to
where the finger went down, so the thing you are aiming and the thing you are
touching stay visibly connected.

**Both axes are drawn at one scale.** They were not: the vertical was squashed
40% so a steep lob would fit, which meant the arc you watched was not the arc
the ball flew and there was nothing to learn from watching it. The angle is
capped at 55° instead — the height of a shot landing at x is x·tan(angle)/4, so
55° keeps the tallest useful shot inside a 1:0.4 picture — and `check-catapult`
asserts that no reachable shot can leave the field.

The preview is generated by `arc()`, the same function the shot is drawn with,
and every dot is asserted to satisfy the equation of motion the ball follows.
The first version asserted only that the drawn path ENDED in the right place,
which passes happily while the shape on screen is wrong.

There is no countdown — the room keeps a 30s deadline so an idle player cannot
freeze the board, but no bar is drawn, because a clock ticking at a child
lining up a shot is the pressure this mode exists to remove.

Two React deadlocks were found by playing it, both the same shape: an effect
that schedules the bot's shot, listing something it sets in its own dependency
array. Setting it re-ran the effect and the cleanup cancelled the timer that
would have committed the bot's move, so the bot took aim and the game sat there
forever. Once through state (`botFires`), once through an object rebuilt every
render (`targetFor` is memoised on the seed now).

## Memory Match, and what it cost to fit in

Sixteen tiles, eight pairs, a match keeps the turn. It is the one game here
where being eight is not a disadvantage: recall of where a thing was is flat
across ages, and a child on a run of matches keeps going and runs away with it.

It reuses `useBoardRoom` and `useSoloBoard` whole, which took three small
widenings rather than a fourth copy of anything:

- **Both taps go through `flip`.** The first opens a pair, the second closes it.
  So `place` and `pick` are the same function, and `answer` returns the state it
  was given — a memory turn resolves on a tap, not on an answer.
- **`choose` no longer checks the phase.** Memory's second tap lands during
  `asking`, and every reducer already refuses an illegal move by returning the
  state unchanged. The reducer is the authority; the hook was keeping a second,
  staler copy of the rules.
- **`challenge: "none"`.** The asking phase needs no question and no target, so
  nothing is fetched and nothing is dealt.

The bot has a memory span, not a dice roll: it consults the last `BOT_SPAN`
tiles it was shown, kept by the hook and filled in by the engine's `observe`.
Perfect recall wins this game every time, which is not a game — measured, not
assumed. `check-memory.mts` plays it three ways: a memory beats no memory, two
equal memories are an even match, and someone who remembers more than it does
wins about 85% of the time. That last one is the point.

Watch for `slice(-0)`. A bot told to remember nothing had perfect recall,
because `slice(-0)` is `slice(0)` and returns everything.

## Ball Sort is a race, and nothing on a phone solves it

Six tubes, five colours, four of each, one tube empty, and the PHYSICAL rules:
the top ball of any tube goes onto any tube with room. The "same colour only"
rule every app clone uses is not in the game — a real set of tubes lets you
park a red on a blue to dig out the green underneath, and that parking is half
the plan. The opponent is time. Solo is TODAY'S TUBES: one board per level per
day (`dailySeed(day, level)`, hashed from the player's own calendar day like
streaks are), everyone on the same one, ranked by the server's stopwatch. In a
room it is the same board on two phones, first to sort it wins. There is no
bot: a bot in a race against the clock is furniture, and it was removed.

Measured consequences of the physical rules, on 205 random boards:

- Every board is solvable and there are no dead ends — any move can be taken
  back as a move, so the position graph is undirected. Under the same-colour
  rule only 27% of random boards were solvable.
- Shortest solutions run 13–24 moves, median 20; most boards have hundreds of
  equally short lines, so "one forced line" difficulty does not exist. The only
  difficulty dial is length: easy ≤ 18, medium 19–21, hard ≥ 22.
- **A phone cannot solve one.** Plain BFS did not finish (6.7M states, 33s).
  A* with a good bound: median 0.2s, worst case over 17s — on a Mac.

So `src/features/sort/rules.ts` contains no solver. `scripts/sort-bank.mts`
runs A* offline (minutes; run several workers, then `emit`) and writes
`bank.ts`: 100 boards per band with one shortest line each, sorted so the
cheapest-to-verify come first. `puzzleFor(seed, level)` is one seeded pick from
a shelf; both phones and the edge function make the same pick. The line is the
proof behind `par` — check-sort replays every one — and nothing else uses it.

The solo clock is the server's. `sort_solo_start` writes an attempt row at the
first lift; the phone shows its own stopwatch but the number that ranks is
`now() - started_at` stamped by `sort_solo_finish`, service-role only, called
by the edge function after it has replayed the moves. `sort_daily_best` is each
player's best finished attempt per day and level; the page shows the top
twenty and your own row if you are below them. Going again is a new attempt
at the same board. Practice is the same page off the record: a random bank
board, timed on the phone only, no attempt row, no ladder.

The board does not hint. Nothing lights up to say where a ball can go; the one
thing it says is NO, by shaking a full tube, because a silent refusal reads as
a broken tap. `check-sort.mts` holds the bank to account: every line legal and
exactly par, par inside its band, the bound never above par, no duplicates, and
an independent iterative-deepening search re-solving the first two boards of
each shelf. `supabase/functions/sort-finish/` carries byte copies of `rules.ts`
AND `bank.ts`; the check fails if either drifts.

**The film.** Every ball that moves is logged with its time (`Game.log`,
take-backs included as the ball going home; `history` stays the undo stack).
The referee stores the log on the attempt only if it is itself a legal line
that finishes the board (`logSolves`), so a film on the ladder is always of a
real solve. `frameAt(replay, t)` in rules.ts is the whole playback model —
moves landed, the one in the air, the run clock — scaled so a long solve fits
FIT_MS and holds the sorted board for HOLD_MS; the on-screen player
(`ReplayPlayer`) and the GIF are the same frames. Rooms keep the winner's
film on the race (`x_log`/`o_log`, timed from the deal); the loser never
finishes, so there is no film of a loss. The GIF writer is ours
(`src/shared/card/gif.ts`): one median-cut palette from the first frame so
nothing flickers, only changed pixels per frame, plain LZW. It exists because
the only moving picture every chat app plays without asking the browser for a
codec is a GIF; MediaRecorder gives MP4 on Safari and WebM on Chrome and
neither sends everywhere. Two things bit while writing it: the LZW code width
must widen one code LATER than counting your own dictionary suggests (the
decoder is one entry behind), and a median cut that splits at the weighted
median must let the median be the last entry, or a box whose popular colour
sorts last is peeled one shade at a time and the palette fills with greens.
Both are caught by decoding the output with Pillow, not by looking at it.

**Rooms: two lists of the same thing is one list too many.** The room modes
were in `rooms_mode_check` and again in `set_room_setup`; ballsort reached the
first and not the second, so the mode was unreachable from the lobby while the
table would have stored it happily. The constraint is the list now and the
function catches its violation, so adding a mode is one edit. The same shape of
bug cost Ball Sort rooms twice in a day: `sort_start` also picked its two seats
with `min(user_id)` on a uuid column, which is not a function that exists, and
nothing said so because nobody had ever dealt one. It claims the room start
ITSELF, where the board games have the lobby claim and then insert — so do not
claim before calling it.

**An empty table is a path nobody has run.** `sort_races` had zero rows, and
that emptiness was the evidence: every Ball Sort deal had been throwing. Two
more came out of probing the same row's whole life rather than reading it.
`sort_start` inserted `on conflict (room_id) do nothing` and nothing ever
deletes a race — `reopen_room` clears `room_rounds` and stops — so the SECOND
match in a room landed on the first one's row with `winner` still set: both
phones opened it already over, showing the last round's result and the last
round's film, permanently. The board games escape this only because
`startBoard` upserts unconditionally, which is safe because `claim_room_start`
lets exactly one caller through per match; `sort_start` had that guard and
declined to use it. And `sort_rematch` checked only that you were seated, so
the player who was LOSING could reset a live race — the seat on 2 moves wiping
the seat on 18. A rematch now needs `winner is not null` and RAISES when
refused, because `end_match` already hid behind a zero-row update once.
`c4_games` and `memory_games` are still empty. That is not proof they work.

**The schema file is a claim, and it was false.** `supabase/schema.sql` says
"paste into the SQL Editor and run". It could not rebuild this database: two
tables and five functions were live and absent from it — the whole username
system and the whole daily round, both called by the client every day — so a
rebuild produced an app whose signup could not set a name and whose daily
round returned nothing. It had also never received a fix applied that morning
as a migration, so running it would have restored a bug already fixed. Neither
was visible by reading, because nothing rebuilds from the file in normal work.
`npm run check:schema` now holds the cheap half offline: every table, view and
RPC the client names must be declared in the file. It cannot see drift inside
a function BODY — no shell here can reach the database — so when a body
changes, compare it against `pg_proc` by hashing both with comments and
whitespace stripped, which is how the two Ball Sort functions above were
confirmed identical to what is deployed. Migrations are the database's record;
this file is a second copy, and a second copy is a thing that drifts.

**A room game is (mode, bank, challenge), not (mode, bank).** Square Off and
Catapult Squares are the same mode and the same board; only what a move costs
tells them apart, and Catapult Squares draws on no bank, so on a fresh room the
lobby lit both. `npm run check:lobby` holds the invariant: whatever the row
says, at most one card is on.

The line in the bundle is the one honest cheat left: a script could read
`BANK` and play a board in a second. `sort_solo_finish` refuses a time under
150ms a move — two taps faster than a thumb — so the script gets no rank, but
a script that sleeps between moves would. Nothing here tries to tell that
from a person.

## The result card is the game's own picture

Every game ends with a card you can keep — a 1080² PNG drawn onto a canvas,
not a DOM screenshot. `src/shared/card/frame.ts` owns the frame: hot ground,
the game's name repeated behind, the headline, the score strip, the room and
the date, the wordmark, and `saveCard()` (the only place that hands over a
file; read its comment before touching it — iOS transient activation and
desktop Chrome's half-present Web Share both bit once). The middle of the card
is the game's, and which picture depends on what the card is FOR:

- A **session** card (a room match, a solo run of games) shows the game's
  ARTWORK — the catalogue art redrawn at card size on a tilted stage with the
  name as a sticker, via `artStage()`. The same picture every time for that
  game, so it is recognisable in a group chat at thumbnail size. A session is
  several games; the last board would be one game standing in for five, and a
  half-played one if the match was quit.
- A **result** card (one Ball Sort board, one trivia or picto round) shows the
  RESULT — `sortHero` draws the tubes as they finished, `roundHero` the ten
  right-or-wrong dots over the score — because there the board is the score,
  the way a Wordle share is the grid.

Each slice exports its art from its own `card.ts`. Rooms pass it to
`useMatchChrome`, solo boards to `BoardSoloPage`, rounds to `Summary` by naming
the game.

Fonts on a canvas are loaded or they are not: `drawCard` awaits
`document.fonts.ready` first, or the first card of a session comes out in the
system fallback. To look at cards without playing a session to the end, build
a scratch Vite entry that imports the heroes and calls `drawCard` with
fixtures, and serve Fredoka and Nunito locally to the headless browser — the
Google Fonts link does not resolve from an agent shell.

## A game fills the screen; it does not flow down it

A phone in Safari gives a page **534px** between the header and the bottom
bar. The same phone with the app on its home screen gives **714**. The app's
own chrome is 62px of header, 62px of bottom bar and main's padding —
`--chrome` in index.css is those numbers and nothing else.

Laid out by flow, a game screen puts its board first (sized by the width of
the phone, so ~360px tall whatever is left) and appends the question under it.
The survey in STATUS.md measured what that cost: Square Off's four answers sat
227px below the fold, Connect 4 Trivia's 274px, and both catapult modes cut
the catapult in half. The board was always visible and the control never was.

So a play screen is a **fixed-height column**, not a document:

- `PlaySurface` is exactly `100dvh - var(--chrome)` tall — `dvh`, so Safari's
  bars count — and scrolls only as a safety valve.
- `PlayRow` is a fixed part: the seats, the caption, the question panel. It
  takes its natural height and is never squeezed.
- `PlayBoard` is the leftover: `flex-1 min-h-0`, and it MEASURES itself with a
  ResizeObserver and hands its child a pixel width of `min(w, h × ratio)`.
  Every board takes a `width` prop and draws to it.

The measurement is not squeamishness about CSS. "Fit a box of known aspect
ratio inside another box" has no honest pure-CSS answer: `aspect-ratio` with a
fixed height ignores `max-width`, and with a fixed width it ignores
`max-height`, so one of the two always breaks and the cells stop being square.
A second trap: inside a centring parent a grid with only `max-width` shrinks to
its content — Square Off's board rendered at 108px in a 358px box until it was
given an explicit width.

When the space left is under ~78px the board is not drawn at all. On a Safari
phone with four answers up that is what happens, and it is the right answer:
the caption already says "You're going for square 5", and a smear of nine grey
dots is not a board. On a taller phone the same screen shows it.

`npm run check:layout` holds the shape — every play screen is a surface, every
board is drawn at a measured width, and the chrome numbers still match the
Shell. It cannot prove pixels; `node scripts/survey-screens.mjs dist` does
that, in a browser, when a screen changes shape.

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
next pick, and a turn with a steal had two of them — nearly five seconds of
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

# what a phone actually sees — needs playwright, so not part of the build
npx vite build --outDir dist && node scripts/survey-screens.mjs dist

# the Ball Sort bank (slow, offline; two workers, then merge)
node --experimental-strip-types scripts/sort-bank.mts run 0 50 &
node --experimental-strip-types scripts/sort-bank.mts run 1 50 ; wait
node --experimental-strip-types scripts/sort-bank.mts emit 100
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
