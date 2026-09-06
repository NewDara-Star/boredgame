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

-- ============ RLS is on by default ============
-- A table created without `enable row level security` is readable by anyone
-- with the anon key. Every table in this file turns it on explicitly, so this
-- is belt as well as braces — it catches the table someone adds later and
-- forgets. Wrapped because creating an event trigger needs privileges a
-- restored or local database may not hand out; the explicit lines below still
-- protect every table here if this one is skipped.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer
set search_path to 'pg_catalog' as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    execute $e$create event trigger ensure_rls on ddl_command_end
              when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
              execute function public.rls_auto_enable()$e$;
  end if;
exception when insufficient_privilege then
  raise notice 'ensure_rls skipped: needs more privilege. Every table here enables RLS explicitly.';
end $$;

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

-- A name of your own.
--
-- handle_new_user gives every account a placeholder off its email, which is
-- fine until two people meet in a room. These two are how a player changes it:
-- one to ask, one to set. Both are definer because `revoke update on profiles`
-- below leaves the client only (username, avatar) — and the uniqueness check
-- has to see rows the caller cannot.
create or replace function public.username_available(p_name text)
returns boolean language sql security definer set search_path to 'public' as $$
  select p_name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_name));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Returns 'ok' | 'taken' | 'invalid' rather than raising: all three are things
-- the signup form has to say out loud, and only one of them is an error.
-- `exception when unique_violation` catches the race between the check and the
-- write, when two people claim the same name in the same second.
create or replace function public.set_username(p_name text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  p_name := btrim(p_name);
  if p_name !~ '^[A-Za-z0-9_]{3,20}$' then return 'invalid'; end if;
  if exists (select 1 from public.profiles
             where lower(username) = lower(p_name) and id <> uid) then
    return 'taken';
  end if;
  update public.profiles set username = p_name where id = uid;
  return 'ok';
exception when unique_violation then return 'taken';
end $$;
revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

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
-- Attempts are written ONLY by record_round below, which judges the answer
-- server-side. The client used to insert its own rows carrying its own
-- `correct`, so the counter trigger could be fed correct=true for questions
-- that were never answered -- lifetime stats, and the leaderboard, inflated
-- with a single call. Direct writes are revoked; the insert policy goes with
-- them (the excess update/delete/truncate grants too).
revoke insert, update, delete, truncate on attempts from anon, authenticated;

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

-- The only path a round takes to the counters. Judges each answer against the
-- puzzle (the same rule claim_round uses), writes the attempt with the SERVER's
-- verdict, and lets the trigger above bump the totals. security definer, so it
-- inserts despite the revoke above; a player's own token cannot.
create or replace function public.record_round(p_rows jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  r jsonb; v_pid bigint; v_given text; v_ms int;
  v_answer text; v_accept text[]; g text; v_correct boolean;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a json array';
  end if;
  if jsonb_array_length(p_rows) > 50 then raise exception 'too many rows'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_pid := nullif(r->>'puzzle_id','')::bigint;
    if v_pid is null then continue; end if;
    v_given := coalesce(r->>'given','');
    v_ms := nullif(r->>'ms','')::int;

    -- Only live puzzles; the answer is read here, never sent by the client. An
    -- unknown id is skipped, not failed, so one bad row can't sink the round.
    select answer, accept into v_answer, v_accept
      from public.puzzles where id = v_pid and status = 'live';
    if v_answer is null then continue; end if;

    g := public.normalise_answer(v_given);
    v_correct := g <> '' and exists (
      select 1 from unnest(array[v_answer] || coalesce(v_accept, '{}'::text[])) w
      cross join lateral (select public.normalise_answer(w) as nw) x
      where x.nw <> '' and (
        g = x.nw or extensions.levenshtein(g, x.nw) <=
          (case when length(x.nw) < 8 then 0 when length(x.nw) < 14 then 1 else 2 end)
      )
    );

    insert into public.attempts (user_id, puzzle_id, correct, ms_taken)
      values (uid, v_pid, v_correct, v_ms);
  end loop;
end $$;
revoke all on function public.record_round(jsonb) from public, anon;
grant execute on function public.record_round(jsonb) to authenticated;

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
drop policy if exists "members deal rounds" on room_rounds;
-- Members may DEAL a round (insert); the winner is set only by claim_round().
create policy "members deal rounds" on room_rounds for insert
  with check (exists (select 1 from room_players p where p.room_id = room_rounds.room_id and p.user_id = auth.uid()));

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
-- Username and avatar are changed ONLY through set_username (which validates
-- format + uniqueness); no direct column grant, or a client bypasses that RPC.
-- (Applied live 2026-09-06.) A future avatar editor must go through a validating RPC.

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

-- ---------------------------------------------------------------------------
-- The daily round: ten questions, the same ten for everyone.
--
-- The round is STORED, not recomputed. Two people opening the app at the same
-- second would each draw their own ten from a bank that changes as questions
-- are retired, and then compare scores on different papers. So the first
-- caller of the day writes the row and everyone else reads it — including the
-- one who lost the insert race, which is why the id list is read back out of
-- the table rather than returned from the draft.
--
-- The spread is fixed at 4 easy, 4 medium, 2 hard so the shape of a day is the
-- same every day, and the order within it is hashed off the date so it is
-- arbitrary but agreed.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_rounds (
  day         date primary key,
  puzzle_ids  bigint[] not null,
  created_at  timestamptz not null default now()
);
alter table public.daily_rounds enable row level security;
drop policy if exists "daily round readable" on public.daily_rounds;
create policy "daily round readable" on public.daily_rounds for select using (true);

-- One score per player per day, first filing wins: `on conflict do nothing`
-- and the boolean says whether yours was the one that landed, so a second
-- submit cannot improve a score by trying again.
create table if not exists public.daily_scores (
  day        date not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  score      int  not null,
  correct    int  not null,
  answered   int  not null,
  ms         int,
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);
alter table public.daily_scores enable row level security;
drop policy if exists "daily scores readable" on public.daily_scores;
create policy "daily scores readable" on public.daily_scores for select using (true);
-- no insert policy: submit_daily is the only writer

create or replace function public.daily_round(p_day date)
returns bigint[] language plpgsql security definer set search_path to 'public' as $$
declare ids bigint[];
begin
  select puzzle_ids into ids from public.daily_rounds where day = p_day;
  if ids is not null then return ids; end if;

  -- A fixed spread so the shape of the day is the same every day, ordered
  -- deterministically off the date so two people creating it agree.
  select array_agg(id order by md5(p_day::text || id::text)) into ids
  from (
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='easy'
      order by md5(p_day::text || id::text) limit 4)
    union all
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='medium'
      order by md5(p_day::text || id::text) limit 4)
    union all
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='hard'
      order by md5(p_day::text || id::text) limit 2)
  ) picked;

  if ids is null or array_length(ids, 1) = 0 then return null; end if;

  insert into public.daily_rounds(day, puzzle_ids) values (p_day, ids)
  on conflict (day) do nothing;

  -- Whoever lost the race takes the row that landed, not their own draft.
  select puzzle_ids into ids from public.daily_rounds where day = p_day;
  return ids;
end $$;
revoke all on function public.daily_round(date) from public, anon;
grant execute on function public.daily_round(date) to authenticated;

-- submit_daily(date,int,int,int,int) was removed 2026-09-06: it trusted a
-- client-supplied score and was the last forgeable path into daily_scores. The
-- daily is filed by submit_daily(date) in the server-authoritative daily round
-- section at the end of this file, which tallies server-recorded picks.

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

-- bump_room_score(bigint,uuid) removed 2026-09-06: it credited a caller-named
-- user with no proof of a win and could be looped. Board points are booked by
-- claim_board_win() and trivia rounds by claim_round(), both server-verified and
-- idempotent, defined at the end of this file.

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

-- Leaving frees the seat. "Leave this room" used to only navigate away, so the
-- room_players row stayed and join_room still counted the seat taken -- the room
-- read as full forever, and a friend could never take the spot someone left.
-- This removes the caller's row, hands on the host if it was them, resets a room
-- that was mid-match back to its lobby, and abandons a room left empty (so its
-- now-stale host_id can't strand the next person to join).
create or replace function public.leave_room(p_room bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_host uuid; v_remaining int; v_new_host uuid;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select host_id into v_host from public.rooms where id = p_room for update;
  if v_host is null then return; end if;

  delete from public.room_players where room_id = p_room and user_id = uid;
  select count(*) into v_remaining from public.room_players where room_id = p_room;

  if v_remaining = 0 then
    update public.rooms set status = 'abandoned' where id = p_room;
    return;
  end if;

  if v_host = uid then
    select user_id into v_new_host from public.room_players
      where room_id = p_room order by joined_at, user_id limit 1;
    update public.rooms set host_id = v_new_host where id = p_room;
  end if;

  update public.rooms set status = 'waiting' where id = p_room and status <> 'waiting';
  update public.room_players set ready = false, score = 0 where room_id = p_room;
end $$;
revoke all on function public.leave_room(bigint) from public, anon;
grant execute on function public.leave_room(bigint) to authenticated;

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
drop policy if exists "members deal rounds" on public.room_rounds;
-- Members may DEAL a round (insert); the winner is set only by claim_round().
create policy "members deal rounds" on public.room_rounds
  for insert with check (public.is_room_member(room_rounds.room_id));

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
  -- each seat's own bounded solve time in ms; the lower one wins the race
  x_ms       int,
  o_ms       int,
  -- conceding hands the other player the race, finished or not
  x_gave_up  boolean not null default false,
  o_gave_up  boolean not null default false,
  -- each seat's replay (see sort_solo.log); either seat can finish now
  x_log      text check (char_length(x_log) <= 6000),
  o_log      text check (char_length(o_log) <= 6000),
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

-- Dealing the tubes.
--
-- Two bugs lived here, and each one made Ball Sort rooms unreachable.
--
-- The first: seats were `min(user_id), max(user_id)`, and Postgres has no
-- min(uuid). Every deal threw, so no Ball Sort room had ever been played.
--
-- The second: the insert was `on conflict (room_id) do nothing`, and nothing
-- deletes a race row — reopen_room clears room_rounds and that is all. So the
-- SECOND match in a room landed on the first match's row, `winner` and all:
-- both phones opened it already over, showing the previous round's result and
-- the previous round's film, permanently. A new room was the only way out.
--
-- The three board games never had that, because startBoard() upserts
-- unconditionally. What makes an unconditional overwrite safe is
-- claim_room_start: only the caller that moves the room waiting -> playing
-- gets true, so exactly one deal per match reaches the write. sort_start
-- already had that guard and then declined to use it.
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

  -- Two ordered reads, not min()/max(): there is no min(uuid).
  select user_id into v_x from public.room_players
   where room_id = p_room order by user_id limit 1;
  select user_id into v_o from public.room_players
   where room_id = p_room order by user_id desc limit 1;

  insert into public.sort_races
    (room_id, seed, level, par, cap, colours, x_tubes, o_tubes, x_player, o_player)
  values (p_room, p_seed, p_level, p_par, p_cap, p_colours, p_tubes, p_tubes, v_x, v_o)
  on conflict (room_id) do update set
    seed = excluded.seed, level = excluded.level, par = excluded.par,
    cap = excluded.cap, colours = excluded.colours,
    x_tubes = excluded.x_tubes, o_tubes = excluded.o_tubes,
    x_player = excluded.x_player, o_player = excluded.o_player,
    x_moves = 0, o_moves = 0,
    x_done_at = null, o_done_at = null,
    x_ms = null, o_ms = null,
    x_gave_up = false, o_gave_up = false,
    -- last match's film is not this match's film
    x_log = null, o_log = null,
    winner = null,
    started_at = now(), updated_at = now();
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
--
-- It used to be a weapon. The only check was that you were seated, so the
-- player who was LOSING could call it mid-race and put both boards back to
-- zero. Proven by impersonation: the seat on 2 moves reset the seat on 18.
--
-- A rematch belongs to a finished race, so the guard is `winner is not null`,
-- and a refusal RAISES rather than matching zero rows — end_match was already
-- silently doing nothing for guests once, and a quiet no-op is how that hid.
create or replace function public.sort_rematch(
  p_room bigint, p_seed bigint, p_par int, p_colours int, p_tubes text
) returns void language plpgsql security definer set search_path to 'public' as $$
declare moved int;
begin
  if public.sort_seat(p_room) is null then
    raise exception 'not seated in race %', p_room;
  end if;
  update public.sort_races
     set seed = p_seed, par = p_par, colours = p_colours,
         x_tubes = p_tubes, o_tubes = p_tubes,
         x_moves = 0, o_moves = 0, x_done_at = null, o_done_at = null,
         x_ms = null, o_ms = null, x_gave_up = false, o_gave_up = false,
         -- a new board's film is not the old board's
         x_log = null, o_log = null,
         winner = null, started_at = now(), updated_at = now()
   where room_id = p_room and winner is not null;
  get diagnostics moved = row_count;
  if moved = 0 then raise exception 'that race is still being played'; end if;
end $$;
revoke all on function public.sort_rematch(bigint, bigint, int, int, text) from public, anon;
grant execute on function public.sort_rematch(bigint, bigint, int, int, text) to authenticated;

-- Finishing a race is not something a client may assert, and it is no longer
-- decided by who reaches the server first.
--
-- The move-replay stays the real check and lives only in the sort-finish edge
-- function, which imports the very src/features/sort/rules.ts both phones run
-- (check-sort.mts fails the build if the deployed copy drifts). What changed is
-- WHO WINS. Both phones start from the same dealt instant and time their own
-- solve locally -- the one clock the finish round-trip cannot warp -- and send
-- that time. A finish is provisional: it records this seat's time and names a
-- winner only once BOTH seats are resolved (finished or conceded). The winner is
-- the lower time, so a clean solve that lands a second late still beats a slower
-- one that arrived first. Server timing (now() - started_at) would have counted
-- each player's ping against a millisecond board; this does not.
--
-- Both older signatures are dropped: the three-arg client-trusted one, and the
-- five-arg winner-on-arrival one this replaces.
drop function if exists public.sort_finish(bigint, text, int);
drop function if exists public.sort_finish(bigint, uuid, text, int, text);

-- Who won, from the two seats' state. Pure, and the ONE place the rule lives so
-- sort_finish and sort_concede cannot disagree.
create or replace function public.sort_resolve(
  p_x_ms int, p_o_ms int, p_x_up boolean, p_o_up boolean
) returns text language sql immutable set search_path to 'public' as $$
  select case
    when p_x_up and p_o_up then null            -- both conceded: no winner
    when p_x_up then 'o'                         -- x conceded -> o wins
    when p_o_up then 'x'                         -- o conceded -> x wins
    when p_x_ms is not null and p_o_ms is not null then
      case when p_x_ms <= p_o_ms then 'x' else 'o' end   -- lower time (tie -> x)
    else null                                   -- still provisional
  end
$$;
revoke all on function public.sort_resolve(int, int, boolean, boolean) from public, anon, authenticated;

create or replace function public.sort_finish(
  p_room bigint, p_user uuid, p_tubes text, p_moves int,
  p_log text default null, p_ms int default null
) returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_seat text; v_row public.sort_races; v_wall int; v_ms int;
  v_x_ms int; v_o_ms int; v_x_up boolean; v_o_up boolean;
  v_win text; v_flipped int := 0;
begin
  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.room_id is null then raise exception 'no race in room %', p_room; end if;

  v_seat := case when v_row.x_player = p_user then 'x'
                 when v_row.o_player = p_user then 'o' end;
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;

  -- Belt as well as braces: the edge already proved the board by replay.
  if not public.sort_is_solved(p_tubes, v_row.cap) then
    raise exception 'that board is not sorted';
  end if;
  if p_moves < v_row.par then
    raise exception 'a % move solve is below par (%)', p_moves, v_row.par;
  end if;

  -- The client's own time, never trusted: capped at the server wall-clock since
  -- the deal, floored at 150ms/move (~3s at par) so a replay bot cannot post an
  -- instant solve. started_at resets on every deal, so it measures this game.
  v_wall := greatest(1, (extract(epoch from (now() - v_row.started_at)) * 1000)::int);
  if p_ms is not null then
    v_ms := least(p_ms, v_wall);
    if v_ms < p_moves * 150 then raise exception 'too fast to have been played'; end if;
  end if;

  -- A legacy caller (no ms, e.g. a stale tab mid-deploy) keeps first-to-arrive.
  if p_ms is null and v_row.winner is not null then return v_row.winner; end if;

  update public.sort_races
     set x_tubes   = case when v_seat = 'x' then p_tubes else x_tubes end,
         x_moves   = case when v_seat = 'x' then p_moves else x_moves end,
         x_done_at = case when v_seat = 'x' then now() else x_done_at end,
         x_log     = case when v_seat = 'x' then p_log else x_log end,
         x_ms      = case when v_seat = 'x' then coalesce(v_ms, x_ms) else x_ms end,
         o_tubes   = case when v_seat = 'o' then p_tubes else o_tubes end,
         o_moves   = case when v_seat = 'o' then p_moves else o_moves end,
         o_done_at = case when v_seat = 'o' then now() else o_done_at end,
         o_log     = case when v_seat = 'o' then p_log else o_log end,
         o_ms      = case when v_seat = 'o' then coalesce(v_ms, o_ms) else o_ms end,
         updated_at = now()
   where room_id = p_room
   returning x_ms, o_ms, x_gave_up, o_gave_up, winner
        into v_x_ms, v_o_ms, v_x_up, v_o_up, v_win;

  if v_win is null then
    v_win := case when p_ms is null then v_seat            -- legacy: arrival wins
                  else public.sort_resolve(v_x_ms, v_o_ms, v_x_up, v_o_up) end;
    if v_win is not null then
      update public.sort_races set winner = v_win, updated_at = now()
       where room_id = p_room and winner is null;
      get diagnostics v_flipped = row_count;
    end if;
  end if;

  -- The point, to the winner, once: only the call that flips winner from null.
  if v_flipped > 0 then
    update public.room_players set score = score + 1
     where room_id = p_room
       and user_id = case when v_win = 'x' then v_row.x_player else v_row.o_player end;
  end if;

  return v_win;   -- null while still provisional; the row carries the truth
end $$;

-- Only the edge function's service role may settle a finish: a player's own
-- token cannot, so the move-replay cannot be skipped.
revoke all on function public.sort_finish(bigint, uuid, text, int, text, int)
  from public, anon, authenticated;
grant execute on function public.sort_finish(bigint, uuid, text, int, text, int) to service_role;

-- Giving up. The other player wins now, finished or not -- conceding has no
-- cheat to gain, so the client calls this directly rather than via the edge.
create or replace function public.sort_concede(p_room bigint)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_seat text; v_row public.sort_races; v_win text; v_flipped int := 0;
  v_x_ms int; v_o_ms int; v_x_up boolean; v_o_up boolean;
begin
  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.room_id is null then raise exception 'no race in room %', p_room; end if;
  v_seat := case when v_row.x_player = auth.uid() then 'x'
                 when v_row.o_player = auth.uid() then 'o' end;
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;
  if v_row.winner is not null then return v_row.winner; end if;

  update public.sort_races
     set x_gave_up = case when v_seat = 'x' then true else x_gave_up end,
         o_gave_up = case when v_seat = 'o' then true else o_gave_up end,
         updated_at = now()
   where room_id = p_room
   returning x_ms, o_ms, x_gave_up, o_gave_up into v_x_ms, v_o_ms, v_x_up, v_o_up;

  v_win := public.sort_resolve(v_x_ms, v_o_ms, v_x_up, v_o_up);
  if v_win is not null then
    update public.sort_races set winner = v_win, updated_at = now()
     where room_id = p_room and winner is null;
    get diagnostics v_flipped = row_count;
    if v_flipped > 0 then
      update public.room_players set score = score + 1
       where room_id = p_room
         and user_id = case when v_win = 'x' then v_row.x_player else v_row.o_player end;
    end if;
  end if;
  return v_win;
end $$;
revoke all on function public.sort_concede(bigint) from public, anon;
grant execute on function public.sort_concede(bigint) to authenticated;

-- c4_games shipped without this once already: the board only moves for whoever
-- tapped it, and the opponent's screen never hears a thing.
do $$ begin
  alter publication supabase_realtime add table public.sort_races;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Ball Sort, solo: today's tubes against the clock.
--
-- One board per level per day, the same for everyone, so a time on it means
-- something next to somebody else's. A row is an ATTEMPT: started when the
-- first ball is lifted, finished by the edge function after it has replayed
-- the moves — and the time is the server's, now() minus started_at, never a
-- number the phone sent. The board is each player's best finished attempt.
-- ---------------------------------------------------------------------------
create table if not exists public.sort_solo (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- the player's own calendar day, as for streaks; checked to within a day
  day         date not null,
  level       text not null check (level in ('easy','medium','hard')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  moves       int check (moves >= 0),
  ms          int check (ms > 0),
  -- the replay: "05@1200,12@1850" — every ball that moved, take-backs
  -- included, and when. Checked by the edge function to be a legal line that
  -- finishes the board before it is stored. What "Watch" on the ladder plays.
  log         text check (char_length(log) <= 6000)
);
create index if not exists sort_solo_board on public.sort_solo (day, level, ms) where ms is not null;
alter table public.sort_solo enable row level security;

drop policy if exists "solo times readable by everyone signed in" on public.sort_solo;
create policy "solo times readable by everyone signed in" on public.sort_solo
  for select to authenticated using (true);
-- no insert or update policy: the two functions below are the only writers

create or replace function public.sort_solo_start(p_day date, p_level text)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_day not between current_date - 1 and current_date + 1 then
    raise exception 'that is not today';
  end if;
  if p_level not in ('easy','medium','hard') then raise exception 'no such level'; end if;
  -- Reuse an unfinished attempt for today rather than piling up an orphan row on
  -- every abandoned first lift; a real retry just resets its clock. Finished
  -- attempts are kept -- your best stands.
  update public.sort_solo set started_at = now()
    where id = (
      select id from public.sort_solo
       where user_id = auth.uid() and day = p_day and level = p_level and finished_at is null
       order by started_at desc limit 1)
    returning id into v_id;
  if v_id is not null then return v_id; end if;
  insert into public.sort_solo (user_id, day, level)
    values (auth.uid(), p_day, p_level) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.sort_solo_start(date, text) to authenticated;

-- Service role only, called by the edge function after the replay. The time
-- is measured here. The floor is a thumb's: two taps a move faster than 150ms
-- each is a script playing the bank's stored line, and it does not get a time.
create or replace function public.sort_solo_finish(p_id bigint, p_user uuid, p_moves int, p_ms int, p_log text default null)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v public.sort_solo; v_wall int; v_ms int;
begin
  select * into v from public.sort_solo where id = p_id for update;
  if v.id is null or v.user_id <> p_user then raise exception 'not your attempt'; end if;
  if v.finished_at is not null then return v.ms; end if;
  -- The server wall-clock from first lift INCLUDES this request's round-trip and
  -- the move-replay, so it is a ceiling, not the time: the solve happened before
  -- this call landed. Ball Sort is a millisecond board, so the honest number is
  -- the client's own solve time -- measuring it here billed everyone for the
  -- verify latency (the bug this fixes). Trust the client, but only within proven
  -- bounds: never below the bot floor, never above the wall-clock. The replay in
  -- the edge function is what proves the solve was real.
  v_wall := greatest(1, (extract(epoch from (now() - v.started_at)) * 1000)::int);
  v_ms := least(coalesce(p_ms, v_wall), v_wall);
  if v_ms < p_moves * 150 then raise exception 'too fast to have been played'; end if;
  update public.sort_solo set finished_at = now(), moves = p_moves, ms = v_ms, log = p_log where id = p_id;
  return v_ms;
end $$;
revoke all on function public.sort_solo_finish(bigint, uuid, int, int, text) from public, anon, authenticated;
grant execute on function public.sort_solo_finish(bigint, uuid, int, int, text) to service_role;

-- Each player's best finished attempt on a day's level. security_invoker so
-- the caller's own read rights on sort_solo and profiles apply.
create or replace view public.sort_daily_best with (security_invoker = true) as
  select distinct on (s.day, s.level, s.user_id)
         s.day, s.level, s.user_id, p.username, s.ms, s.moves, s.finished_at, s.id, s.log
    from public.sort_solo s
    join public.profiles p on p.id = s.user_id
   where s.ms is not null
   order by s.day, s.level, s.user_id, s.ms asc, s.moves asc;
grant select on public.sort_daily_best to authenticated;

-- ---------------------------------------------------------------------------
-- The room modes live in ONE place.
--
-- rooms_mode_check and set_room_setup each kept a list of them. When ballsort
-- was added the constraint got it and the function did not, so choosing Ball
-- Sort in a room failed with "unknown mode ballsort" — for a mode the table
-- itself accepted. Nobody saw it until someone tried, because no Ball Sort
-- room had ever been set up.
--
-- The constraint is now the only list, and the function turns its violation
-- back into the message the lobby shows. Adding a mode is one edit.
-- ---------------------------------------------------------------------------
create or replace function public.set_room_setup(
  p_room bigint, p_mode text, p_game text, p_categories text[],
  p_difficulty text[] default null, p_challenge text default 'trivia')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.room_players p
                 where p.room_id = p_room and p.user_id = auth.uid()) then
    raise exception 'not a member of room %', p_room;
  end if;
  if p_difficulty is not null and exists (
       select 1 from unnest(p_difficulty) d where d not in ('easy','medium','hard')) then
    raise exception 'unknown difficulty in %', p_difficulty;
  end if;
  if coalesce(p_challenge, 'trivia') not in ('trivia','catapult') then
    raise exception 'unknown challenge %', p_challenge;
  end if;

  begin
    update public.rooms r set
      mode = p_mode, game = p_game::game_key,
      categories = nullif(p_categories, '{}'),
      difficulty = nullif(p_difficulty, '{}'),
      challenge = coalesce(p_challenge, 'trivia')
    where r.id = p_room and r.status = 'waiting';
  exception when check_violation then
    raise exception 'unknown mode %', p_mode;
  end;

  update public.room_players p set ready = false where p.room_id = p_room;
end $$;
revoke all on function public.set_room_setup(bigint, text, text, text[], text[], text) from public, anon;
grant execute on function public.set_room_setup(bigint, text, text, text[], text[], text) to authenticated;

-- ============================================================================
-- Server-authoritative daily round (2026-09-06, Phase 1 of the competitive fix)
--
-- The daily leaderboard is the one board where "the same ten for everyone" has
-- to mean something. Judging used to happen in the browser and the score was a
-- number the server trusted, so any client could top the board without playing.
-- Now the answer never leaves the server, and the round is served ONE question
-- at a time so time-to-answer is measured here (served -> answered), not sent up
-- by the client. Reading the reveal is untimed. Nothing is faked because nothing
-- the client controls decides correctness, score or time.
-- ============================================================================

-- One row per (day,user,puzzle). served_at is stamped when the server hands the
-- question over; the answer fields are filled when it comes back. First serve
-- wins (a refresh never resets the clock), first answer wins. RLS on, no client
-- access -- only the definer functions below touch it.
create table if not exists public.daily_picks (
  day         date        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  puzzle_id   bigint      not null references public.puzzles(id) on delete cascade,
  served_at   timestamptz not null default now(),
  given       text,
  correct     boolean,
  answered_at timestamptz,
  primary key (day, user_id, puzzle_id)
);
alter table public.daily_picks enable row level security;
revoke all on public.daily_picks from anon, authenticated;

-- Serve the next unanswered question (answer-free) and stamp when it was shown.
-- The browser cannot see a question before this hands it over, so served_at is
-- an honest "shown" time no client can fake or bring forward.
create or replace function public.daily_next(p_day date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_ids bigint[]; v_total int; v_answered int;
        v_next bigint; v_q jsonb; i int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_day <> (now() at time zone 'utc')::date
     and p_day <> ((now() at time zone 'utc')::date - 1) then
    raise exception 'that round is closed';
  end if;
  v_ids := public.daily_round(p_day);
  if v_ids is null then
    return jsonb_build_object('total', 0, 'answered', 0, 'done', true, 'question', null);
  end if;
  v_total := array_length(v_ids, 1);
  select count(*) into v_answered from public.daily_picks
    where day = p_day and user_id = uid and answered_at is not null;
  v_next := null;
  for i in 1 .. v_total loop
    if not exists (select 1 from public.daily_picks
                   where day = p_day and user_id = uid
                     and puzzle_id = v_ids[i] and answered_at is not null) then
      v_next := v_ids[i]; exit;
    end if;
  end loop;
  if v_next is null then
    return jsonb_build_object('total', v_total, 'answered', v_answered, 'done', true, 'question', null);
  end if;
  insert into public.daily_picks(day, user_id, puzzle_id, served_at)
    values (p_day, uid, v_next, now())
    on conflict (day, user_id, puzzle_id) do nothing;   -- first serve wins
  select (to_jsonb(p) - 'answer' - 'answer_normalised' - 'accept' - 'explanation'
            - 'created_by' - 'status' - 'category_id')
         || jsonb_build_object('category', coalesce(c.name, ''))
    into v_q
  from public.puzzles p left join public.categories c on c.id = p.category_id
  where p.id = v_next;
  return jsonb_build_object('total', v_total, 'answered', v_answered,
                            'done', false, 'question', v_q);
end $$;

-- Judge one pick. First answer per puzzle is final; a repeat returns the stored
-- verdict (no re-judge, no probing). The answer + explanation come back only
-- after the pick is committed, for the reveal.
create or replace function public.daily_answer(p_day date, p_puzzle bigint, p_given text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
        v_ids bigint[]; v_answer text; v_ansnorm text; v_expl text;
        v_correct boolean; v_pick public.daily_picks;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_day <> (now() at time zone 'utc')::date
     and p_day <> ((now() at time zone 'utc')::date - 1) then
    raise exception 'that round is closed';
  end if;
  select puzzle_ids into v_ids from public.daily_rounds where day = p_day;
  if v_ids is null or not (p_puzzle = any(v_ids)) then
    raise exception 'not in today''s round';
  end if;
  select answer, answer_normalised, explanation into v_answer, v_ansnorm, v_expl
    from public.puzzles where id = p_puzzle;
  select * into v_pick from public.daily_picks
    where day = p_day and user_id = uid and puzzle_id = p_puzzle;
  if v_pick.answered_at is not null then
    return jsonb_build_object('correct', v_pick.correct, 'answer', v_answer,
                              'explanation', v_expl, 'locked', true);
  end if;
  insert into public.daily_picks(day, user_id, puzzle_id, served_at)
    values (p_day, uid, p_puzzle, now())
    on conflict (day, user_id, puzzle_id) do nothing;
  v_correct := p_given is not null
               and public.normalise_answer(p_given) = v_ansnorm;
  update public.daily_picks
     set given = p_given, correct = v_correct, answered_at = now()
   where day = p_day and user_id = uid and puzzle_id = p_puzzle
     and answered_at is null;                            -- first answer wins
  return jsonb_build_object('correct', v_correct, 'answer', v_answer,
                            'explanation', v_expl, 'locked', false);
end $$;

-- Finalise: tally the recorded picks and sum the per-question think-times
-- (served -> answered), each capped so an interruption on one question cannot
-- dominate. One score per day per player; a second call is a no-op.
create or replace function public.submit_daily(p_day date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_ids bigint[];
        v_correct int := 0; v_answered int := 0; v_ms int := 0;
        v_score int := 0; v_streak int := 0; v_speed numeric; v_base int;
        rec record;
        cap_ms constant int := 60000;   -- max a single question can contribute
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_day <> (now() at time zone 'utc')::date
     and p_day <> ((now() at time zone 'utc')::date - 1) then
    return jsonb_build_object('ok', false);
  end if;
  select puzzle_ids into v_ids from public.daily_rounds where day = p_day;
  if v_ids is null then raise exception 'no round'; end if;
  for rec in
    select dp.correct,
           greatest(0, least(cap_ms,
             (extract(epoch from (dp.answered_at - dp.served_at)) * 1000)::int)) as think
    from public.daily_picks dp
    where dp.day = p_day and dp.user_id = uid and dp.answered_at is not null
    order by array_position(v_ids, dp.puzzle_id)
  loop
    v_answered := v_answered + 1;
    v_ms := v_ms + rec.think;
    if rec.correct then
      v_correct := v_correct + 1;
      v_streak := v_streak + 1;
      -- mirrors scoreAnswer(): base 500 + up to 500 for speed, +60/streak (cap 5)
      v_speed := greatest(0, 1 - rec.think::numeric / 45000);
      v_base := 500 + round(500 * v_speed)::int + least(v_streak, 5) * 60;
      v_score := v_score + greatest(150, v_base);
    else
      v_streak := 0;
    end if;
  end loop;
  insert into public.daily_scores(day, user_id, score, correct, answered, ms)
    values (p_day, uid, v_score, v_correct, v_answered, v_ms)
    on conflict (day, user_id) do nothing;
  return jsonb_build_object('ok', true, 'correct', v_correct,
                            'answered', v_answered, 'ms', v_ms, 'score', v_score);
end $$;

revoke all on function public.daily_next(date)                from public, anon;
revoke all on function public.daily_answer(date, bigint, text) from public, anon;
revoke all on function public.submit_daily(date)              from public, anon;
grant execute on function public.daily_next(date)                to authenticated;
grant execute on function public.daily_answer(date, bigint, text) to authenticated;
grant execute on function public.submit_daily(date)              to authenticated;

-- The old client-trusted submit_daily(date,int,int,int,int) was dropped
-- 2026-09-06 once this client went live -- it was the last forgeable path in.

-- ============================================================================
-- Room win-crediting, server-verified (2026-09-06, first step of room integrity)
--
-- Two one-command console forgeries used to be possible:
--   * trivia rooms: update room_rounds set winner_id = me   (no answer needed)
--   * any room:     bump_room_score(room, me) in a loop, crediting a named user
-- Both are gone. A trivia round's winner is set only by claim_round() judging
-- the answer; a board point is booked only by claim_board_win() reading the
-- game's OWN winner, once. Ceiling for a later pass: trivia answers are still
-- served to the client and board MOVES are still client-written, so a scripted
-- client could still cheat WHILE playing -- this closes the forgeries, not
-- move-level cheating.
-- ============================================================================

-- levenshtein(), so the server judges a typed answer with the same slack the
-- client does (picto rooms). Trivia rooms are exact multiple choice.
create extension if not exists fuzzystrmatch with schema extensions;

alter table public.ttt_games    add column if not exists scored boolean not null default false;
alter table public.c4_games     add column if not exists scored boolean not null default false;
alter table public.memory_games add column if not exists scored boolean not null default false;

-- Book the board point: read the game's OWN winner and pay that seat, once.
-- `scored` is reset to false when a board is dealt/rematched (client writes it).
-- No seat is passed in, so a caller cannot name who to pay, and a repeat call
-- (both browsers watching, or a stall rescue) adds nothing.
create or replace function public.claim_board_win(p_room bigint)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_tbl text; v_winner text; v_x uuid; v_o uuid; v_scored boolean; v_seat uuid; new_score int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member of room %', p_room; end if;
  select 'ttt', winner, x_player, o_player, scored into v_tbl, v_winner, v_x, v_o, v_scored
    from public.ttt_games where room_id = p_room;
  if v_tbl is null then
    select 'c4', winner, x_player, o_player, scored into v_tbl, v_winner, v_x, v_o, v_scored
      from public.c4_games where room_id = p_room;
  end if;
  if v_tbl is null then
    select 'memory', winner, x_player, o_player, scored into v_tbl, v_winner, v_x, v_o, v_scored
      from public.memory_games where room_id = p_room;
  end if;
  if v_tbl is null or v_winner is null or v_winner = 'draw' or v_scored then
    return 0;
  end if;
  v_seat := case v_winner when 'x' then v_x when 'o' then v_o end;
  if v_seat is null then return 0; end if;
  if    v_tbl = 'ttt' then update public.ttt_games    set scored = true where room_id = p_room;
  elsif v_tbl = 'c4'  then update public.c4_games     set scored = true where room_id = p_room;
  else                     update public.memory_games set scored = true where room_id = p_room;
  end if;
  update public.room_players set score = score + 1
   where room_id = p_room and user_id = v_seat returning score into new_score;
  return coalesce(new_score, 0);
end $$;
revoke all on function public.claim_board_win(bigint) from public, anon;
grant execute on function public.claim_board_win(bigint) to authenticated;

-- Claim the trivia round: judge the submitted answer against the round's puzzle
-- server-side (exact for multiple choice, with the client's spelling slack for
-- typed picto), and only a correct FIRST-in answer sets the winner and the point
-- together. The client never writes the winner.
create or replace function public.claim_round(p_room bigint, p_given text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_round public.room_rounds;
        v_answer text; v_accept text[]; g text; v_correct boolean; v_upd int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member of room %', p_room; end if;
  select * into v_round from public.room_rounds
    where room_id = p_room and winner_id is null
    order by round_no desc limit 1;
  if v_round.id is null then return jsonb_build_object('won', false, 'reason', 'no open round'); end if;
  select answer, accept into v_answer, v_accept from public.puzzles where id = v_round.puzzle_id;
  g := public.normalise_answer(p_given);
  v_correct := g <> '' and exists (
    select 1 from unnest(array[v_answer] || coalesce(v_accept, '{}'::text[])) w
    cross join lateral (select public.normalise_answer(w) as nw) x
    where x.nw <> '' and (
      g = x.nw or extensions.levenshtein(g, x.nw) <=
        (case when length(x.nw) < 8 then 0 when length(x.nw) < 14 then 1 else 2 end)
    )
  );
  if not v_correct then return jsonb_build_object('won', false); end if;
  update public.room_rounds set winner_id = uid, ended_at = now()
    where id = v_round.id and winner_id is null;
  get diagnostics v_upd = row_count;
  if v_upd = 0 then return jsonb_build_object('won', false, 'reason', 'taken'); end if;
  update public.room_players set score = score + 1 where room_id = p_room and user_id = uid;
  return jsonb_build_object('won', true);
end $$;
revoke all on function public.claim_round(bigint, text) from public, anon;
grant execute on function public.claim_round(bigint, text) to authenticated;
