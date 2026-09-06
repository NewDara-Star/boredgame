# REVIEW — edge-case & hardening pass

Branch: `review` (forked from `main` @ 21344bd). **Nothing here is on `main` or in
production.** This branch changes CLIENT code only; no schema, RPC, RLS, grant or
edge-function was touched. Verified after every batch: `tsc --noEmit`, all 8
`check:*` invariant scripts, and a clean `vite build`.

Method: the whole `src/` tree + `supabase/` were read line-by-line across six
review passes (engines, realtime/rooms, auth/security, backend, solo/daily/
leaderboard, visual/UX/a11y). Every finding below was re-verified against the
real code before anything was changed.

---

## 1. Fixes applied on this branch

### High severity (real bugs a player hits)
- **Score vs. board desync** — `rooms/useBoardRoom.ts`. `apply()` booked the win
  even when the winning board write was refused (expired JWT / RLS / lost race),
  so a tally could move +1 for a game the opponent never sees end. `write()` now
  returns the error and the win is booked only when the write landed.
- **Replay/GIF reset every second** — `sort/SortRaceRoom.tsx`. The `film` memo
  depended on the `names` object, which `useMatchChrome` rebuilds on every 1s
  match-clock tick, so the winner's replay restarted (and dropped any in-flight
  GIF) once per second. Now depends on the winner's name as a primitive.
- **Guest stays "guest" after claiming an account** — `providers/AuthProvider.tsx`.
  `isGuest` reads the `is_anonymous` JWT claim, which doesn't flip until the token
  is reissued, so a just-claimed account kept seeing the guest prompts. Now forces
  `refreshSession()` on claim.

### Medium
- **Room crash on row delete** — `rooms/useBoardRoom.ts` + `sort/useSortRoom.ts`.
  A DELETE realtime event delivers `new` as `{}` (not null); decoding it crashed
  the room. Both subscribers now ignore DELETE / non-row payloads.
- **Catapult rAF leak** — `challenge/Catapult.tsx`. The flight animation loop was
  never cancelled; on unmount/remount it kept firing setState and `onFire` into a
  dead component. Now tracked in a ref and cancelled on cleanup / new shot.
- **Daily round can hang forever** — `daily/useDaily.ts`. The load path had no
  timeout (unlike `loadContent`), so a stalled connection stuck the screen on
  "Dealing today's round…". Each network step is now bounded (`withTimeout`).
- **Daily submit error wiped the result** — `daily/DailyPage.tsx`. A transient
  submit failure replaced the whole finished screen with a bare error line. The
  submit error now shows as a banner over the board; only a genuine load error
  takes the screen.
- **"Drawing the result…" forever** — `play/ResultScreen.tsx`. If canvas card
  drawing failed (error is swallowed upstream), the card area sat on "Drawing…".
  Falls back to a plain note after 6s (the score is shown above regardless).
- **Global reduced-motion** — `app/App.tsx`. Wrapped in `<MotionConfig
  reducedMotion="user">` so framer-motion respects the OS setting (kills the
  infinite contested-square pulse etc. for those users). Adds ~2.5KB gzip to the
  motion chunk.

### Low (correct + safe)
- **Contested square kept pulsing after it was won** — `squareoff/rules.ts`. The
  correct-but-continue branch left `target` set; now cleared like the win branch.
- **Leaderboard rank counted guests** — `leaderboard/useLeaderboard.ts`. The
  off-page "people ahead" count didn't exclude guests, though the board does, so
  an off-page player saw an inflated rank. Added the guest filter.
- **Near-miss on a multiple-choice answer** — `play/useRound.ts`. A wrong option
  could be flagged "so close" via string similarity; now only typed answers can.
- **Picto guess input unlabelled** — `picto/PictoGame.tsx`. Added `aria-label`.
- **Malformed picto spec crash** — `picto/PictoRenderer.tsx`. `spec.items.map`
  guarded with `?? []` (applied in the first batch).
- **Daily own-row accuracy** — `daily/useDaily.ts`. `mine` now fetched by a direct
  `maybeSingle()` query instead of the truncated top-50 board, so a rank-51+
  player can't replay the day (applied in the first batch).

---

## 2. Deferred — noted, not changed (needs judgement or device testing)

- **Landscape / very short viewports can hide the board** — `play/PlaySurface.tsx`
  + `index.css`. On a phone in landscape the fixed rows can starve the board box
  below its `min`, so it renders nothing. Real fix needs on-device testing to
  avoid regressing the portrait layout that was carefully tuned. **Worth doing.**
- **Ball Sort tubes are keyboard/screen-reader invisible** — `sort/Board.tsx`.
  Non-semantic `<g onPointerDown>`; every other board uses labelled `<button>`s.
  Moderate change; deferred to keep this pass low-risk.
- **A placed mark / answer option whose only path to visible is an animation** —
  `squareoff/Board.tsx`, `connect4/Board.tsx`, `squareoff/QuestionPanel.tsx`,
  `trivia/TriviaGame.tsx`. Real on a throttled/interrupted mount. Fixing means
  reworking the opacity-0 reveals without breaking the intended animation; wants
  care + visual testing. (Global reduced-motion above partially mitigates.)
- **Colour-only right/wrong in the live question panel** — `squareoff/QuestionPanel.tsx`,
  `trivia/TriviaGame.tsx`. Add a ✓/✗ or label (the end-of-round summary already does).
- **Sub-44px tap targets** — header profile link (36px), hint / 50-50 buttons.
  Bumping hit areas can shift layout; deferred to a deliberate spacing pass.
- **Unlock dialog has no focus trap / initial focus** — `play/Unlock.tsx`.
- **Off-page rank ignores tiebreaks** — `leaderboard/useLeaderboard.ts` (correct
  tiebreak needs an untested `.or()` against live data) and `sort/useSortSolo.ts`
  (ms tie ignores the moves tiebreak). Low impact; left for a tested change.
- **Daily hardcodes "out of 10"** — `daily/DailyPage.tsx`. Only wrong if a round
  ships <10 live puzzles; left as-is to not muddy the "same ten for everyone" copy.
- **Connect 4 keeps the picked column highlighted through the reveal** —
  `connect4/rules.ts`. Plausibly intentional (shows where the disc went); left alone.
- Smaller: `contact.html` has no viewport meta; `Counter` count-up ignores
  reduced-motion; some `text-soft` at ≤13px is borderline AA; `--chrome` omits
  `safe-area-inset-bottom`; picto auto-focus can reopen the keyboard each puzzle.

---

## 3. BACKEND / DB — NOT TOUCHED. Needs your decision (this is live production)

These are the most important findings, and they're all about **score/leaderboard
integrity through trusted client input**. The access-control layer (RLS, definer
segregation, `search_path` on every definer, the Ball Sort replay referee) is
genuinely solid — a player can't read or write another player's rows. But a
player *can currently lie about how well they did*. Fixing these changes the live
DB and the running client together, so I'm bringing them to you rather than
shipping them:

- **CRITICAL — `bump_room_score(p_room, p_user)`** (schema.sql ~520). Verifies the
  caller is a member, then increments the *caller-supplied* `p_user`'s score with
  no proof of a win. A losing player can loop it from the console and win the
  match. Tricky to fix cleanly because the stall-rescue path legitimately lets the
  OTHER player write a win for an absent winner — so we can't just "credit
  auth.uid()". Wants a server-verified outcome. **Discuss.**
- **CRITICAL — `submit_daily`** (schema.sql ~440). Writes client-supplied
  `score/correct/answered/ms` straight to the public daily leaderboard, unchecked.
  `rpc('submit_daily',{p_score:999999,...})` tops the board. Real fix = judge the
  round server-side (needs answers server-side too — see below).
- **HIGH — attempts → counters** (schema.sql ~211). A client can `insert into
  attempts(user_id,puzzle_id,correct:true)` on repeat; the trigger inflates the
  public `total_correct`/`total_answered` (which feed the main leaderboard).
- **HIGH — `room_rounds` writable by members** (schema.sql ~870). The `FOR ALL`
  policy lets a member set `winner_id` to themselves for any round.
- **HIGH — puzzle answers exposed** (schema.sql ~193). Live puzzles' `answer`/
  `answer_normalised` are readable by any client, and all trivia/daily judging is
  client-side. This is the architectural root of the two criticals — a real fix
  moves judging server-side and stops shipping answers.
- **HIGH — direct `update(username,avatar)` grant** (schema.sql ~315). Bypasses
  `set_username` validation/uniqueness (impersonation, oversized/control-char
  names, `javascript:` avatars). The client only ever uses the RPC, so **revoking
  this grant is low-risk** and is the easiest of the set to do safely.
- **MEDIUM — Ball Sort solutions shipped in `bank.ts` + no room time floor.** A
  script can replay the canned solution and "win" a race in ~0ms.
- Lower: `join_room` username unvalidated; `daily_round`/`touch_streak` callable
  for arbitrary dates; edge fn leaks raw DB error strings; `sort_solo_start`
  keeps its default PUBLIC execute grant.

If you want, the safe first step is revoking the `username/avatar` grant (no client
change needed) and adding a room-race time floor. The leaderboard criticals need a
short design conversation — moving answer-judging server-side is the real fix and
it's a chunk of work.

---

## 4. To try the branch
`git switch review && npm run dev` — or diff it: `git diff main..review`.
`git switch main` to go back; `main` is untouched.
