-- ============================================================================
-- Server rules that have broken before (F54, T2). One test per proven bug.
--
-- Run the whole file against the database (SQL Editor, or execute_sql) after
-- changing any function it names: judge_answer, record_round, daily_next,
-- daily_answer, submit_daily, daily_round, claim_board_win,
-- save_push_subscription, voice_topic_ok, carry_over, daily_progress,
-- reveal_round, sort_walkover, claim_board_win, board_winner, sort_reveal,
-- sort_finish, sort_solo_start, sort_solo_finish, or the profiles and puzzles grants.
--
-- It ALWAYS ends in an error, on purpose: the error rolls every write back, so
-- it can run against the live database. Read the message:
--   "RULES HOLD: n of n"             everything is as it should be
--   "RULES BROKEN: k of n" + names   each broken rule, with the bug it guards
-- It borrows real rows (two players who share a room, a player who hasn't
-- played today's daily, a live multiple-choice question) and changes nothing.
-- ============================================================================
do $rules$
declare
  today date := (now() at time zone 'utc')::date;
  a uuid; b uuid; c uuid; r bigint;
  mc bigint; mc_answer text; mc_choices text[]; slip text;
  ids bigint[]; n int; n2 int; j jsonb; err text;
  sa int; sb int; got int; again int;
  results text[] := '{}'; broken text[] := '{}';
  g31 uuid := gen_random_uuid(); g29 uuid := gen_random_uuid(); gwin uuid := gen_random_uuid(); rr bigint;
  mc2 bigint; mc2_answer text; mc2_choices text[];
  cb uuid := gen_random_uuid(); d7 int; rid bigint; sa2 int;
  ts1 timestamptz; ts2 timestamptz; sid bigint; sid2 bigint;
begin
  -- ---- borrowed rows -------------------------------------------------------
  select p1.user_id, p2.user_id, p1.room_id into a, b, r
    from public.room_players p1 join public.room_players p2
      on p2.room_id = p1.room_id and p2.user_id > p1.user_id
   where (select count(*) from public.room_players x where x.room_id = p1.room_id) = 2
   order by p1.room_id desc limit 1;
  select id into c from public.profiles pr
   where id not in (a, b)
     and not exists (select 1 from public.admins ad where ad.user_id = pr.id)
     and not exists (select 1 from public.room_players x where x.room_id = r and x.user_id = pr.id)
     and not exists (select 1 from public.daily_picks d where d.user_id = pr.id and d.day = today)
   limit 1;
  select id, answer, choices into mc, mc_answer, mc_choices from public.puzzles
   where game = 'trivia' and status = 'live' and cardinality(choices) = 4
     and length(public.normalise_answer(answer)) >= 8
   order by id limit 1;
  -- one letter off: inside the typo allowance a TYPED answer gets
  slip := left(mc_answer, -1) || case when right(mc_answer, 1) = 'x' then 'y' else 'x' end;
  if a is null or b is null or c is null or mc is null then
    raise exception 'RULES NOT RUN: couldn''t borrow the rows the tests need';
  end if;

  -- ---- Q12, D3: multiple choice is judged on the exact option --------------
  results := array_append(results, 'Q12 a near miss of the right option is wrong (multiple choice)'::text);
  if public.judge_answer(slip, mc_answer, null, mc_choices) then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'Q12 the right option is right'::text);
  if not public.judge_answer(mc_answer, mc_answer, null, mc_choices) then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'Q12 a typed answer keeps its typo allowance'::text);
  if not public.judge_answer(slip, mc_answer, null, null) then broken := broken || results[cardinality(results)]; end if;

  select count(*) filter (where correct), count(*) filter (where not correct) into n, n2
    from public.attempts where user_id = a and puzzle_id = mc;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.record_round(jsonb_build_array(
    jsonb_build_object('puzzle_id', mc, 'given', slip, 'ms', 4000),
    jsonb_build_object('puzzle_id', mc, 'given', mc_answer, 'ms', 4000)));
  reset role;
  results := array_append(results, 'Q12 record_round files a near-miss option as wrong and the option as right'::text);
  if (select count(*) filter (where correct) from public.attempts where user_id = a and puzzle_id = mc) <> n + 1
  or (select count(*) filter (where not correct) from public.attempts where user_id = a and puzzle_id = mc) <> n2 + 1
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- D1: the daily takes a day either side of UTC, and no further --------
  ids := public.daily_round(today);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  results := array_append(results, 'D1 yesterday''s and tomorrow''s daily open (phones ahead of or behind UTC)'::text);
  begin
    perform public.daily_next(today - 1); perform public.daily_next(today + 1);
  exception when others then broken := broken || results[cardinality(results)]; end;
  results := array_append(results, 'D1 two days out is closed (daily_next, daily_answer, submit_daily)'::text);
  n := 0;
  begin perform public.daily_next(today + 2); exception when others then n := n + 1; end;
  begin perform public.daily_answer(today - 2, ids[1], 'x'); exception when others then n := n + 1; end;
  begin j := public.submit_daily(today + 2);          -- refuses by answering ok: false
    if j->>'ok' = 'false' then n := n + 1; end if;
  exception when others then n := n + 1; end;
  if n <> 3 then broken := broken || results[cardinality(results)]; end if;

  -- ---- D2: only a question the server served can be answered ---------------
  reset role;
  select count(*) into d7 from public.attempts where user_id = c and puzzle_id = ids[1];
  set local role authenticated;
  perform public.daily_next(today);                       -- serves ids[1]
  results := array_append(results, 'D2 answering a question that was never served is refused'::text);
  err := null;
  begin perform public.daily_answer(today, ids[2], 'x'); exception when others then err := sqlerrm; end;
  if err is null or err not like '%served%' then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'D2 the served question can be answered'::text);
  begin
    j := public.daily_answer(today, ids[1], 'x');
    if j ? 'correct' is not true then broken := broken || results[cardinality(results)]; end if;
  exception when others then broken := broken || results[cardinality(results)]; end;
  -- ---- D7 (talk item 7): a daily answer counts at once, finished or not ----
  reset role;
  results := array_append(results, 'D7 a daily answer counts towards your totals at once, before the round is finished'::text);
  if (select count(*) from public.attempts where user_id = c and puzzle_id = ids[1]) <> d7 + 1
  then broken := broken || results[cardinality(results)]; end if;
  set local role authenticated;

  -- ---- F30: today's daily questions can't be read ahead --------------------
  results := array_append(results, 'F30 a player can''t read today''s daily questions from the bank'::text);
  select count(*) into n from public.puzzles where id = any(ids);
  if n <> 0 then broken := broken || results[cardinality(results)]; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  results := array_append(results, 'F30 nor can someone signed out'::text);
  select count(*) into n from public.puzzles where id = any(ids);
  if n <> 0 then broken := broken || results[cardinality(results)]; end if;
  reset role;
  results := array_append(results, 'F30 the daily never uses a question bundled in the app'::text);
  if exists (select 1 from public.puzzles where id = any(ids) and in_app) then broken := broken || results[cardinality(results)]; end if;

  -- ---- RM2: a board win pays from the game the room is playing now ---------
  -- A finished Square Off is left in the room (x won, unpaid) and the room has
  -- moved on to Connect 4, which o has just won.
  update public.rooms set mode = 'connect4' where id = r;
  delete from public.ttt_games where room_id = r;
  delete from public.c4_games where room_id = r;
  -- (Winners come from the boards since RM7, so the boards are real ones.)
  insert into public.ttt_games(room_id, board, phase, winner, x_player, o_player, scored) values (r, 'xxxoo----', 'over', 'x', a, b, false);
  insert into public.c4_games (room_id, board, phase, winner, x_player, o_player, scored)
    values (r, '----------------------------xxx----oooo---', 'over', 'o', a, b, false);
  select score into sa from public.room_players where room_id = r and user_id = a;
  select score into sb from public.room_players where room_id = r and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  got := public.claim_board_win(r);
  again := public.claim_board_win(r);
  reset role;
  results := array_append(results, 'RM2 the Connect 4 winner is paid, not the old Square Off winner'::text);
  if (select score from public.room_players where room_id = r and user_id = b) <> sb + 1
  or (select score from public.room_players where room_id = r and user_id = a) <> sa
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'F36 a win is paid once, however many phones claim it'::text);
  if again <> 0 then broken := broken || results[cardinality(results)]; end if;

  -- ---- RM7 (talk item 11): the board says who won; "paid" is the server's --
  -- x (a) lost this Connect 4. a's phone writes itself the winner, then clears
  -- "paid" on the won board and claims again.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.c4_games set winner = 'x' where room_id = r;
  update public.c4_games set scored = false where room_id = r;
  again := public.claim_board_win(r);
  reset role;
  results := array_append(results, 'RM7 a phone can''t write who won: the board decides'::text);
  if (select winner from public.c4_games where room_id = r) is distinct from 'o'
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'RM7 a phone can''t clear "paid" on a won board and collect again'::text);
  if again <> 0 or not (select scored from public.c4_games where room_id = r)
  or (select score from public.room_players where room_id = r and user_id = b) <> sb + 1
  then broken := broken || results[cardinality(results)]; end if;
  set local role authenticated;
  update public.c4_games set board = '------------------------------------------', scored = false, phase = 'picking' where room_id = r;
  reset role;
  results := array_append(results, 'RM7 the server reads lines, draws and Memory pairs like the app'::text);
  if public.board_winner('ttt', 'xoxxoxoxo') is distinct from 'draw'
  or public.board_winner('c4', '-----------------x-----x-----xoo---xooo---') is distinct from 'x'
  or public.board_winner('memory', 'xxxxxxxxxxoooooo') is distinct from 'x'
  or public.board_winner('memory', 'xxxx--oo') is not null
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'RM7 a fresh board starts unpaid, with no winner'::text);
  if (select scored or winner is not null from public.c4_games where room_id = r)
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- V2 (F44): only the room's players get on its voice channel ----------
  insert into realtime.messages(topic, extension, event, payload, private)
    values ('voice:' || r, 'broadcast', 'sig', '{}'::jsonb, true);
  perform set_config('realtime.topic', 'voice:' || r, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from realtime.messages where topic = 'voice:' || r;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n2 from realtime.messages where topic = 'voice:' || r;
  reset role;
  results := array_append(results, 'V2 a player in the room hears the call; a stranger doesn''t'::text);
  if n < 1 or n2 <> 0 then broken := broken || results[cardinality(results)]; end if;

  -- ---- DB1 (F48): friend codes are nobody's to read ------------------------
  results := array_append(results, 'DB1 nobody reads friend codes; names stay readable'::text);
  if has_column_privilege('anon', 'public.profiles', 'friend_code', 'select')
  or has_column_privilege('authenticated', 'public.profiles', 'friend_code', 'select')
  or not has_column_privilege('anon', 'public.profiles', 'username', 'select')
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- N1 (F42): a phone pings one person ----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_push_subscription('https://push.test/rules-sql', 'k', 's');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_push_subscription('https://push.test/rules-sql', 'k', 's');
  reset role;
  results := array_append(results, 'N1 a phone that changes hands pings only its new owner'::text);
  if (select array_agg(user_id) from public.push_subscriptions where endpoint = 'https://push.test/rules-sql') is distinct from array[b]
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'DB2 someone signed out can''t save a push address'::text);
  if has_function_privilege('anon', 'public.save_push_subscription(text,text,text)', 'execute')
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- R1 (F16b): a question answered in a room counts, once --------------
  -- A question a hasn't answered in this run (the run's writes all share one
  -- clock, so the Q12 answers above would read as this round's).
  select id, answer, choices into mc2, mc2_answer, mc2_choices from public.puzzles
   where game = 'trivia' and status = 'live' and cardinality(choices) = 4 and id <> mc order by id limit 1;
  update public.room_rounds set winner_id = coalesce(winner_id, a) where room_id = r;
  insert into public.room_rounds(room_id, puzzle_id, round_no) values (r, mc2, 950);
  select total_answered into n from public.profiles where id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.claim_round(r, (select o from unnest(mc2_choices) o where o <> mc2_answer limit 1));
  perform public.claim_round(r, (select o from unnest(mc2_choices) o where o <> mc2_answer limit 1));
  reset role;
  results := array_append(results, 'R1 a room pick counts towards your totals, once per round'::text);
  if (select total_answered from public.profiles where id = a) <> n + 1
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- RM1 (talk item 10): one pick each, and a round that ends -----------
  select score into sa from public.room_players where room_id = r and user_id = a;
  insert into public.room_rounds(room_id, puzzle_id, round_no) values (r, mc2, 951) returning id into rid;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.claim_round(r, (select o from unnest(mc2_choices) o where o <> mc2_answer limit 1));
  j := public.claim_round(r, mc2_answer);
  reset role;
  results := array_append(results, 'RM1 a wrong pick puts you out: the right one after it wins nothing'::text);
  if j->>'won' <> 'false' or j->>'reason' <> 'out'
  or (select score from public.room_players where room_id = r and user_id = a) <> sa
  then broken := broken || results[cardinality(results)]; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.claim_round(r, (select o from unnest(mc2_choices) o where o <> mc2_answer limit 1));
  reset role;
  results := array_append(results, 'RM1 when everyone is out, the round ends with nobody paid'::text);
  if (select ended_at is null or winner_id is not null from public.room_rounds where id = rid)
  then broken := broken || results[cardinality(results)]; end if;
  insert into public.room_rounds(room_id, puzzle_id, round_no) values (r, mc2, 952) returning id into rid;
  set local role authenticated;
  j := public.reveal_round(r);
  reset role;
  update public.room_rounds set started_at = now() - interval '25 seconds' where id = rid;
  set local role authenticated;
  err := (public.reveal_round(r))->>'ended';
  reset role;
  results := array_append(results, 'RM1 Show the answer ends a round only 20 seconds in'::text);
  if j->>'ended' <> 'false' or err <> 'true' then broken := broken || results[cardinality(results)]; end if;
  -- a Ball Sort finisher whose opponent's phone has gone quiet
  delete from public.sort_races where room_id = r;
  insert into public.sort_races(room_id, seed, par, colours, x_tubes, o_tubes, x_player, o_player, x_ms)
    values (r, 1, 10, 3, 'aaa/bbb/ccc//', 'abc/abc/abc//', b, a, 42000);
  update public.room_players set last_seen = now() where room_id = r;
  select score into sa2 from public.room_players where room_id = r and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.sort_walkover(r);
  reset role;
  results := array_append(results, 'RM1 no walkover while the other phone is still there'::text);
  if j->>'winner' is not null then broken := broken || results[cardinality(results)]; end if;
  update public.room_players set last_seen = now() - interval '60 seconds' where room_id = r and user_id = a;
  set local role authenticated;
  perform public.sort_walkover(r); perform public.sort_walkover(r);
  reset role;
  results := array_append(results, 'RM1 a finisher takes the win once the other phone is silent, paid once'::text);
  if (select winner from public.sort_races where room_id = r) is distinct from 'x'
  or (select score from public.room_players where room_id = r and user_id = b) <> sa2 + 1
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- G30 (F11): a guest goes 30 days after they last played ------------
  insert into auth.users(id, instance_id, aud, role, is_anonymous, created_at, updated_at, last_sign_in_at, raw_user_meta_data) values
    (g31,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '31 days', now(), now() - interval '31 days', '{"username":"zzRulesG31"}'),
    (g29,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '29 days', now(), now() - interval '29 days', '{"username":"zzRulesG29"}'),
    (gwin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '45 days', now(), now() - interval '45 days', '{"username":"zzRulesGWin"}');
  insert into public.room_rounds(room_id, puzzle_id, round_no, winner_id) values (r, mc, 999, gwin) returning id into rr;
  err := null;
  begin perform public.sweep_stale_guests(30); exception when others then err := sqlerrm; end;
  results := array_append(results, 'G30 a guest idle 31 days is deleted, one idle 29 days is kept'::text);
  if err is not null or exists (select 1 from auth.users where id = g31) or not exists (select 1 from auth.users where id = g29)
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'G30 a round the guest won doesn''t stop the sweep (the round stays, won by nobody)'::text);
  if err is not null or exists (select 1 from auth.users where id = gwin)
     or (select winner_id from public.room_rounds where id = rr) is not null
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'G30 the sweep runs every night'::text);
  if not exists (select 1 from cron.job where jobname = 'sweep-stale-guests' and active)
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- C1 (F17): signed-out play carries, judged here, streak at most 7 ----
  -- The phone says its near miss was right and sends it twice; it played the
  -- last ten days.
  delete from public.carried_batches where user_id = c;
  update public.profiles set streak = 0, last_played = null where id = c;
  select count(*) into n from public.attempts where user_id = c and puzzle_id = mc;
  select count(*) into n2 from public.attempts where user_id = c and puzzle_id = mc and correct;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.carry_over(cb, jsonb_build_array(jsonb_build_object('puzzle_id', mc, 'given', slip, 'correct', true, 'ms', 3000, 'day', today)),
    array(select today - g from generate_series(0, 9) g), null, today);
  perform public.carry_over(cb, jsonb_build_array(jsonb_build_object('puzzle_id', mc, 'given', slip, 'correct', true, 'ms', 3000, 'day', today)),
    array(select today - g from generate_series(0, 9) g), null, today);
  reset role;
  results := array_append(results, 'C1 a carried answer is judged by the server and filed once, however often it''s sent'::text);
  if (select count(*) from public.attempts where user_id = c and puzzle_id = mc) <> n + 1
  or (select count(*) from public.attempts where user_id = c and puzzle_id = mc and correct) <> n2
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'C1 a phone adds at most 7 days of streak'::text);
  if (select streak from public.profiles where id = c) <> 7 then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'C1 someone signed out can''t carry anything'::text);
  if has_function_privilege('anon', 'public.carry_over(uuid,jsonb,date[],jsonb,date)', 'execute')
  then broken := broken || results[cardinality(results)]; end if;

  -- ---- S4 (talk item 14): the server keeps the Ball Sort clock -------------
  -- now() is fixed inside this transaction, so "time passing" is a stamp moved back.
  delete from public.sort_races where room_id = r;
  insert into public.sort_races(room_id, seed, par, colours, cap, x_tubes, o_tubes, x_player, o_player, started_at)
    values (r, 2, 10, 3, 3, 'abc/abc/abc//', 'abc/abc/abc//', b, a, now() - interval '60 seconds');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ts1 := public.sort_reveal(r);
  reset role;
  update public.sort_races set x_revealed_at = now() - interval '20 seconds' where room_id = r;
  set local role authenticated;
  ts2 := public.sort_reveal(r);
  reset role;
  results := array_append(results, 'S4 revealing again doesn''t restart your race clock'::text);
  if ts2 is distinct from now() - interval '20 seconds' then broken := broken || results[cardinality(results)]; end if;
  perform public.sort_finish(r, b, 'aaa/bbb/ccc//', 10, null, 4000);
  results := array_append(results, 'S4 a race is timed from your reveal: a phone claiming 4 s gets its real 20 s'::text);
  if (select x_ms from public.sort_races where room_id = r) is distinct from 20000 then broken := broken || results[cardinality(results)]; end if;
  perform public.sort_finish(r, a, 'aaa/bbb/ccc//', 10, null, 4000);
  results := array_append(results, 'S4 skipping the reveal times you from the deal, never from the phone'::text);
  if (select o_ms from public.sort_races where room_id = r) is distinct from 60000 then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'S4 someone signed out can''t stamp a reveal'::text);
  if has_function_privilege('anon', 'public.sort_reveal(bigint)', 'execute') then broken := broken || results[cardinality(results)]; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  sid := public.sort_solo_start(current_date, 'hard');
  reset role;
  update public.sort_solo set started_at = now() - interval '30 seconds' where id = sid;
  set local role authenticated;
  sid2 := public.sort_solo_start(current_date, 'hard');
  reset role;
  results := array_append(results, 'S4 reloading the daily Ball Sort keeps its clock running'::text);
  if sid2 <> sid or (select started_at from public.sort_solo where id = sid) <> now() - interval '30 seconds'
  then broken := broken || results[cardinality(results)]; end if;
  results := array_append(results, 'S4 a daily Ball Sort is timed by the server: a phone claiming 5 s gets its real 30 s'::text);
  if public.sort_solo_finish(sid, c, 10, 5000) is distinct from 30000 then broken := broken || results[cardinality(results)]; end if;

  -- ---- verdict (always an error, so everything above rolls back) -----------
  if cardinality(broken) = 0 then
    raise exception 'RULES HOLD: % of %', cardinality(results), cardinality(results);
  else
    raise exception E'RULES BROKEN: % of %\n  %', cardinality(broken), cardinality(results),
      array_to_string(broken, E'\n  ');
  end if;
end $rules$;
