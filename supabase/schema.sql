-- BoredGame — Supabase schema
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- Single-player works without any of this; accounts, sync and head-to-head need it.

-- ============ helpers ============
-- Mirrors normalise() in src/shared/lib/normalise.ts. Change one, change the other.
-- search_path is pinned: without it a role could shadow regexp_replace and
-- change what "correct" means.
create or replace function normalise_answer(t text)
returns text language sql immutable
set search_path = pg_catalog, public
as $$
  select regexp_replace(lower(coalesce(t,'')), '[^a-z0-9]', '', 'g');
$$;

-- ============ admins ============
-- Its own table, not a boolean on profiles: a boolean is one loose policy away
-- from a user promoting themselves. Add rows from the Supabase dashboard only.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table admins enable row level security;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ============ profiles ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar text,
  total_answered int not null default 0,
  total_correct int not null default 0,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "profiles are public" on profiles;
create policy "profiles are public" on profiles for select using (true);
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4))
  on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============ content ============
do $$ begin create type game_key   as enum ('picto','trivia');            exception when duplicate_object then null; end $$;
do $$ begin create type render_kind as enum ('text','image');             exception when duplicate_object then null; end $$;
do $$ begin create type difficulty as enum ('easy','medium','hard');      exception when duplicate_object then null; end $$;
do $$ begin create type pub_status as enum ('draft','live','rejected');   exception when duplicate_object then null; end $$;

create table if not exists categories (
  id bigserial primary key,
  name text not null,
  slug text unique not null,
  game game_key
);
alter table categories enable row level security;
drop policy if exists "categories are public" on categories;
create policy "categories are public" on categories for select using (true);

insert into categories (name, slug) values
  ('Idioms','idioms'),('Food','food'),('Places','places'),('Everyday','everyday'),
  ('Music','music'),('Sport','sport'),('Science','science'),('Maths','maths'),
  ('Design','design'),('Film & TV','film-tv'),('Tech','tech'),('World','world')
on conflict (slug) do nothing;

-- One table for both games. `game` is what makes this one product rather than two
-- codebases; `render` is what lets a rebus be data instead of a design job.
create table if not exists puzzles (
  id bigserial primary key,
  game game_key not null default 'picto',
  render render_kind not null default 'text',
  spec jsonb,
  image_url text,
  prompt text,
  choices text[],
  answer text not null,
  answer_normalised text generated always as (normalise_answer(answer)) stored,
  alt_hint text not null,
  char_hint text not null,
  difficulty difficulty not null default 'easy',
  category_id bigint references categories(id),
  status pub_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),

  -- The junk that reached the 2025 database cannot reach this one.
  -- Scoped per game: picto answers are phrases, but a trivia answer is
  -- legitimately as short as "4".
  constraint answer_has_substance    check (length(trim(answer)) >= (case when game = 'picto' then 2 else 1 end)),
  constraint alt_hint_has_substance  check (length(trim(alt_hint))  >= 8),
  constraint char_hint_has_substance check (length(trim(char_hint)) >= 3),
  constraint picto_text_needs_spec   check (game <> 'picto' or render <> 'text'  or spec is not null),
  constraint picto_image_needs_url   check (game <> 'picto' or render <> 'image' or image_url is not null),
  constraint trivia_needs_prompt     check (game <> 'trivia' or (prompt is not null and array_length(choices,1) = 4)),
  -- A trivia question can never be presented with no correct option.
  constraint trivia_answer_in_choices check (game <> 'trivia' or answer = any(choices))
);
create index if not exists puzzles_live_idx on puzzles (status, game, difficulty);

alter table puzzles enable row level security;
drop policy if exists "live puzzles are public" on puzzles;
create policy "live puzzles are public" on puzzles for select using (status = 'live' or is_admin());
drop policy if exists "admins write puzzles" on puzzles;
create policy "admins write puzzles" on puzzles for all using (is_admin()) with check (is_admin());

-- ============ attempts ============
create table if not exists attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id bigint not null references puzzles(id) on delete cascade,
  correct boolean not null,
  ms_taken int,
  created_at timestamptz default now()
);
create index if not exists attempts_user_idx on attempts (user_id, created_at desc);
alter table attempts enable row level security;
drop policy if exists "own attempts readable" on attempts;
create policy "own attempts readable" on attempts for select using (auth.uid() = user_id);
drop policy if exists "own attempts insert" on attempts;
create policy "own attempts insert" on attempts for insert with check (auth.uid() = user_id);

create or replace function bump_profile_counters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    total_answered = total_answered + 1,
    total_correct  = total_correct + (case when new.correct then 1 else 0 end)
  where id = new.user_id;
  return new;
end; $$;
drop trigger if exists on_attempt_created on attempts;
create trigger on_attempt_created after insert on attempts
  for each row execute function bump_profile_counters();

-- ============ head-to-head ============
do $$ begin create type room_status as enum ('waiting','playing','finished','abandoned'); exception when duplicate_object then null; end $$;

create table if not exists rooms (
  id bigserial primary key,
  code text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  game game_key not null default 'picto',
  status room_status not null default 'waiting',
  best_of int not null default 5,
  created_at timestamptz default now()
);
create table if not exists room_players (
  room_id bigint references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  score int not null default 0,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);
create table if not exists room_rounds (
  id bigserial primary key,
  room_id bigint not null references rooms(id) on delete cascade,
  puzzle_id bigint not null references puzzles(id),
  round_no int not null,
  winner_id uuid references auth.users(id),
  started_at timestamptz default now(),
  ended_at timestamptz,
  unique (room_id, round_no)
);

alter table rooms        enable row level security;
alter table room_players enable row level security;
alter table room_rounds  enable row level security;

drop policy if exists "rooms readable" on rooms;
create policy "rooms readable" on rooms for select using (true);
drop policy if exists "create own room" on rooms;
create policy "create own room" on rooms for insert with check (host_id = auth.uid());
drop policy if exists "host updates room" on rooms;
create policy "host updates room" on rooms for update using (host_id = auth.uid());

drop policy if exists "players readable" on room_players;
create policy "players readable" on room_players for select using (true);
drop policy if exists "join a room" on room_players;
create policy "join a room" on room_players for insert with check (user_id = auth.uid());
drop policy if exists "update own score" on room_players;
create policy "update own score" on room_players for update using (user_id = auth.uid());

drop policy if exists "rounds readable" on room_rounds;
create policy "rounds readable" on room_rounds for select using (true);
drop policy if exists "members write rounds" on room_rounds;
create policy "members write rounds" on room_rounds for all
  using (exists (select 1 from room_players p where p.room_id = room_rounds.room_id and p.user_id = auth.uid()))
  with check (true);

-- This is the entire "websocket" implementation. Both browsers subscribe;
-- Postgres pushes the changes. No socket code exists in the app.
do $$ begin
  alter publication supabase_realtime add table rooms;        exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table room_players; exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table room_rounds;  exception when duplicate_object then null; end $$;

-- ============ hardening ============
-- These two are trigger functions. They run SECURITY DEFINER so they can write
-- to profiles, but nothing should reach them over the REST API —
-- bump_profile_counters via RPC would let anyone inflate another player's stats.
revoke execute on function public.bump_profile_counters() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- is_admin() stays callable on purpose: RLS policies evaluate it as the querying
-- role, so revoking it would break every policy that uses it. It only reports
-- whether the caller is an admin, which the caller already knows.

-- `admins` has RLS on and no policies. That is deliberate: it denies all client
-- access. Rows are added from the Supabase dashboard only.

-- ============ streaks and the leaderboard ============
alter table public.profiles
  add column if not exists streak      int  not null default 0,
  add column if not exists best_streak int  not null default 0,
  add column if not exists last_played  date;

-- A leaderboard makes profiles worth lying about. "own profile update" let any
-- signed-in player set total_answered to whatever they liked; nobody saw it, so
-- it did not matter. It does now. Only the display fields are theirs to write.
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar) on public.profiles to authenticated;

-- Streak is advanced server-side for the same reason.
create or replace function public.touch_streak(p_local_date date default null)
returns public.profiles
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid       uuid := auth.uid();
  utc_today date := (now() at time zone 'utc')::date;
  d         date;
  prev      date;
  cur       int;
  rec       public.profiles;
begin
  if uid is null then
    raise exception 'touch_streak requires a signed-in user';
  end if;

  -- The client sends its own calendar date, so a player at UTC+13 is not told
  -- their streak broke at teatime. A day either side of UTC is as far as it is
  -- trusted; past that the clock is wrong or someone is fishing.
  d := coalesce(p_local_date, utc_today);
  if abs(d - utc_today) > 1 then d := utc_today; end if;

  select p.last_played, p.streak into prev, cur from public.profiles p where p.id = uid;

  if prev is null then       cur := 1;
  elsif d <= prev then       null;            -- already counted today
  elsif d = prev + 1 then    cur := cur + 1;
  else                       cur := 1;        -- a day was missed
  end if;

  update public.profiles p set
    streak      = cur,
    best_streak = greatest(p.best_streak, cur),
    last_played = greatest(coalesce(p.last_played, d), d)
  where p.id = uid
  returning p.* into rec;

  return rec;
end; $$;

revoke all on function public.touch_streak(date) from public, anon;
grant execute on function public.touch_streak(date) to authenticated;

-- ============ Square Off ============
-- Rooms already do "same puzzle, first correct answer wins". Square Off is a
-- different shape on the same plumbing, so rooms gain a mode rather than a
-- second room system.
alter table public.rooms
  add column if not exists mode text not null default 'race'
    check (mode in ('race', 'squareoff'));

create table if not exists public.ttt_games (
  room_id   bigint primary key references public.rooms(id) on delete cascade,
  -- nine characters, 'x' | 'o' | '-'. A text board is trivially diffable in the
  -- dashboard when something goes wrong mid-match, which an array is not.
  board     text not null default '---------' check (char_length(board) = 9),
  turn      text not null default 'x' check (turn in ('x','o')),
  phase     text not null default 'picking'
              check (phase in ('picking','asking','revealed','over')),
  target    smallint check (target between 0 and 8),
  -- Dead since the steal was removed: a miss costs the turn and nothing else.
  -- Kept, rather than dropped, so a client still running the old build can
  -- insert. Nothing reads it. Drop it once nothing old is deployed.
  steal     boolean not null default false,
  last      jsonb,
  winner    text check (winner in ('x','o','draw')),
  puzzle_id bigint references public.puzzles(id),
  x_player  uuid references auth.users(id) on delete set null,
  o_player  uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.ttt_games enable row level security;

drop policy if exists "ttt readable by anyone with the code" on public.ttt_games;
create policy "ttt readable by anyone with the code" on public.ttt_games
  for select using (true);

-- Only the two people sitting at the board may move it.
drop policy if exists "ttt written by members" on public.ttt_games;
create policy "ttt written by members" on public.ttt_games
  for all using (
    exists (select 1 from public.room_players p
            where p.room_id = ttt_games.room_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.room_players p
            where p.room_id = ttt_games.room_id and p.user_id = auth.uid())
  );

do $$ begin
  alter publication supabase_realtime add table public.ttt_games;
  exception when duplicate_object then null;
end $$;

-- ============ the lobby ============
alter table public.room_players
  add column if not exists ready boolean not null default false;

-- "update own score" let a player write any column of their own row, score
-- included. bump_room_score() is the only thing that should move a score.
revoke update on public.room_players from authenticated, anon;
grant update (ready) on public.room_players to authenticated;

create or replace function public.bump_room_score(p_room bigint, p_user uuid)
returns int language plpgsql security definer set search_path to 'public' as $$
declare new_score int;
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  update public.room_players set score = score + 1
   where room_id = p_room and user_id = p_user returning score into new_score;
  return coalesce(new_score, 0);
end $$;
revoke all on function public.bump_room_score(bigint, uuid) from public, anon;
grant execute on function public.bump_room_score(bigint, uuid) to authenticated;

-- Either member can change the setup, and doing so clears both ready flags —
-- that is what makes "ready" mean "I agree to this".
create or replace function public.set_room_setup(
  p_room bigint, p_mode text, p_game text, p_categories text[]
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  if p_mode not in ('race', 'squareoff') then
    raise exception 'unknown mode %', p_mode;
  end if;
  update public.rooms r set
    mode = p_mode, game = p_game::game_key, categories = nullif(p_categories, '{}')
  where r.id = p_room and r.status = 'waiting';
  update public.room_players p set ready = false where p.room_id = p_room;
end $$;
revoke all on function public.set_room_setup(bigint, text, text, text[]) from public, anon;
grant execute on function public.set_room_setup(bigint, text, text, text[]) to authenticated;

-- ============ starting, and leaving ============
-- Starting was guarded only by "am I the host" in React. That holds against two
-- people but not against one client's effect firing twice, and a second deal
-- wipes a board already in play. The database decides who starts.
create or replace function public.claim_room_start(p_room bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare moved int;
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  -- The predicate is the lock: a second caller blocks, re-reads 'playing',
  -- and updates nothing.
  update public.rooms set status = 'playing' where id = p_room and status = 'waiting';
  get diagnostics moved = row_count;
  return moved = 1;
end $$;
revoke all on function public.claim_room_start(bigint) from public, anon;
grant execute on function public.claim_room_start(bigint) to authenticated;

alter table public.room_players
  add column if not exists last_seen timestamptz not null default now();
grant update (ready, last_seen) on public.room_players to authenticated;

create or replace function public.touch_presence(p_room bigint)
returns void language sql security definer set search_path to 'public' as $$
  update public.room_players set last_seen = now()
   where room_id = p_room and user_id = auth.uid();
$$;
revoke all on function public.touch_presence(bigint) from public, anon;
grant execute on function public.touch_presence(bigint) to authenticated;

-- ============ seats ============
alter table public.rooms
  add column if not exists capacity int not null default 2
  check (capacity between 2 and 8);

-- Joining was an open INSERT policy: anyone with the code could add themselves,
-- at any point. A third player who never tapped Ready blocked the lobby forever,
-- because starting needs EVERY player ready.
drop policy if exists "join a room" on public.room_players;

create or replace function public.join_room(p_room bigint, p_username text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); seats int; taken int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  -- Locks the room row, so two people reaching for the last seat are serialised
  -- rather than both counting 1 and both inserting.
  select capacity into seats from public.rooms where id = p_room for update;
  if seats is null then return 'missing'; end if;
  if exists (select 1 from public.room_players p
             where p.room_id = p_room and p.user_id = uid) then return 'already'; end if;
  if (select status from public.rooms where id = p_room) <> 'waiting' then return 'started'; end if;
  select count(*) into taken from public.room_players where room_id = p_room;
  if taken >= seats then return 'full'; end if;
  insert into public.room_players(room_id, user_id, username, ready)
  values (p_room, uid, p_username, false);
  return 'joined';
end $$;
revoke all on function public.join_room(bigint, text) from public, anon;
grant execute on function public.join_room(bigint, text) to authenticated;

-- ============ three more room modes ============
-- Plain Tic Tac Toe, plain Connect 4 and Connect 4 Trivia. The two plain ones
-- draw on no bank at all; rooms.game stays NOT NULL and is simply ignored.
alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check
  check (mode in ('race','squareoff','tictactoe','connect4','connect4trivia'));

create or replace function public.set_room_setup(
  p_room bigint, p_mode text, p_game text, p_categories text[])
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  if p_mode not in ('race','squareoff','tictactoe','connect4','connect4trivia') then
    raise exception 'unknown mode %', p_mode;
  end if;
  update public.rooms r set
    mode = p_mode, game = p_game::game_key, categories = nullif(p_categories, '{}')
  where r.id = p_room and r.status = 'waiting';
  update public.room_players p set ready = false where p.room_id = p_room;
end $$;

-- Same shape as ttt_games: one row per room, the board as a string, and the
-- phase machine the reducer writes. 42 cells, row 0 is the top.
create table if not exists public.c4_games (
  room_id    bigint primary key references public.rooms(id) on delete cascade,
  board      text not null default '------------------------------------------'
             check (char_length(board) = 42),
  turn       text not null default 'x' check (turn in ('x','o')),
  phase      text not null default 'picking'
             check (phase in ('picking','asking','revealed','over')),
  target     smallint check (target between 0 and 6),
  last       jsonb,
  winner     text check (winner in ('x','o','draw')),
  puzzle_id  bigint references public.puzzles(id),
  x_player   uuid references auth.users(id) on delete set null,
  o_player   uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.c4_games enable row level security;

drop policy if exists "c4 readable by anyone with the code" on public.c4_games;
create policy "c4 readable by anyone with the code" on public.c4_games
  for select using (true);

drop policy if exists "c4 written by members" on public.c4_games;
create policy "c4 written by members" on public.c4_games
  for all using (exists (select 1 from public.room_players p
                         where p.room_id = c4_games.room_id and p.user_id = auth.uid()))
      with check (exists (select 1 from public.room_players p
                          where p.room_id = c4_games.room_id and p.user_id = auth.uid()));

-- Without this the opponent's screen never hears about a move: the board only
-- updates for whoever wrote it.
do $$ begin
  alter publication supabase_realtime add table public.c4_games;
exception when duplicate_object then null; end $$;

-- ============ a room outlives one game ============
-- Rematch keeps the tally and replays the same game. This sends the room back
-- to its lobby so the same two people can agree a DIFFERENT game without a new
-- code. A new game is a new match: no score, no rounds, nobody ready.
create or replace function public.reopen_room(p_room bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  update public.rooms set status = 'waiting' where id = p_room and status <> 'waiting';
  update public.room_players set ready = false, score = 0 where room_id = p_room;
  -- startNextRound derives the round number from the highest existing round, so
  -- without this a reopened race room resumes at 6 of 5 and ends immediately.
  delete from public.room_rounds where room_id = p_room;
end $$;
revoke all on function public.reopen_room(bigint) from public, anon;
grant execute on function public.reopen_room(bigint) to authenticated;

-- Ending a match was a direct update to rooms, and the UPDATE policy on rooms
-- is host-only, so the guest's "end match" matched zero rows — which is not an
-- error, so it failed in silence. Either player sitting in the room may end it.
create or replace function public.end_match(p_room bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  update public.rooms set status = 'finished' where id = p_room;
end $$;
revoke all on function public.end_match(bigint) from public, anon;
grant execute on function public.end_match(bigint) to authenticated;

-- ============ how hard? ============
-- A room could narrow by category but not by difficulty, so every room dealt
-- from the whole bank — 360 of the 1,787 trivia questions are hard, which is
-- roughly one in five whoever is sitting there.
alter table public.rooms add column if not exists difficulty text[];

-- NOTE: p_difficulty is defaulted so a client that has not reloaded still
-- resolves, but `create or replace` with a new defaulted argument creates a
-- SECOND function rather than replacing the first, and four-argument calls then
-- fail with "function is not unique". Drop the old signature explicitly.
drop function if exists public.set_room_setup(bigint, text, text, text[]);

create or replace function public.set_room_setup(
  p_room bigint, p_mode text, p_game text, p_categories text[],
  p_difficulty text[] default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  if p_mode not in ('race','squareoff','tictactoe','connect4','connect4trivia') then
    raise exception 'unknown mode %', p_mode;
  end if;
  if p_difficulty is not null and exists (
       select 1 from unnest(p_difficulty) d where d not in ('easy','medium','hard')) then
    raise exception 'unknown difficulty in %', p_difficulty;
  end if;
  update public.rooms r set
    mode = p_mode, game = p_game::game_key,
    categories = nullif(p_categories, '{}'),
    difficulty = nullif(p_difficulty, '{}')
  where r.id = p_room and r.status = 'waiting';
  update public.room_players p set ready = false where p.room_id = p_room;
end $$;

-- ============ guests ============
-- Rooms required an account, and "a name and a password" is where a nine-year-old
-- or a grandparent stops. A guest signs in anonymously with a name and nothing
-- else. REQUIRES "Anonymous sign-ins" to be ON in Supabase → Authentication →
-- Sign In / Providers; with it off, signInAnonymously() errors and the app says
-- so rather than failing silently.
alter table public.profiles add column if not exists is_guest boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  wanted text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
  base   text;
  suffix text := substr(new.id::text, 1, 4);
  guest  boolean := coalesce(new.is_anonymous, false);
begin
  if wanted is not null and wanted ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from profiles where lower(username) = lower(wanted)) then
    insert into profiles (id, username, is_guest) values (new.id, wanted, guest)
      on conflict do nothing;
    return new;
  end if;
  -- A guest has no email at all, so the fallback has to survive a null.
  base := regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9_]', '', 'g');
  base := left(nullif(base, ''), 15);
  if base is null or length(base) < 2 then base := case when guest then 'guest' else 'player' end; end if;
  insert into profiles (id, username, is_guest) values (new.id, base || '_' || suffix, guest)
    on conflict do nothing;
  return new;
end; $$;

-- Claiming an account is an UPDATE on auth.users, so without this a claimed
-- account stays flagged a guest and never reaches the leaderboard it just earned.
create or replace function public.sync_guest_flag()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.is_anonymous, false) is distinct from coalesce(old.is_anonymous, false) then
    update public.profiles set is_guest = coalesce(new.is_anonymous, false) where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_claimed on auth.users;
create trigger on_auth_user_claimed after update on auth.users
  for each row execute function public.sync_guest_flag();

-- Every "just play" creates a permanent row. Run by hand, never scheduled:
--   select public.sweep_stale_guests(30);
create or replace function public.sweep_stale_guests(p_days int default 30)
returns int language plpgsql security definer set search_path to 'public', 'auth' as $$
declare n int;
begin
  with doomed as (
    select u.id from auth.users u
    join public.profiles p on p.id = u.id
    where coalesce(u.is_anonymous, false) and p.is_guest
      and u.created_at < now() - make_interval(days => p_days)
      and coalesce(p.total_answered, 0) = 0
      and not exists (select 1 from public.room_players rp where rp.user_id = u.id)
  )
  delete from auth.users u using doomed d where u.id = d.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.sweep_stale_guests(int) from public, anon, authenticated;

-- ============ a room is not a public directory ============
-- Anonymous sign-in turned two theoretical holes into free ones, because a
-- stranger now costs nothing to create.
--
-- 1. rooms was SELECT USING (true): anyone with the anon key could list every
--    room and read its code. A code should be the thing you share, not a row.
-- 2. room_rounds had USING (member) but WITH CHECK (true), and USING does not
--    gate INSERT — a stranger could deal a round into someone else's race.
--
-- Membership is answered by a definer function because a room_players policy
-- that queries room_players is infinite recursion.
create or replace function public.is_room_member(p_room bigint)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid());
$$;
revoke all on function public.is_room_member(bigint) from public;
grant execute on function public.is_room_member(bigint) to anon, authenticated;

-- Holding the code still gets you in: these two are the only way to see a room
-- you are not yet part of.
create or replace function public.find_room(p_code text)
returns public.rooms language sql stable security definer set search_path to 'public' as $$
  select r.* from public.rooms r where r.code = upper(btrim(p_code));
$$;
revoke all on function public.find_room(text) from public;
grant execute on function public.find_room(text) to anon, authenticated;

-- Names only, so the invite screen can still say who is waiting.
create or replace function public.room_peek(p_code text)
returns table (user_id uuid, username text, ready boolean)
language sql stable security definer set search_path to 'public' as $$
  select p.user_id, p.username, p.ready
  from public.room_players p join public.rooms r on r.id = p.room_id
  where r.code = upper(btrim(p_code));
$$;
revoke all on function public.room_peek(text) from public;
grant execute on function public.room_peek(text) to anon, authenticated;

-- host_id is in the rooms policy because createRoom inserts and immediately
-- selects the row back, and at that instant the host is not a player yet.
drop policy if exists "rooms readable" on public.rooms;
drop policy if exists "rooms readable by the people in them" on public.rooms;
create policy "rooms readable by the people in them" on public.rooms
  for select using (host_id = auth.uid() or public.is_room_member(rooms.id));

drop policy if exists "players readable" on public.room_players;
drop policy if exists "players readable by the people in the room" on public.room_players;
create policy "players readable by the people in the room" on public.room_players
  for select using (user_id = auth.uid() or public.is_room_member(room_players.room_id));

drop policy if exists "members write rounds" on public.room_rounds;
create policy "members write rounds" on public.room_rounds
  for all using (public.is_room_member(room_rounds.room_id))
      with check (public.is_room_member(room_rounds.room_id));

drop policy if exists "rounds readable" on public.room_rounds;
drop policy if exists "rounds readable by the people in the room" on public.room_rounds;
create policy "rounds readable by the people in the room" on public.room_rounds
  for select using (public.is_room_member(room_rounds.room_id));

drop policy if exists "ttt readable by anyone with the code" on public.ttt_games;
drop policy if exists "ttt readable by the people in the room" on public.ttt_games;
create policy "ttt readable by the people in the room" on public.ttt_games
  for select using (public.is_room_member(ttt_games.room_id));

drop policy if exists "ttt written by members" on public.ttt_games;
create policy "ttt written by members" on public.ttt_games
  for all using (public.is_room_member(ttt_games.room_id))
      with check (public.is_room_member(ttt_games.room_id));

drop policy if exists "c4 readable by anyone with the code" on public.c4_games;
drop policy if exists "c4 readable by the people in the room" on public.c4_games;
create policy "c4 readable by the people in the room" on public.c4_games
  for select using (public.is_room_member(c4_games.room_id));

drop policy if exists "c4 written by members" on public.c4_games;
create policy "c4 written by members" on public.c4_games
  for all using (public.is_room_member(c4_games.room_id))
      with check (public.is_room_member(c4_games.room_id));

-- ============ what a move costs ============
-- Trivia gates a square on knowledge, which an eight-year-old loses to an adult
-- however easy the questions are — no difficulty setting fixes an age gap on
-- general knowledge. A skill shot is close to age-neutral.
alter table public.rooms add column if not exists challenge text not null default 'trivia';
alter table public.rooms drop constraint if exists rooms_challenge_check;
alter table public.rooms add constraint rooms_challenge_check
  check (challenge in ('trivia','catapult'));

-- Same trap as last time: a new defaulted argument makes a SECOND function
-- rather than replacing the first, and every call with the old arity then fails
-- with "function is not unique". Drop the old signature explicitly.
drop function if exists public.set_room_setup(bigint, text, text, text[], text[]);

create or replace function public.set_room_setup(
  p_room bigint, p_mode text, p_game text, p_categories text[],
  p_difficulty text[] default null, p_challenge text default 'trivia')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  if p_mode not in ('race','squareoff','tictactoe','connect4','connect4trivia') then
    raise exception 'unknown mode %', p_mode;
  end if;
  if p_difficulty is not null and exists (
       select 1 from unnest(p_difficulty) d where d not in ('easy','medium','hard')) then
    raise exception 'unknown difficulty in %', p_difficulty;
  end if;
  if coalesce(p_challenge, 'trivia') not in ('trivia','catapult') then
    raise exception 'unknown challenge %', p_challenge;
  end if;
  update public.rooms r set
    mode = p_mode, game = p_game::game_key,
    categories = nullif(p_categories, '{}'),
    difficulty = nullif(p_difficulty, '{}'),
    challenge = coalesce(p_challenge, 'trivia')
  where r.id = p_room and r.status = 'waiting';
  update public.room_players p set ready = false where p.room_id = p_room;
end $$;

-- ============ memory match ============
-- Sixteen tiles, eight pairs, a match keeps the turn. The one game here where
-- being eight is not a disadvantage — recall of where a thing was is flat
-- across ages, and a child on a run keeps the turn and runs away with it.
alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check
  check (mode in ('race','squareoff','tictactoe','connect4','connect4trivia','memory'));

create table if not exists public.memory_games (
  room_id    bigint primary key references public.rooms(id) on delete cascade,
  -- dealt once by whoever starts and stored, so both phones turn over the same
  -- tiles without either of them shuffling
  deck       text not null check (char_length(deck) = 16),
  board      text not null default '----------------'
             check (char_length(board) = 16),
  turn       text not null default 'x' check (turn in ('x','o')),
  phase      text not null default 'picking'
             check (phase in ('picking','asking','revealed','over')),
  target     smallint check (target between 0 and 15),
  last       jsonb,
  winner     text check (winner in ('x','o','draw')),
  puzzle_id  bigint references public.puzzles(id),
  x_player   uuid references auth.users(id) on delete set null,
  o_player   uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.memory_games enable row level security;

drop policy if exists "memory readable by the people in the room" on public.memory_games;
create policy "memory readable by the people in the room" on public.memory_games
  for select using (public.is_room_member(memory_games.room_id));

drop policy if exists "memory written by members" on public.memory_games;
create policy "memory written by members" on public.memory_games
  for all using (public.is_room_member(memory_games.room_id))
      with check (public.is_room_member(memory_games.room_id));

-- c4_games shipped without this once already: the board only moves for whoever
-- tapped it, and the opponent's screen never hears a thing.
do $$ begin
  alter publication supabase_realtime add table public.memory_games;
exception when duplicate_object then null; end $$;

-- ============ a puzzle has many right answers ============
-- One string per puzzle made "read between the lines" wrong for "reading
-- between the lines", "six feet under" wrong for "six feet underground", and
-- "you're under arrest" wrong for "you are under arrest". The matcher lives in
-- shared/lib/normalise.ts and is deliberately client-only: nothing server-side
-- ever judges a typed answer, so the generosity needs no twin in SQL.
alter table public.puzzles add column if not exists accept text[];

-- What people typed and were told was wrong. The accept lists are guesses until
-- this has something in it. Normalised text only, capped, no user id: it exists
-- to rank the near-misses worth accepting, not to watch anybody play.
create table if not exists public.near_misses (
  puzzle_id  bigint not null references public.puzzles(id) on delete cascade,
  guess      text   not null check (char_length(guess) between 1 and 60),
  hits       int    not null default 1,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (puzzle_id, guess)
);
-- RLS on with NO policies: unreadable and unwritable from the client. The only
-- way in is the definer function, which strips the text first.
alter table public.near_misses enable row level security;

create or replace function public.log_near_miss(p_puzzle bigint, p_guess text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g text := btrim(left(lower(regexp_replace(coalesce(p_guess,''), '[^a-zA-Z0-9 ]', '', 'g')), 60));
begin
  if length(g) = 0 then return; end if;
  if not exists (select 1 from puzzles p where p.id = p_puzzle) then return; end if;
  insert into near_misses (puzzle_id, guess) values (p_puzzle, g)
  on conflict (puzzle_id, guess)
    do update set hits = near_misses.hits + 1, last_seen = now();
end $$;
revoke all on function public.log_near_miss(bigint, text) from public;
grant execute on function public.log_near_miss(bigint, text) to anon, authenticated;

-- Read it with:
--   select p.answer, n.guess, n.hits from near_misses n
--   join puzzles p on p.id = n.puzzle_id order by n.hits desc limit 40;

-- ============ Ball Sort, raced across two phones ============
-- Every other game in here syncs ONE board that both clients write, with a
-- single-writer rule to stop them racing each other. This is the opposite
-- shape: two independent boards from one seeded puzzle, and the only thing
-- being contended is who finished first.
--
-- That changes the security question. On a shared board the worst a bad write
-- does is desync a turn. Here, a plain member-level UPDATE policy would let
-- either player write the OTHER player's board, or post themselves a solved
-- one. So this table takes no direct writes at all: SELECT for members, and
-- every write goes through a definer function that works out your seat from
-- auth.uid() and touches only your own columns. Proven by impersonation, not
-- by reading the policy: a member's direct UPDATE matches zero rows.

alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check
  check (mode in ('race','squareoff','tictactoe','connect4','connect4trivia','memory','ballsort'));

create table if not exists public.sort_races (
  room_id    bigint primary key references public.rooms(id) on delete cascade,
  -- both phones derive the identical puzzle from this, so the tubes are never
  -- sent and cannot disagree
  seed       bigint not null,
  level      text not null default 'medium' check (level in ('easy','medium','hard')),
  -- the solver's shortest solution, stored when the race is dealt. Not a
  -- display number: it is a genuine lower bound, and sort_finish uses it to
  -- reject a finish that claims fewer moves than the puzzle can be solved in.
  par        smallint not null check (par >= 6),
  cap        smallint not null default 4 check (cap between 2 and 8),
  colours    smallint not null check (colours between 2 and 8),
  -- tubes as "0123/1032//" — one char per ball, "/" between tubes
  x_tubes    text not null,
  o_tubes    text not null,
  x_moves    int not null default 0 check (x_moves >= 0),
  o_moves    int not null default 0 check (o_moves >= 0),
  x_done_at  timestamptz,
  o_done_at  timestamptz,
  winner     text check (winner in ('x','o')),
  x_player   uuid references auth.users(id) on delete set null,
  o_player   uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sort_races enable row level security;

drop policy if exists "sort races readable by the people in the room" on public.sort_races;
create policy "sort races readable by the people in the room" on public.sort_races
  for select using (public.is_room_member(sort_races.room_id));

-- Deliberately NO insert/update/delete policy. The functions below are the
-- only way in, and each writes one seat's columns and no others.

create or replace function public.sort_seat(p_room bigint)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when r.x_player = auth.uid() then 'x'
    when r.o_player = auth.uid() then 'o'
  end
  from public.sort_races r where r.room_id = p_room;
$$;
revoke all on function public.sort_seat(bigint) from public, anon;
grant execute on function public.sort_seat(bigint) to authenticated;

-- Is this string a finished board: every tube empty, or exactly `cap` of one
-- colour? Cheap enough to run on every finish, and it is the difference
-- between trusting the client's "I won" and checking it.
create or replace function public.sort_is_solved(p_tubes text, p_cap int)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare t text;
begin
  foreach t in array string_to_array(p_tubes, '/') loop
    if length(t) > 0 then
      if length(t) <> p_cap then return false; end if;
      if length(replace(t, left(t, 1), '')) <> 0 then return false; end if;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.sort_start(
  p_room bigint, p_seed bigint, p_level text, p_par int,
  p_cap int, p_colours int, p_tubes text
) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_x uuid; v_o uuid;
begin
  if not public.is_room_member(p_room) then
    raise exception 'not a member of room %', p_room;
  end if;
  -- The database decides who deals, exactly as the board games do: a
  -- client-side host check holds against two people but not against one
  -- client's effect firing twice.
  if not public.claim_room_start(p_room) then return false; end if;

  select min(user_id), max(user_id) into v_x, v_o
  from public.room_players where room_id = p_room;

  insert into public.sort_races
    (room_id, seed, level, par, cap, colours, x_tubes, o_tubes, x_player, o_player)
  values (p_room, p_seed, p_level, p_par, p_cap, p_colours, p_tubes, p_tubes, v_x, v_o)
  on conflict (room_id) do nothing;
  return true;
end $$;
revoke all on function public.sort_start(bigint, bigint, text, int, int, int, text) from public, anon;
grant execute on function public.sort_start(bigint, bigint, text, int, int, int, text) to authenticated;

-- A pour. Writes your seat's board and move count, and nothing else in the row.
create or replace function public.sort_move(p_room bigint, p_tubes text, p_moves int)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_seat text;
begin
  v_seat := public.sort_seat(p_room);
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;

  update public.sort_races
     set x_tubes = case when v_seat = 'x' then p_tubes else x_tubes end,
         x_moves = case when v_seat = 'x' then p_moves else x_moves end,
         o_tubes = case when v_seat = 'o' then p_tubes else o_tubes end,
         o_moves = case when v_seat = 'o' then p_moves else o_moves end,
         updated_at = now()
   where room_id = p_room and winner is null;
end $$;
revoke all on function public.sort_move(bigint, text, int) from public, anon;
grant execute on function public.sort_move(bigint, text, int) to authenticated;

-- Crossing the line.
--
-- Who won is settled HERE and not on either phone: Dublin and Manchester will
-- disagree about the order of two finishes a second apart, and the database is
-- the only place with one clock. `coalesce(winner, v_seat)` under the row lock
-- means the second caller sees the first's answer and cannot overwrite it.
--
-- What this checks: you are seated, the race is live, the board you posted is
-- genuinely sorted, and your move count is at least par — which no legitimate
-- solve can be under, because par IS the shortest solution. What it does not
-- check is that you reached that board by legal pours; proving that needs the
-- move list replayed against the seeded puzzle. Named rather than implied.
create or replace function public.sort_finish(p_room bigint, p_tubes text, p_moves int)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_seat text; v_row public.sort_races;
begin
  v_seat := public.sort_seat(p_room);
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;

  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.winner is not null then return v_row.winner; end if;

  if not public.sort_is_solved(p_tubes, v_row.cap) then
    raise exception 'that board is not sorted';
  end if;
  if p_moves < v_row.par then
    raise exception 'a % move solve is below par (%)', p_moves, v_row.par;
  end if;

  update public.sort_races
     set x_tubes   = case when v_seat = 'x' then p_tubes else x_tubes end,
         x_moves   = case when v_seat = 'x' then p_moves else x_moves end,
         x_done_at = case when v_seat = 'x' then now() else x_done_at end,
         o_tubes   = case when v_seat = 'o' then p_tubes else o_tubes end,
         o_moves   = case when v_seat = 'o' then p_moves else o_moves end,
         o_done_at = case when v_seat = 'o' then now() else o_done_at end,
         winner     = coalesce(winner, v_seat),
         updated_at = now()
   where room_id = p_room
   returning winner into v_seat;
  return v_seat;
end $$;
revoke all on function public.sort_finish(bigint, text, int) from public, anon;
grant execute on function public.sort_finish(bigint, text, int) to authenticated;

-- A rematch: new seed, new puzzle, both boards back to the start.
create or replace function public.sort_rematch(
  p_room bigint, p_seed bigint, p_par int, p_colours int, p_tubes text
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if public.sort_seat(p_room) is null then
    raise exception 'not seated in race %', p_room;
  end if;
  update public.sort_races
     set seed = p_seed, par = p_par, colours = p_colours,
         x_tubes = p_tubes, o_tubes = p_tubes,
         x_moves = 0, o_moves = 0, x_done_at = null, o_done_at = null,
         winner = null, started_at = now(), updated_at = now()
   where room_id = p_room;
end $$;
revoke all on function public.sort_rematch(bigint, bigint, int, int, text) from public, anon;
grant execute on function public.sort_rematch(bigint, bigint, int, int, text) to authenticated;

-- Finishing a race is no longer something a client may assert.
--
-- The three-argument sort_finish above took your word that a sorted board was
-- one you had played to. It checked the board really was sorted and that the
-- move count was at least par, which stops the lazy cheat, but anyone who read
-- the client could call it from a console with "0000/1111/2222/3333//" and win
-- without touching a tube.
--
-- The only caller now is the sort-finish edge function, which REPLAYS your
-- move list against the puzzle the seed generates — importing the very same
-- src/features/sort/rules.ts both phones run, so there is no second
-- implementation free to drift. A drifted referee would be worse than a
-- trusting one: it would reject honest finishes. check-sort.mts fails the
-- build if the deployed copy stops matching byte for byte.
--
-- `create or replace` with a new signature would leave the old three-argument
-- version callable, which is the entire thing being fixed, so it is dropped.
drop function if exists public.sort_finish(bigint, text, int);

create or replace function public.sort_finish(
  p_room bigint, p_user uuid, p_tubes text, p_moves int
) returns text language plpgsql security definer set search_path to 'public' as $$
declare v_seat text; v_row public.sort_races;
begin
  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.room_id is null then raise exception 'no race in room %', p_room; end if;

  v_seat := case when v_row.x_player = p_user then 'x'
                 when v_row.o_player = p_user then 'o' end;
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;
  if v_row.winner is not null then return v_row.winner; end if;

  -- Belt as well as braces. The edge function has already proven the board by
  -- replay; these two hold even if it is ever bypassed or rewritten badly.
  if not public.sort_is_solved(p_tubes, v_row.cap) then
    raise exception 'that board is not sorted';
  end if;
  if p_moves < v_row.par then
    raise exception 'a % move solve is below par (%)', p_moves, v_row.par;
  end if;

  update public.sort_races
     set x_tubes   = case when v_seat = 'x' then p_tubes else x_tubes end,
         x_moves   = case when v_seat = 'x' then p_moves else x_moves end,
         x_done_at = case when v_seat = 'x' then now() else x_done_at end,
         o_tubes   = case when v_seat = 'o' then p_tubes else o_tubes end,
         o_moves   = case when v_seat = 'o' then p_moves else o_moves end,
         o_done_at = case when v_seat = 'o' then now() else o_done_at end,
         winner     = coalesce(winner, v_seat),
         updated_at = now()
   where room_id = p_room
   returning winner into v_seat;
  return v_seat;
end $$;

-- Only the edge function's service role may run it. A player's own token
-- cannot, which is the fix. Verified by impersonation: a member calling it
-- directly gets "permission denied for function sort_finish".
revoke all on function public.sort_finish(bigint, uuid, text, int) from public, anon, authenticated;
grant execute on function public.sort_finish(bigint, uuid, text, int) to service_role;

-- c4_games shipped without this once already: the board only moves for whoever
-- tapped it, and the opponent's screen never hears a thing.
do $$ begin
  alter publication supabase_realtime add table public.sort_races;
exception when duplicate_object then null; end $$;
