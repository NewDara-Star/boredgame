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
  -- the code a friend types to add you; minted lazily by my_friend_code()
  friend_code text unique,
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
-- "live puzzles are public" hides an open daily's questions; it is defined with
-- open_daily_ids() after the daily round, further down (F30).
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
  v_answer text; v_accept text[]; v_choices text[]; v_correct boolean;
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
    select answer, accept, choices into v_answer, v_accept, v_choices
      from public.puzzles where id = v_pid and status = 'live';
    if v_answer is null then continue; end if;

    v_correct := public.judge_answer(v_given, v_answer, v_accept, v_choices);

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

-- Best round lived only in the phone's storage, so a new phone showed none.
-- It belongs to the account. Scores are worked out on the phone (speed-based),
-- so this is a personal best only, never ranked, and clamped to what a round
-- can score. (Applied live 2026-09-24 as migration best_round_per_account.)
alter table public.profiles add column if not exists best_round jsonb not null default '{}'::jsonb;

create or replace function public.record_best(p_game text, p_score int)
returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); rec public.profiles;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_game is null or p_game !~ '^[a-z0-9_]{1,24}$' then raise exception 'bad game'; end if;
  p_score := greatest(0, least(coalesce(p_score, 0), 65000));
  update public.profiles p
     set best_round = jsonb_set(p.best_round, array[p_game],
           to_jsonb(greatest(coalesce((p.best_round->>p_game)::int, 0), p_score)))
   where p.id = uid
   returning p.* into rec;
  return rec;
end $$;
revoke all on function public.record_best(text, int) from public, anon;
grant execute on function public.record_best(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Play from before you had an account comes with you (F17, talk item 3).
--
-- Signed out, the phone keeps each answer (question, what was given, time
-- taken, the phone's date) and the days played. When an account is made on
-- that phone, or a member says "yes, those are mine", the phone sends them
-- here once. The server judges every answer itself, exactly as record_round
-- does; nothing the phone says about right or wrong is used.
--
-- Trust: the same as record_round, which a signed-in player can already call
-- with any answer. On top: live questions only, one answer per question per
-- batch, answers from the last 30 days, at most 500. The batch id stops a
-- retried upload being filed twice; it proves nothing about who anyone is.
--
-- The streak: phone dates can't be checked, so the phone adds at most 7 days,
-- ending today or yesterday, and only on an account's first carry. It joins
-- the account's own run if the two meet; otherwise the later run wins.
-- (Applied live 2026-09-24 as migration carry_signed_out_play.)
-- ---------------------------------------------------------------------------
create table if not exists public.carried_batches (
  batch      uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  answers    int  not null default 0,
  days       int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists carried_batches_user_id_idx on public.carried_batches(user_id);
alter table public.carried_batches enable row level security;
-- No policies: carry_over is the only reader and writer.

create or replace function public.carry_over(
  p_batch uuid, p_rows jsonb, p_days date[], p_best jsonb, p_local_date date default null)
returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  utc_today date := (now() at time zone 'utc')::date;
  d date;                                   -- the phone's today, trusted a day either side of UTC
  r jsonb; v_pid bigint; v_given text; v_ms int; v_day date;
  v_answer text; v_accept text[]; v_choices text[];
  filed bigint[] := '{}';
  first_carry boolean;
  re date; rs date; run int := 0;           -- the phone's run: rs..re
  prev date; cur int;                       -- the account's run ends at prev, cur long
  k text; v int;
  rec public.profiles;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_batch is null then raise exception 'batch id missing'; end if;
  if p_rows is not null and jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be a json array'; end if;
  if coalesce(jsonb_array_length(p_rows), 0) > 500 then raise exception 'too many rows'; end if;
  if coalesce(cardinality(p_days), 0) > 400 then raise exception 'too many days'; end if;

  d := coalesce(p_local_date, utc_today);
  if abs(d - utc_today) > 1 then d := utc_today; end if;

  first_carry := not exists (select 1 from public.carried_batches where user_id = uid);
  -- Filed already (a retry after a lost answer): change nothing, say how things stand.
  insert into public.carried_batches(batch, user_id) values (p_batch, uid) on conflict (batch) do nothing;
  if not found then
    select * into rec from public.profiles where id = uid;
    return rec;
  end if;

  -- ---- answers: judged here, one per question, last 30 days ----------------
  for r in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_pid := case when r->>'puzzle_id' ~ '^\d{1,18}$' then (r->>'puzzle_id')::bigint end;
    v_day := case when r->>'day' ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'day')::date end;
    if v_pid is null or v_day is null or v_day > d or v_day < d - 30 or v_pid = any(filed) then continue; end if;
    select answer, accept, choices into v_answer, v_accept, v_choices
      from public.puzzles where id = v_pid and status = 'live';
    if v_answer is null then continue; end if;
    v_given := left(coalesce(r->>'given', ''), 200);
    v_ms := case when r->>'ms' ~ '^\d{1,9}$' then least((r->>'ms')::int, 600000) end;
    insert into public.attempts (user_id, puzzle_id, correct, ms_taken)
      values (uid, v_pid, public.judge_answer(v_given, v_answer, v_accept, v_choices), v_ms);
    filed := filed || v_pid;
  end loop;

  -- ---- the streak: at most 7 days, ending today or yesterday, first carry only
  if first_carry then
    select max(x) into re from unnest(p_days) x where x between d - 1 and d;
    if re is not null then
      run := 1;
      while run < 7 and (re - run) = any(p_days) loop run := run + 1; end loop;
      rs := re - run + 1;
      select p.last_played, p.streak into prev, cur from public.profiles p where p.id = uid;
      if prev is null or coalesce(cur, 0) = 0 or prev < rs - 1 then
        -- nothing to join (or the account's run ended before the phone's began)
        if prev is null or prev < re then
          update public.profiles set streak = run, last_played = re,
                 best_streak = greatest(best_streak, run) where id = uid;
        end if;
      elsif re >= prev - cur then
        -- the runs meet or overlap: one run from the earlier start to the later end
        update public.profiles set
          streak = greatest(prev, re) - least(rs, prev - cur + 1) + 1,
          last_played = greatest(prev, re),
          best_streak = greatest(best_streak, greatest(prev, re) - least(rs, prev - cur + 1) + 1)
         where id = uid;
      end if;
    end if;
  end if;

  -- ---- best rounds: record_best's rule, per game ----------------------------
  if p_best is not null and jsonb_typeof(p_best) = 'object' then
    for k, v in select key, case when value::text ~ '^\d{1,9}$' then value::text::int end
                  from jsonb_each(p_best) limit 20 loop
      if k !~ '^[a-z0-9_]{1,24}$' or v is null or v <= 0 then continue; end if;
      update public.profiles p
         set best_round = jsonb_set(p.best_round, array[k],
               to_jsonb(greatest(coalesce((p.best_round->>k)::int, 0), least(v, 65000))))
       where p.id = uid;
    end loop;
  end if;

  update public.carried_batches set answers = cardinality(filed), days = run where batch = p_batch;
  select * into rec from public.profiles where id = uid;
  return rec;
end $$;
revoke all on function public.carry_over(uuid, jsonb, date[], jsonb, date) from public, anon;
grant execute on function public.carry_over(uuid, jsonb, date[], jsonb, date) to authenticated;

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
-- No read policy: the rounds are private, read only by the daily functions (F30).

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
declare ids bigint[]; v_recent bigint[];
begin
  select puzzle_ids into ids from public.daily_rounds where day = p_day;
  if ids is not null then return ids; end if;

  select coalesce(array_agg(x), '{}') into v_recent
    from public.daily_rounds dr, unnest(dr.puzzle_ids) x
   where dr.day >= p_day - 60;

  select array_agg(id order by random()) into ids
  from (
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='easy' and not in_app
      order by (id = any(v_recent)), random() limit 4)
    union all
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='medium' and not in_app
      order by (id = any(v_recent)), random() limit 4)
    union all
    (select id from public.puzzles
      where game='trivia' and status='live' and difficulty='hard' and not in_app
      order by (id = any(v_recent)), random() limit 2)
  ) picked;

  if ids is null or array_length(ids, 1) = 0 then return null; end if;

  insert into public.daily_rounds(day, puzzle_ids) values (p_day, ids)
  on conflict (day) do nothing;

  -- Whoever lost the race takes the row that landed, not their own draft.
  select puzzle_ids into ids from public.daily_rounds where day = p_day;
  return ids;
end $$;
-- Only daily_next (a security-definer caller) needs daily_round; no client does,
-- and a direct call could seed a daily_rounds row for an arbitrary future day.
revoke all on function public.daily_round(date) from public, anon, authenticated;

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
declare uid uuid := auth.uid(); seats int; taken int; v_name text;
begin
  if uid is null then raise exception 'sign in first'; end if;

  -- Your name is your profile's. It used to be whatever the phone sent, and a
  -- phone whose profile hadn't loaded yet (an invite link opens and joins at
  -- once) sent 'player', which then labelled that seat all match. The phone's
  -- name is only the fallback, clamped, for an account with no profile row.
  select nullif(btrim(p.username), '') into v_name from public.profiles p where p.id = uid;
  if v_name is null then v_name := nullif(btrim(coalesce(p_username, '')), ''); end if;
  if v_name is null then v_name := 'player'; end if;
  if length(v_name) > 24 then v_name := left(v_name, 24); end if;

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
  values (p_room, uid, v_name, false);
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

-- Every "just play" creates a permanent row: sweep_stale_guests (F11, at the
-- end of this file) deletes guests 30 days after they last played, nightly.

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

-- When each seat's tubes appeared (talk item 13's Start and count), so the
-- server can time the race itself (talk item 14). A stamp from an earlier
-- deal (before started_at) doesn't count for this one.
alter table public.sort_races add column if not exists x_revealed_at timestamptz;
alter table public.sort_races add column if not exists o_revealed_at timestamptz;

create or replace function public.sort_reveal(p_room bigint)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare v_row public.sort_races; v_seat text; v_at timestamptz;
begin
  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.room_id is null then raise exception 'no race in room %', p_room; end if;
  v_seat := case when v_row.x_player = auth.uid() then 'x'
                 when v_row.o_player = auth.uid() then 'o' end;
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;
  v_at := case when v_seat = 'x' then v_row.x_revealed_at else v_row.o_revealed_at end;
  -- The first reveal of this deal stands: revealing again can't restart your clock.
  if v_at is not null and v_at >= v_row.started_at then return v_at; end if;
  update public.sort_races
     set x_revealed_at = case when v_seat = 'x' then now() else x_revealed_at end,
         o_revealed_at = case when v_seat = 'o' then now() else o_revealed_at end
   where room_id = p_room;
  return now();
end $$;
revoke all on function public.sort_reveal(bigint) from public, anon;
grant execute on function public.sort_reveal(bigint) to authenticated;

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
  v_seat text; v_row public.sort_races; v_ms int; v_revealed timestamptz;
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

  -- The server's time (talk item 14, Daramola): from this seat's reveal
  -- (sort_reveal, stamped when Start's count ends) to this finish arriving. The
  -- phone's own number was trusted when lower, so a script could post ~4 s.
  -- The network delay on the reveal and on the finish roughly cancel; the
  -- finish also carries the referee's replay, the same for both players.
  -- No stamp this deal (an app from before the reveal, or a script that skips
  -- it): timed from the deal itself, which is never shorter. The phone's p_ms
  -- is not used for time at all. Floored at 150ms/move either way, so a replay
  -- bot cannot post an instant solve.
  v_revealed := case when v_seat = 'x' then v_row.x_revealed_at else v_row.o_revealed_at end;
  if v_revealed is not null and v_revealed >= v_row.started_at then
    v_ms := greatest(1, (extract(epoch from (now() - v_revealed)) * 1000)::int);
  else
    v_ms := greatest(1, (extract(epoch from (now() - v_row.started_at)) * 1000)::int);
  end if;
  if v_ms is not null and v_ms < p_moves * 150 then raise exception 'too fast to have been played'; end if;

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

-- A dead phone in a Ball Sort race (talk item 10): the finisher waited for
-- ever on "waiting for Dara", and End match left nobody the winner. Once the
-- other player's phone has been silent for 45 seconds (the room heartbeat is
-- every 20, so two beats missed), a player who has finished can take the win,
-- as if the other had conceded.
create or replace function public.sort_walkover(p_room bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_row public.sort_races; v_seat text; v_them uuid; v_seen timestamptz; v_flipped int := 0;
begin
  select * into v_row from public.sort_races where room_id = p_room for update;
  if v_row.room_id is null then raise exception 'no race in room %', p_room; end if;
  v_seat := case when v_row.x_player = auth.uid() then 'x'
                 when v_row.o_player = auth.uid() then 'o' end;
  if v_seat is null then raise exception 'not seated in race %', p_room; end if;
  if v_row.winner is not null then return jsonb_build_object('winner', v_row.winner); end if;
  if (case when v_seat = 'x' then v_row.x_ms else v_row.o_ms end) is null then
    return jsonb_build_object('winner', null, 'reason', 'finish first');
  end if;
  v_them := case when v_seat = 'x' then v_row.o_player else v_row.x_player end;
  select last_seen into v_seen from public.room_players where room_id = p_room and user_id = v_them;
  if v_seen is not null and v_seen > now() - interval '45 seconds' then
    return jsonb_build_object('winner', null, 'reason', 'still here');
  end if;
  update public.sort_races
     set x_gave_up = case when v_seat = 'o' then true else x_gave_up end,
         o_gave_up = case when v_seat = 'x' then true else o_gave_up end,
         winner = v_seat, updated_at = now()
   where room_id = p_room and winner is null;
  get diagnostics v_flipped = row_count;
  if v_flipped > 0 then
    update public.room_players set score = score + 1 where room_id = p_room and user_id = auth.uid();
  end if;
  return jsonb_build_object('winner', v_seat);
end $$;
revoke all on function public.sort_walkover(bigint) from public, anon;
grant execute on function public.sort_walkover(bigint) to authenticated;

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
  -- Reuse an unfinished attempt for today rather than piling up an orphan row.
  -- It keeps its clock (talk item 14): the tubes appeared when it started, and
  -- reloading used to reset it, so a look and a reload was a free study.
  -- Finished attempts are kept; the first finish is the one on the board.
  select id into v_id from public.sort_solo
   where user_id = auth.uid() and day = p_day and level = p_level and finished_at is null
   order by started_at desc limit 1;
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
  -- The server's time (talk item 14, Daramola): from the tubes appearing
  -- (sort_solo_start) to this finish arriving. It includes the referee's
  -- replay, a fraction of a second and the same for everyone. The phone's own
  -- number (p_ms) used to win when lower, so a script could post ~4 s.
  v_wall := greatest(1, (extract(epoch from (now() - v.started_at)) * 1000)::int);
  v_ms := v_wall;
  if v_ms < p_moves * 150 then raise exception 'too fast to have been played'; end if;
  update public.sort_solo set finished_at = now(), moves = p_moves, ms = v_ms, log = p_log where id = p_id;
  return v_ms;
end $$;
revoke all on function public.sort_solo_finish(bigint, uuid, int, int, text) from public, anon, authenticated;
grant execute on function public.sort_solo_finish(bigint, uuid, int, int, text) to service_role;

-- Each player's best finished attempt on a day's level. security_invoker so
-- the caller's own read rights on sort_solo and profiles apply.
-- Each player's FIRST finish of the day's board, not their best (talk item 13,
-- Daramola): the board is the same all day, so replays could learn the answer
-- and post a time for a board already solved. Going again is for fun.
-- (The name stays: the app and the edge function read it.)
create or replace view public.sort_daily_best with (security_invoker = true) as
  select distinct on (s.day, s.level, s.user_id)
         s.day, s.level, s.user_id, p.username, s.ms, s.moves, s.finished_at, s.id, s.log
    from public.sort_solo s
    join public.profiles p on p.id = s.user_id
   where s.ms is not null
   order by s.day, s.level, s.user_id, s.finished_at asc, s.id asc;
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
-- Whether the answer is in attempts yet (talk item 7). Rounds already on the
-- board were filed by submit_daily; the one unfinished round from before
-- (7 Sep) stays uncounted, as talk item 2 decided.
alter table public.daily_picks add column if not exists filed boolean not null default false;
update public.daily_picks dp set filed = true
 where not dp.filed and dp.answered_at is not null
   and exists (select 1 from public.daily_scores s where s.day = dp.day and s.user_id = dp.user_id);

-- How many of a day's questions you've answered, for Home's "Finish today's
-- round: 3 of 10". Read-only: daily_next would serve (and start the clock on)
-- the next question.
create or replace function public.daily_progress(p_day date)
returns int language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from public.daily_picks
   where day = p_day and user_id = auth.uid() and answered_at is not null;
$$;
revoke all on function public.daily_progress(date) from public, anon;
grant execute on function public.daily_progress(date) to authenticated;

-- A player's daily so far, worked out one way for everyone who needs it: the
-- running score and streak daily_answer returns after each pick (the phone
-- used to estimate its own +N and start again from 0 after a reload), where
-- daily_next resumes, and what submit_daily files. Picks count in round order.
create or replace function public.daily_tally(p_day date, p_uid uuid)
returns table (score int, correct int, answered int, ms int, streak int, grid boolean[])
language plpgsql stable security definer set search_path to 'public' as $$
declare v_ids bigint[]; rec record; v_speed numeric; v_base int;
        cap_ms constant int := 60000;   -- max a single question can contribute
begin
  score := 0; correct := 0; answered := 0; ms := 0; streak := 0; grid := '{}';
  select dr.puzzle_ids into v_ids from public.daily_rounds dr where dr.day = p_day;
  if v_ids is not null then
    for rec in
      select coalesce(dp.correct, false) as ok,
             greatest(0, least(cap_ms,
               (extract(epoch from (dp.answered_at - dp.served_at)) * 1000)::int)) as think
      from public.daily_picks dp
      where dp.day = p_day and dp.user_id = p_uid and dp.answered_at is not null
      order by array_position(v_ids, dp.puzzle_id)
    loop
      answered := answered + 1;
      ms := ms + rec.think;
      grid := grid || rec.ok;
      if rec.ok then
        correct := correct + 1;
        streak := streak + 1;
        -- mirrors scoreAnswer(): base 500 + up to 500 for speed, +60/streak (cap 5)
        v_speed := greatest(0, 1 - rec.think::numeric / 45000);
        v_base := 500 + round(500 * v_speed)::int + least(streak, 5) * 60;
        score := score + greatest(150, v_base);
      else
        streak := 0;
      end if;
    end loop;
  end if;
  return next;
end $$;
revoke all on function public.daily_tally(date, uuid) from public, anon, authenticated;


-- Serve the next unanswered question (answer-free) and stamp when it was shown.
-- The browser cannot see a question before this hands it over, so served_at is
-- an honest "shown" time no client can fake or bring forward.
create or replace function public.daily_next(p_day date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_ids bigint[]; v_total int; v_answered int;
        v_next bigint; v_q jsonb; i int; t record;
begin
  if uid is null then raise exception 'sign in first'; end if;
  -- The phone asks for its own date. A day either side of UTC is accepted, the
  -- rule touch_streak uses: accepting only UTC and the day before shut the
  -- daily for the first hour after midnight in UTC+1 (Dublin in summer, Lagos
  -- all year) and for half of every day in New Zealand.
  if abs(p_day - (now() at time zone 'utc')::date) > 1 then
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
            - 'created_by' - 'status' - 'category_id' - 'in_app')
         || jsonb_build_object('category', coalesce(c.name, ''))
    into v_q
  from public.puzzles p left join public.categories c on c.id = p.category_id
  where p.id = v_next;
  -- Where you are, so a reload mid-round resumes the score and streak too.
  select * into t from public.daily_tally(p_day, uid);
  return jsonb_build_object('total', v_total, 'answered', v_answered,
                            'done', false, 'question', v_q,
                            'score', t.score, 'streak', t.streak);
end $$;

-- Judge one pick. First answer per puzzle is final; a repeat returns the stored
-- verdict (no re-judge, no probing). The answer + explanation come back only
-- after the pick is committed, for the reveal.
create or replace function public.daily_answer(p_day date, p_puzzle bigint, p_given text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
        v_ids bigint[]; v_answer text; v_accept text[]; v_choices text[]; v_expl text;
        v_correct boolean; v_pick public.daily_picks; t0 record; t1 record; v_new int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  -- The phone asks for its own date. A day either side of UTC is accepted, the
  -- rule touch_streak uses: accepting only UTC and the day before shut the
  -- daily for the first hour after midnight in UTC+1 (Dublin in summer, Lagos
  -- all year) and for half of every day in New Zealand.
  if abs(p_day - (now() at time zone 'utc')::date) > 1 then
    raise exception 'that round is closed';
  end if;
  select puzzle_ids into v_ids from public.daily_rounds where day = p_day;
  if v_ids is null or not (p_puzzle = any(v_ids)) then
    raise exception 'not in today''s round';
  end if;
  select answer, accept, choices, explanation into v_answer, v_accept, v_choices, v_expl
    from public.puzzles where id = p_puzzle;
  select * into v_pick from public.daily_picks
    where day = p_day and user_id = uid and puzzle_id = p_puzzle;
  if v_pick.answered_at is not null then
    select * into t1 from public.daily_tally(p_day, uid);
    return jsonb_build_object('correct', v_pick.correct, 'answer', v_answer,
                              'explanation', v_expl, 'locked', true,
                              'gained', 0, 'score', t1.score, 'streak', t1.streak);
  end if;
  -- Only a question daily_next handed you: answering one it never served used
  -- to stamp it served there and then, so a script could answer in 0 seconds.
  if v_pick.puzzle_id is null then raise exception 'that question hasn''t been served yet'; end if;
  v_correct := public.judge_answer(p_given, v_answer, v_accept, v_choices);
  select * into t0 from public.daily_tally(p_day, uid);
  update public.daily_picks
     set given = p_given, correct = v_correct, answered_at = now(), filed = true
   where day = p_day and user_id = uid and puzzle_id = p_puzzle
     and answered_at is null;                            -- first answer wins
  -- Each answer counts the moment it's judged (talk item 7): totals, rank and
  -- the leaderboard move now, not only when all ten are done. Leaving after
  -- three used to count nothing, ever. The board still takes finished rounds.
  get diagnostics v_new = row_count;
  if v_new = 1 then
    insert into public.attempts (user_id, puzzle_id, correct, ms_taken)
      values (uid, p_puzzle, v_correct,
              greatest(0, least(60000, (extract(epoch from (now() - v_pick.served_at)) * 1000)::int)));
  end if;
  -- The points are the ones submit_daily will file: the phone shows these
  -- instead of its own estimate.
  select * into t1 from public.daily_tally(p_day, uid);
  return jsonb_build_object('correct', v_correct, 'answer', v_answer,
                            'explanation', v_expl, 'locked', false,
                            'gained', t1.score - t0.score, 'score', t1.score, 'streak', t1.streak);
end $$;

-- Finalise: tally the recorded picks and sum the per-question think-times
-- (served -> answered), each capped so an interruption on one question cannot
-- dominate. One score per day per player; a second call is a no-op.
create or replace function public.submit_daily(p_day date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_ids bigint[]; t record;
        cap_ms constant int := 60000;   -- max a single question can contribute
begin
  if uid is null then raise exception 'sign in first'; end if;
  -- The phone asks for its own date. A day either side of UTC is accepted, the
  -- rule touch_streak uses: accepting only UTC and the day before shut the
  -- daily for the first hour after midnight in UTC+1 (Dublin in summer, Lagos
  -- all year) and for half of every day in New Zealand.
  if abs(p_day - (now() at time zone 'utc')::date) > 1 then
    return jsonb_build_object('ok', false);
  end if;
  select puzzle_ids into v_ids from public.daily_rounds where day = p_day;
  if v_ids is null then raise exception 'no round'; end if;
  select * into t from public.daily_tally(p_day, uid);
  insert into public.daily_scores(day, user_id, score, correct, answered, ms)
    values (p_day, uid, t.score, t.correct, t.answered, t.ms)
    on conflict (day, user_id) do nothing;
  -- Each answer is filed into attempts by daily_answer as it's judged (talk
  -- item 7). This only catches an answer that wasn't: one given before that
  -- change, in a round finished after it. `filed` means no answer counts twice,
  -- however often this is called. The verdicts are daily_answer's.
  with f as (
    update public.daily_picks dp set filed = true
     where dp.day = p_day and dp.user_id = uid and dp.answered_at is not null and not dp.filed
    returning dp.puzzle_id, dp.correct, dp.served_at, dp.answered_at)
  insert into public.attempts (user_id, puzzle_id, correct, ms_taken)
  select uid, f.puzzle_id, coalesce(f.correct, false),
         greatest(0, least(cap_ms, (extract(epoch from (f.answered_at - f.served_at)) * 1000)::int))
    from f;
  -- The grid (right/wrong in round order) is the server's, so the text share has
  -- all ten squares even when the round was played on two phones.
  return jsonb_build_object('ok', true, 'correct', t.correct,
                            'answered', t.answered, 'ms', t.ms, 'score', t.score, 'grid', to_jsonb(t.grid));
end $$;

revoke all on function public.daily_next(date)                from public, anon;
revoke all on function public.daily_answer(date, bigint, text) from public, anon;
revoke all on function public.submit_daily(date)              from public, anon;
grant execute on function public.daily_next(date)                to authenticated;
grant execute on function public.daily_answer(date, bigint, text) to authenticated;

-- The daily can't be read ahead or scripted (F30, D2).
--
-- 1. A question that also ships inside the app (src/shared/data/trivia.ts) has
--    its answer in the JavaScript every visitor downloads, so it is never a
--    daily question. seed.mjs sets the flag for anything it adds.
alter table public.puzzles add column if not exists in_app boolean not null default false;
comment on column public.puzzles.in_app is
  'Also bundled in the app, so its answer is public: never dealt as a daily question.';
update public.puzzles set in_app = true
 where game = 'trivia' and prompt = any(array[
    'Most abundant element in Earth''s crust by mass?',
    'What does a catalyst do to a reaction?',
    'Which gas makes up about 78% of dry air?',
    'Speed of light in a vacuum is about…',
    'Double a car''s speed. Its kinetic energy multiplies by…',
    'Which organelle produces most of a cell''s ATP?',
    'In DNA, adenine pairs with…',
    'Antibiotics are ineffective against…',
    'CRISPR-Cas9 is primarily a tool for…',
    'π to two decimal places?',
    '2¹⁰ = ?',
    'Next in the sequence: 1, 1, 2, 3, 5, 8, …',
    'A shirt costs €80 after a 20% discount. What was the original price?',
    'Probability of rolling a sum of 7 with two dice?',
    'Standard deviation measures…',
    'The Nike logo is called the…',
    'The FedEx wordmark hides which shape between the E and the x?',
    'Which colour model is used for print?',
    '"Kerning" adjusts…',
    'Helvetica was designed in which country?',
    'The Bauhaus school was founded in…',
    'Jakob''s Law in UX says…',
    '"Leading" controls…',
    'What does xG measure in football?',
    'Which club has won the most European Cups / Champions Leagues?',
    'Who won the 2022 World Cup?',
    '"Gegenpressing" means…',
    'Nigeria''s national football team is nicknamed the…',
    'In football analytics, PPDA measures…',
    'Which nation has won the most AFCON titles?',
    'Who directed "Inception"?',
    'Standard cinema frame rate?',
    'Which country''s film industry is nicknamed Nollywood?',
    'Which film won Best Picture in 2020, the first not in English?',
    'In Avatar: The Last Airbender, Aang comes from which nation?',
    'A MacGuffin is…',
    'The 180-degree rule in filmmaking says…',
    'At its core, a large language model predicts…',
    'HTTP status 404 means…',
    'Which data structure gives O(1) average-case lookup?',
    '"Overfitting" means a model…',
    'A race condition is…',
    'Binary 1010 in decimal?',
    'Capital of Ireland?',
    'Which currency does Nigeria use?',
    'Longest river in Africa?',
    'Which city replaced Lagos as Nigeria''s capital?',
    'Ogun is the Yoruba orisha of…',
    'Fela Kuti pioneered which genre?',
    'The Book of Kells is housed at…',
    'Yoruba belongs to which language family?'
  ]);

-- 2. (daily_round, above, draws at random and skips in_app and recent questions.)

-- 3. The rounds themselves are private: only the daily functions read them.
drop policy if exists "daily round readable" on public.daily_rounds;
revoke all on public.daily_rounds from anon, authenticated;

-- 4. While a daily is open (its day and the day after), its ten questions are
--    out of the public list, so their answers can't be read from it. They sit
--    out of solo Trivia and rooms for those two days (Daramola, 24 Sep).
--    open_daily_ids() gives ids only, never answers; the list policy needs it.
create or replace function public.open_daily_ids()
returns bigint[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(x), '{}')
    from public.daily_rounds dr, unnest(dr.puzzle_ids) x
   where dr.day >= (now() at time zone 'utc')::date - 1
$$;
revoke all on function public.open_daily_ids() from public;
grant execute on function public.open_daily_ids() to anon, authenticated;

drop policy if exists "live puzzles are public" on puzzles;
create policy "live puzzles are public" on puzzles for select
  using ((status = 'live' and not (id = any ((select public.open_daily_ids())::bigint[]))) or is_admin());

-- 5. (daily_next and daily_answer, above: only a served question is judged.)
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
-- client does (Picto). Multiple choice is exact: see judge_answer below.
create extension if not exists fuzzystrmatch with schema extensions;

-- The one rule for "is this answer right", used by record_round, claim_round and
-- daily_answer. A question with options is judged on the exact option: the
-- player tapped a button, so there is nothing to forgive, and the typo slack
-- would pass 'Definately' for 'Definitely' and '+1' for '-1'. Only a typed
-- answer (Picto) gets the slack, and its numbers must match slack() in
-- src/shared/lib/normalise.ts (scripts/check-answers.mts holds them together).
-- Only the judging functions call it (they run as the owner), so nobody else can.
create or replace function public.judge_answer(p_given text, p_answer text, p_accept text[], p_choices text[])
returns boolean language sql stable set search_path to 'public' as $$
  select case
    when p_given is null or p_answer is null then false
    when cardinality(coalesce(p_choices, '{}'::text[])) > 0 then p_given = p_answer
    else public.normalise_answer(p_given) <> '' and exists (
      select 1 from unnest(array[p_answer] || coalesce(p_accept, '{}'::text[])) w
      cross join lateral (select public.normalise_answer(w) as nw) x
      where x.nw <> '' and (
        public.normalise_answer(p_given) = x.nw
        or extensions.levenshtein(public.normalise_answer(p_given), x.nw) <=
          (case when length(x.nw) < 8 then 0 when length(x.nw) < 14 then 1 else 2 end)))
  end
$$;
revoke all on function public.judge_answer(text, text, text[], text[]) from public, anon, authenticated;

alter table public.ttt_games    add column if not exists scored boolean not null default false;
alter table public.c4_games     add column if not exists scored boolean not null default false;
alter table public.memory_games add column if not exists scored boolean not null default false;

-- Book the board point: read the game's OWN winner and pay that seat, once.
-- `scored` is reset to false when a board is dealt/rematched (client writes it).
-- No seat is passed in, so a caller cannot name who to pay, and a repeat call
-- (both browsers watching, or a stall rescue) adds nothing.
--
-- The table is the one the room is playing now (rooms.mode). It used to take
-- whichever game table had a row, Square Off's first, and 'Play something
-- else' leaves the old row behind: after a Square Off game, a Connect 4 win
-- found the old, already-scored Square Off row and paid nothing (RM2). Either
-- phone may call it, so a win isn't lost when the winner's call drops (RM3).
create or replace function public.claim_board_win(p_room bigint)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_mode text; v_winner text; v_x uuid; v_o uuid; v_scored boolean; v_seat uuid; new_score int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member of room %', p_room; end if;
  select mode into v_mode from public.rooms where id = p_room;
  if v_mode in ('squareoff', 'tictactoe') then
    select winner, x_player, o_player, scored into v_winner, v_x, v_o, v_scored
      from public.ttt_games where room_id = p_room;
  elsif v_mode in ('connect4', 'connect4trivia') then
    select winner, x_player, o_player, scored into v_winner, v_x, v_o, v_scored
      from public.c4_games where room_id = p_room;
  elsif v_mode = 'memory' then
    select winner, x_player, o_player, scored into v_winner, v_x, v_o, v_scored
      from public.memory_games where room_id = p_room;
  else
    return 0;   -- a race or Ball Sort room has no board to pay out
  end if;
  if v_winner is null or v_winner = 'draw' or v_scored then
    return 0;
  end if;
  v_seat := case v_winner when 'x' then v_x when 'o' then v_o end;
  if v_seat is null then return 0; end if;
  -- board_truth lets only this function mark a game paid (talk item 11).
  perform set_config('boredgame.paying', 'on', true);
  if    v_mode in ('squareoff', 'tictactoe')     then update public.ttt_games    set scored = true where room_id = p_room and not scored;
  elsif v_mode in ('connect4', 'connect4trivia') then update public.c4_games     set scored = true where room_id = p_room and not scored;
  else                                                update public.memory_games set scored = true where room_id = p_room and not scored;
  end if;
  -- Both phones may call at once: only the call that flipped `scored` pays.
  if not found then perform set_config('boredgame.paying', 'off', true); return 0; end if;
  perform set_config('boredgame.paying', 'off', true);
  update public.room_players set score = score + 1
   where room_id = p_room and user_id = v_seat returning score into new_score;
  return coalesce(new_score, 0);
end $$;
revoke all on function public.claim_board_win(bigint) from public, anon;
grant execute on function public.claim_board_win(bigint) to authenticated;

-- The time a room's move was written is the server's, not the writing phone's
-- (F38, RM6). Each phone compared a question's start with its own clock, so a
-- phone a few seconds off saw the other player's bar start part-empty, and the
-- take-over rescue and the away notice fired early or late. The server stamps
-- stamped_at on every write; the phones measure how far their clock is from
-- this one (server_now) and correct for it. updated_at stays the phone's: it is
-- also the catapult's shared seed, and rewriting it would redraw the writer's pot
-- when the server's copy arrived.
alter table public.ttt_games    add column if not exists stamped_at timestamptz;
alter table public.c4_games     add column if not exists stamped_at timestamptz;
alter table public.memory_games add column if not exists stamped_at timestamptz;

create or replace function public.stamp_move_time()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.stamped_at := now();
  return new;
end $$;
revoke all on function public.stamp_move_time() from public, anon, authenticated;
drop trigger if exists stamp_ttt_games on public.ttt_games;
create trigger stamp_ttt_games before insert or update on public.ttt_games
  for each row execute function public.stamp_move_time();
drop trigger if exists stamp_c4_games on public.c4_games;
create trigger stamp_c4_games before insert or update on public.c4_games
  for each row execute function public.stamp_move_time();
drop trigger if exists stamp_memory_games on public.memory_games;
create trigger stamp_memory_games before insert or update on public.memory_games
  for each row execute function public.stamp_move_time();

-- Board rooms trusted each phone (talk item 11, RM7). Either player could
-- write who won, or clear "already paid" and collect the same win again. Now
-- the winner is worked out here from the board, whatever the phone sends, and
-- "already paid" is claim_board_win's alone: a phone can only clear it by
-- starting a fresh, empty board. (A phone can still write a board it didn't
-- play: moves aren't run on the server. That is the rule to meet before room
-- wins count anywhere public.)
create or replace function public.board_winner(p_game text, p_board text)
returns text language plpgsql immutable set search_path to 'public' as $$
declare ln int[]; m text; r int; c int; d int[]; k int; rr int; cc int; nx int; no int;
begin
  if p_board is null then return null; end if;
  if p_game = 'ttt' then
    foreach ln slice 1 in array array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]] loop
      m := substr(p_board, ln[1], 1);
      if m in ('x','o') and m = substr(p_board, ln[2], 1) and m = substr(p_board, ln[3], 1) then return m; end if;
    end loop;
  elsif p_game = 'c4' then
    for r in 0..5 loop
      for c in 0..6 loop
        m := substr(p_board, r * 7 + c + 1, 1);
        continue when m not in ('x','o');
        foreach d slice 1 in array array[[0,1],[1,0],[1,1],[1,-1]] loop
          k := 1;
          while k < 4 loop
            rr := r + d[1] * k; cc := c + d[2] * k;
            exit when rr < 0 or rr > 5 or cc < 0 or cc > 6 or substr(p_board, rr * 7 + cc + 1, 1) <> m;
            k := k + 1;
          end loop;
          if k = 4 then return m; end if;
        end loop;
      end loop;
    end loop;
  elsif p_game = 'memory' then
    if position('-' in p_board) > 0 then return null; end if;
    nx := length(p_board) - length(replace(p_board, 'x', ''));
    no := length(p_board) - length(replace(p_board, 'o', ''));
    return case when nx = no then 'draw' when nx > no then 'x' else 'o' end;
  else
    return null;
  end if;
  if position('-' in p_board) = 0 then return 'draw'; end if;
  return null;
end $$;

create or replace function public.board_truth()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.winner := public.board_winner(case tg_table_name when 'ttt_games' then 'ttt'
                                                        when 'c4_games' then 'c4' else 'memory' end, new.board);
  if tg_op = 'INSERT' then
    new.scored := false;
  elsif new.scored is distinct from old.scored
        and coalesce(current_setting('boredgame.paying', true), '') <> 'on'
        and not (new.scored = false and position('x' in new.board) = 0 and position('o' in new.board) = 0) then
    new.scored := old.scored;
  end if;
  return new;
end $$;
revoke all on function public.board_truth() from public, anon, authenticated;
drop trigger if exists board_truth_ttt on public.ttt_games;
create trigger board_truth_ttt before insert or update on public.ttt_games
  for each row execute function public.board_truth();
drop trigger if exists board_truth_c4 on public.c4_games;
create trigger board_truth_c4 before insert or update on public.c4_games
  for each row execute function public.board_truth();
drop trigger if exists board_truth_memory on public.memory_games;
create trigger board_truth_memory before insert or update on public.memory_games
  for each row execute function public.board_truth();

create or replace function public.server_now()
returns timestamptz language sql stable set search_path to 'public' as $$
  select now()
$$;
revoke all on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;


-- Claim the trivia round: judge the submitted answer against the round's puzzle
-- server-side (exact for multiple choice, with the client's spelling slack for
-- typed picto), and only a correct FIRST-in answer sets the winner and the point
-- together. The client never writes the winner.
-- F16b (talk item 1): a question answered in a room counts like one answered
-- solo. claim_round already judges every room answer on the server; it now
-- also files it as an attempt (totals, rank, leaderboard), once per player per
-- round: a multiple-choice pick right or wrong (one pick is all there is), a
-- typed answer when it's right (wrong guesses on the way aren't filed, as a
-- solo round files only the answer you finish on).
-- One pick per question in a multiple-choice race (talk item 10, Daramola):
-- a wrong pick used to show nothing and let you pick again, so tapping all
-- four fast beat knowing. A wrong pick now puts you out of that round; when
-- everyone is out, the round ends with nobody paid. A typed race (Picto)
-- keeps its guesses: typing is the skill.
create table if not exists public.room_round_outs (
  round_id   bigint not null references public.room_rounds(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
create index if not exists room_round_outs_user_id_idx on public.room_round_outs(user_id);
alter table public.room_round_outs enable row level security;
-- No policies: claim_round is the only reader and writer.

create or replace function public.claim_round(p_room bigint, p_given text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_round public.room_rounds;
        v_answer text; v_accept text[]; v_choices text[]; v_correct boolean; v_upd int;
        v_mc boolean; v_outs int; v_players int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member of room %', p_room; end if;
  -- The open round: nobody has won it and it hasn't ended unanswered.
  select * into v_round from public.room_rounds
    where room_id = p_room and winner_id is null and ended_at is null
    order by round_no desc limit 1;
  if v_round.id is null then return jsonb_build_object('won', false, 'reason', 'no open round'); end if;
  select answer, accept, choices into v_answer, v_accept, v_choices from public.puzzles where id = v_round.puzzle_id;
  v_mc := cardinality(coalesce(v_choices, '{}'::text[])) > 0;
  if v_mc and exists (select 1 from public.room_round_outs o
                       where o.round_id = v_round.id and o.user_id = uid) then
    return jsonb_build_object('won', false, 'reason', 'out');
  end if;
  v_correct := public.judge_answer(p_given, v_answer, v_accept, v_choices);
  if (v_correct or v_mc)
     and not exists (select 1 from public.attempts a
                      where a.user_id = uid and a.puzzle_id = v_round.puzzle_id
                        and a.created_at >= v_round.started_at) then
    insert into public.attempts (user_id, puzzle_id, correct, ms_taken)
      values (uid, v_round.puzzle_id, v_correct,
              least(greatest(extract(epoch from now() - v_round.started_at) * 1000, 0), 600000)::int);
  end if;
  if not v_correct then
    if not v_mc then return jsonb_build_object('won', false); end if;
    insert into public.room_round_outs (round_id, user_id) values (v_round.id, uid) on conflict do nothing;
    select count(*) into v_outs from public.room_round_outs where round_id = v_round.id;
    select count(*) into v_players from public.room_players where room_id = p_room;
    if v_outs >= v_players then
      update public.room_rounds set ended_at = now()
       where id = v_round.id and winner_id is null and ended_at is null;
      return jsonb_build_object('won', false, 'reason', 'out', 'ended', true);
    end if;
    return jsonb_build_object('won', false, 'reason', 'out');
  end if;
  update public.room_rounds set winner_id = uid, ended_at = now()
    where id = v_round.id and winner_id is null and ended_at is null;
  get diagnostics v_upd = row_count;
  if v_upd = 0 then return jsonb_build_object('won', false, 'reason', 'taken'); end if;
  update public.room_players set score = score + 1 where room_id = p_room and user_id = uid;
  return jsonb_build_object('won', true);
end $$;
revoke all on function public.claim_round(bigint, text) from public, anon;
grant execute on function public.claim_round(bigint, text) to authenticated;

-- "Show the answer" (talk item 10): a round nobody can get used to have no
-- way on but Leave. Either player can end it 20 seconds in; nobody is paid.
create or replace function public.reveal_round(p_room bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_round public.room_rounds; v_upd int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member of room %', p_room; end if;
  select * into v_round from public.room_rounds
    where room_id = p_room and winner_id is null and ended_at is null
    order by round_no desc limit 1;
  if v_round.id is null then return jsonb_build_object('ended', false, 'reason', 'no open round'); end if;
  if now() - v_round.started_at < interval '20 seconds' then
    return jsonb_build_object('ended', false, 'reason', 'too soon',
      'wait_ms', ceil(extract(epoch from (v_round.started_at + interval '20 seconds' - now())) * 1000)::int);
  end if;
  update public.room_rounds set ended_at = now()
   where id = v_round.id and winner_id is null and ended_at is null;
  get diagnostics v_upd = row_count;
  return jsonb_build_object('ended', v_upd = 1);
end $$;
revoke all on function public.reveal_round(bigint) from public, anon;
grant execute on function public.reveal_round(bigint) to authenticated;

-- ============================================================================
-- Friends: a code you share, the people who've added you, and "come play"
-- invites. Reads are RLS-gated to your own rows; every write goes through a
-- security-definer RPC, so the tables carry read policies only -- an INSERT or
-- UPDATE straight from a client is denied for want of a policy.
-- ============================================================================

-- Two rows per friendship (a->b and b->a), so "my friends" is a plain filter
-- on user_id with no OR across two columns.
create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "see your own friendships" on public.friendships;
create policy "see your own friendships" on public.friendships
  for select using (user_id = auth.uid());

-- A pending "come play" from one friend to another, tied to a room.
create table if not exists public.game_invites (
  id         bigint generated always as identity primary key,
  room_id    bigint not null references public.rooms(id) on delete cascade,
  room_code  text   not null,
  from_user  uuid   not null references public.profiles(id) on delete cascade,
  to_user    uuid   not null references public.profiles(id) on delete cascade,
  status     text   not null default 'pending'
                    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
create index if not exists game_invites_to_idx on public.game_invites (to_user, status);
alter table public.game_invites enable row level security;
drop policy if exists "see invites you sent or got" on public.game_invites;
create policy "see invites you sent or got" on public.game_invites
  for select using (from_user = auth.uid() or to_user = auth.uid());

grant select on public.friendships  to authenticated;
grant select on public.game_invites to authenticated;

-- Your shareable code, minted on first ask and stable after. The alphabet
-- drops the confusable glyphs (0/O, 1/I/L) so a code read off a screen types back.
create or replace function public.my_friend_code()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); v_code text; v_try text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select friend_code into v_code from public.profiles where id = uid;
  if v_code is not null then return v_code; end if;
  loop
    v_try := (select string_agg(
                substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)+1)::int, 1), '')
              from generate_series(1, 8));
    begin
      update public.profiles set friend_code = v_try where id = uid;
      return v_try;
    exception when unique_violation then
      -- astronomically rare; draw again
    end;
  end loop;
end $function$;
grant execute on function public.my_friend_code() to authenticated;

-- Add by code. Writes both directions so the friendship is mutual the instant
-- either side adds the other.
create or replace function public.add_friend(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); v_target uuid; v_name text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select id, username into v_target, v_name from public.profiles
    where friend_code = upper(btrim(coalesce(p_code, '')));
  if v_target is null then return jsonb_build_object('ok', false, 'reason', 'no such code'); end if;
  if v_target = uid then return jsonb_build_object('ok', false, 'reason', 'that is your own code'); end if;
  insert into public.friendships(user_id, friend_id)
    values (uid, v_target), (v_target, uid)
    on conflict do nothing;
  return jsonb_build_object('ok', true, 'name', v_name, 'friend_id', v_target);
end $function$;
grant execute on function public.add_friend(text) to authenticated;

-- Who a code belongs to, before you add them (talk item 16, Daramola): the add
-- screen said "Add this friend?" and you found out who after. The name only;
-- 'self' when it's your own code, null when no one has it (an old link).
create or replace function public.friend_by_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_id uuid; v_name text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select id, username into v_id, v_name from public.profiles
   where friend_code = upper(btrim(coalesce(p_code, '')));
  if v_id is null then return null; end if;
  return jsonb_build_object('name', v_name, 'self', v_id = uid,
    'already', exists (select 1 from public.friendships where user_id = uid and friend_id = v_id));
end $$;
revoke all on function public.friend_by_code(text) from public, anon;
grant execute on function public.friend_by_code(text) to authenticated;

-- Remove a friend (talk item 16). Both sides, since a friendship is mutual, and
-- any invite still waiting between you is declined, so it can't ping you after.
-- They can add you again only with your current code: see new_friend_code().
create or replace function public.remove_friend(p_friend uuid)
returns int language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  delete from public.friendships
   where (user_id = uid and friend_id = p_friend) or (user_id = p_friend and friend_id = uid);
  get diagnostics n = row_count;
  update public.game_invites set status = 'declined'
   where status = 'pending'
     and ((from_user = uid and to_user = p_friend) or (from_user = p_friend and to_user = uid));
  return n / 2;
end $$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- A new code (talk item 16): your old link and code stop working at once.
-- The friends you have stay; only new adds need the new one.
create or replace function public.new_friend_code()
returns text language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  update public.profiles set friend_code = null where id = uid;
  return public.my_friend_code();
end $$;
revoke all on function public.new_friend_code() from public, anon;
grant execute on function public.new_friend_code() to authenticated;

-- Invite a friend into a room you're in. One live invite per room per friend.
create or replace function public.invite_friend(p_room bigint, p_friend uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); v_code text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not public.is_room_member(p_room) then raise exception 'not in that room'; end if;
  if not exists (select 1 from public.friendships where user_id = uid and friend_id = p_friend) then
    raise exception 'not your friend';
  end if;
  select code into v_code from public.rooms where id = p_room;
  if v_code is null then raise exception 'no such room'; end if;
  insert into public.game_invites(room_id, room_code, from_user, to_user)
    select p_room, v_code, uid, p_friend
    where not exists (
      select 1 from public.game_invites
       where room_id = p_room and to_user = p_friend and status = 'pending');
end $function$;
grant execute on function public.invite_friend(bigint, uuid) to authenticated;

-- Accept or decline an invite addressed to you.
create or replace function public.respond_invite(p_invite bigint, p_accept boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  update public.game_invites
     set status = case when p_accept then 'accepted' else 'declined' end
   where id = p_invite and to_user = uid and status = 'pending';
end $function$;
grant execute on function public.respond_invite(bigint, boolean) to authenticated;

-- The invitee can read their game_invites row but NOT the room it points to
-- (rooms RLS returns rooms you're already in). The come-play card needs the
-- room's live status to know the invite is still joinable, so it must be read
-- past that wall. This definer RPC joins the two server-side and returns only
-- YOUR pending invites to rooms that are still open.
create or replace function public.my_invites()
returns table (
  id bigint, room_id bigint, room_code text,
  from_id uuid, from_name text, game text, mode text, status text
)
language sql
security definer
set search_path to 'public'
stable
as $function$
  select gi.id, gi.room_id, gi.room_code,
         gi.from_user, pf.username, r.game, r.mode, r.status
  from public.game_invites gi
  join public.rooms r on r.id = gi.room_id
  left join public.profiles pf on pf.id = gi.from_user
  where gi.to_user = auth.uid()
    and gi.status = 'pending'
    and r.status in ('waiting', 'playing')
  order by gi.created_at desc
$function$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- ============================================================================
-- Nightly tidy-up (pg_cron, switched on in the dashboard 24 Sep)
-- ============================================================================
create extension if not exists pg_cron;

-- close_stale_rooms expires "come play" invites a week old (F39).
alter table public.game_invites drop constraint if exists game_invites_status_check;
alter table public.game_invites add constraint game_invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired'));

-- Rooms nobody has touched for a week close by themselves, and invites a week
-- old expire (F39, RM8, N3). Waiting rooms from early September sat in
-- everyone's "Rooms you're in" for good, and invites to them kept showing
-- (my_invites and the rooms list only show waiting and playing rooms, so an
-- abandoned room drops out of both).
-- "Touched" is the latest of: the room made, a player joining or checking in,
-- a move in any of its games, a race round starting. Run nightly by pg_cron
-- (Daramola switched it on, 24 Sep); 7 days is a default that can change.
create or replace function public.close_stale_rooms(p_days int default 7)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_closed int;
begin
  with act as (
    select r.id,
      greatest(r.created_at,
        (select max(greatest(rp.last_seen, rp.joined_at)) from public.room_players rp where rp.room_id = r.id),
        (select max(coalesce(g.stamped_at, g.updated_at)) from public.ttt_games g where g.room_id = r.id),
        (select max(coalesce(g.stamped_at, g.updated_at)) from public.c4_games g where g.room_id = r.id),
        (select max(coalesce(g.stamped_at, g.updated_at)) from public.memory_games g where g.room_id = r.id),
        (select max(s.updated_at) from public.sort_races s where s.room_id = r.id),
        (select max(rr.started_at) from public.room_rounds rr where rr.room_id = r.id)) as last_active
    from public.rooms r
    where r.status in ('waiting', 'playing')
  )
  update public.rooms r set status = 'abandoned'
    from act
   where act.id = r.id and act.last_active < now() - make_interval(days => p_days);
  get diagnostics v_closed = row_count;
  -- A "come play" invite a week old is stale even if its room is still in use.
  update public.game_invites set status = 'expired'
   where status = 'pending' and created_at < now() - make_interval(days => p_days);
  return v_closed;
end $$;
revoke all on function public.close_stale_rooms(int) from public, anon, authenticated;

-- Nightly at 03:15 UTC. cron.schedule replaces a job of the same name.
select cron.schedule('close-stale-rooms', '15 3 * * *', $$select public.close_stale_rooms(7)$$);

-- ============================================================================
-- Web Push: a browser's push endpoint, plus the server-only VAPID key the edge
-- sender signs with. Writes via definer RPCs; the sender reads subscriptions
-- with the service role. Push is deferred behind an installed PWA on iOS.
-- ============================================================================
create table if not exists public.push_subscriptions (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "see your own push subs" on public.push_subscriptions;
create policy "see your own push subs" on public.push_subscriptions
  for select using (user_id = auth.uid());
grant select on public.push_subscriptions to authenticated;

-- A phone's push address belongs to one person: whoever turned notifications on
-- there last (F42, N1). Saving it used to add a row beside the old owner's, so
-- the phone kept getting the first person's pings too.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> uid;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (uid, p_endpoint, p_p256dh, p_auth)
    on conflict (user_id, endpoint)
      do update set p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $function$;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
end $function$;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- Server-only config (the VAPID private key). RLS on with no policy denies every
-- client; grants revoked too. Only the service role (the edge sender) reads it.
-- Values are inserted out of band and are NOT stored in this file.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- ============================================================================
-- Voice calls. Signalling runs on the private realtime channel 'voice:<room id>'
-- (F44, V2). It used to be public, and room ids count up from 1, so any
-- signed-in stranger could join and answer a call. Only players seated in the
-- room may listen to or send on it; every other topic stays shut to clients.
-- ============================================================================
create or replace function public.voice_topic_ok(p_topic text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_topic is null or p_topic !~ '^voice:[0-9]{1,18}$' then return false; end if;
  return exists (select 1 from public.room_players p
                 where p.room_id = split_part(p_topic, ':', 2)::bigint
                   and p.user_id = auth.uid());
end $$;
revoke execute on function public.voice_topic_ok(text) from public, anon;
grant execute on function public.voice_topic_ok(text) to authenticated;

drop policy if exists "voice: room members listen" on realtime.messages;
create policy "voice: room members listen" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
         and public.voice_topic_ok((select realtime.topic())));

drop policy if exists "voice: room members talk" on realtime.messages;
create policy "voice: room members talk" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence')
              and public.voice_topic_ok((select realtime.topic())));

-- ============================================================================
-- Friend codes are private (F48, DB1). profiles was readable column by column
-- by everyone, signed out included, and add_friend befriends both ways on a
-- code alone, so anyone could befriend (and ping) anyone. Players read every
-- column but friend_code; your own comes from my_friend_code(), and a code
-- someone shares with you still works through add_friend() (both definer).
-- A NEW profiles column is unreadable to the app until it is added here, and
-- to PROFILE_COLUMNS in AuthProvider (check-schema compares them).
-- ============================================================================
revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar, total_answered, total_correct, created_at, streak, best_streak,
              last_played, is_guest, best_round) on public.profiles to anon, authenticated;

-- ============================================================================
-- Tidy-up for growth (F49: DB2, DB3, DB4). Migration tidy_up_for_growth.
-- ============================================================================
-- 1. Signed-out callers only reach what a signed-out screen uses: find_room,
--    room_peek, username_available, log_near_miss, and the policy helpers a
--    signed-out read of puzzles or rooms evaluates (is_admin, open_daily_ids,
--    is_room_member; each answers false or public ids without a sign-in).
--    Push and Ball Sort's clock need a sign-in; the two trigger functions
--    are never called directly by anyone.
revoke execute on function public.delete_push_subscription(text) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.sort_solo_start(date, text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.sort_solo_start(date, text) to authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sync_guest_flag() from public, anon, authenticated;

-- 2. Dead weight. The steal left Square Off long ago and nothing reads or
--    writes the column; attempts are filed only by record_round (definer) and
--    players lost the insert grant, so the insert rule guards nothing.
alter table public.ttt_games drop column if exists steal;
drop policy if exists "own attempts insert" on public.attempts;

-- 3. Every foreign key gets an index, so deleting a player or a puzzle, and
--    looking rows up by player, doesn't scan whole tables as they grow.
create index if not exists puzzles_category_id_idx     on public.puzzles(category_id);
create index if not exists puzzles_created_by_idx      on public.puzzles(created_by);
create index if not exists attempts_puzzle_id_idx      on public.attempts(puzzle_id);
create index if not exists rooms_host_id_idx           on public.rooms(host_id);
create index if not exists room_players_user_id_idx    on public.room_players(user_id);
create index if not exists room_rounds_puzzle_id_idx   on public.room_rounds(puzzle_id);
create index if not exists room_rounds_winner_id_idx   on public.room_rounds(winner_id);
create index if not exists daily_picks_user_id_idx     on public.daily_picks(user_id);
create index if not exists daily_picks_puzzle_id_idx   on public.daily_picks(puzzle_id);
create index if not exists ttt_games_puzzle_id_idx     on public.ttt_games(puzzle_id);
create index if not exists ttt_games_x_player_idx      on public.ttt_games(x_player);
create index if not exists ttt_games_o_player_idx      on public.ttt_games(o_player);
create index if not exists daily_scores_user_id_idx    on public.daily_scores(user_id);
create index if not exists c4_games_puzzle_id_idx      on public.c4_games(puzzle_id);
create index if not exists c4_games_x_player_idx       on public.c4_games(x_player);
create index if not exists c4_games_o_player_idx       on public.c4_games(o_player);
create index if not exists friendships_friend_id_idx   on public.friendships(friend_id);
create index if not exists memory_games_puzzle_id_idx  on public.memory_games(puzzle_id);
create index if not exists memory_games_x_player_idx   on public.memory_games(x_player);
create index if not exists memory_games_o_player_idx   on public.memory_games(o_player);
create index if not exists sort_races_x_player_idx     on public.sort_races(x_player);
create index if not exists sort_races_o_player_idx     on public.sort_races(o_player);
create index if not exists sort_solo_user_id_idx       on public.sort_solo(user_id);
create index if not exists game_invites_room_id_idx    on public.game_invites(room_id);
create index if not exists game_invites_from_user_idx  on public.game_invites(from_user);

-- 4. auth.uid() once per query, not once per row: (select auth.uid()).
alter policy "own profile insert" on public.profiles with check ((select auth.uid()) = id);
alter policy "own profile update" on public.profiles using ((select auth.uid()) = id);
alter policy "own attempts readable" on public.attempts using ((select auth.uid()) = user_id);
alter policy "create own room" on public.rooms with check (host_id = (select auth.uid()));
alter policy "host updates room" on public.rooms using (host_id = (select auth.uid()));
alter policy "rooms readable by the people in them" on public.rooms
  using (host_id = (select auth.uid()) or public.is_room_member(id));
alter policy "update own score" on public.room_players using (user_id = (select auth.uid()));
alter policy "players readable by the people in the room" on public.room_players
  using (user_id = (select auth.uid()) or public.is_room_member(room_id));
alter policy "see your own friendships" on public.friendships using (user_id = (select auth.uid()));
alter policy "see invites you sent or got" on public.game_invites
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
alter policy "see your own push subs" on public.push_subscriptions using (user_id = (select auth.uid()));

-- ============================================================================
-- Guests are kept 30 days after they last played, then deleted, nightly (F11).
-- Migration guests_kept_thirty_days_nightly. The earlier sweep only took guests
-- who had never answered anything and never sat in a room, counted from
-- sign-up; it was never scheduled, and a round a guest had won stopped it.
-- ============================================================================
-- A round a guest won must not stop the guest being deleted: the win stays,
-- the winner becomes nobody.
alter table public.room_rounds drop constraint room_rounds_winner_id_fkey;
alter table public.room_rounds add constraint room_rounds_winner_id_fkey
  foreign key (winner_id) references auth.users(id) on delete set null;

-- "Last played" is the latest sign of them: signing in, a solo or daily answer,
-- a streak day, a room.
create or replace function public.sweep_stale_guests(p_days integer default 30)
returns integer language plpgsql security definer set search_path to 'public', 'auth' as $$
declare n int;
begin
  with seen as (
    select u.id, greatest(
      u.created_at,
      u.last_sign_in_at,
      (select (p.last_played + 1)::timestamptz from public.profiles p where p.id = u.id),
      (select max(a.created_at) from public.attempts a where a.user_id = u.id),
      (select max(d.served_at) from public.daily_picks d where d.user_id = u.id),
      (select max(r.last_seen) from public.room_players r where r.user_id = u.id)
    ) as last
    from auth.users u
    where coalesce(u.is_anonymous, false)
  )
  delete from auth.users u using seen s
   where u.id = s.id and s.last < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.sweep_stale_guests(integer) from public, anon, authenticated;

-- Nightly at 03:30 UTC, after the rooms are tidied. Replaces a job of the same name.
select cron.schedule('sweep-stale-guests', '30 3 * * *', 'select public.sweep_stale_guests(30)');
