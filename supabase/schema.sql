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
