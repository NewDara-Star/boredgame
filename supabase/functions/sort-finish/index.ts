/**
 * Proving a finish, rather than believing one.
 *
 * The database can tell that a board is sorted. It cannot tell that you got
 * there by pouring, and the old flow took your word for it — anyone who read
 * the client could call sort_finish from a console with "0000/1111/2222/3333"
 * and win a race without touching a tube.
 *
 * So the claim is replayed here instead. You send the moves you actually made;
 * this picks the same board the race's seed picked from the bank, applies
 * every move through the reducer, and rejects the first one that is illegal.
 * Only then does it call the privileged settle.
 *
 * The point of doing it in an edge function rather than in SQL: rules.ts and
 * bank.ts beside this file are VERBATIM copies of src/features/sort/ — the
 * files the phones run and the files scripts/check-sort.mts holds to account.
 * A plpgsql reimplementation would be a second version of the rules, free to
 * drift from the first, and a drifted referee is worse than a trusting one.
 * check-sort fails the build if either copy here stops matching.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  dailyPuzzle, decodeLog, decodeTubes, encodeTubes, isSolved, logSolves, newGame, pour, puzzleFor,
  type Level, type Puzzle,
} from "./rules.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * A browser will not POST here without asking permission first.
 *
 * Before a cross-origin POST carrying an Authorization header, the browser
 * sends an OPTIONS preflight. This function answered that preflight with
 * `405 POST only` — its very first line — so the browser refused to send the
 * POST at all. The referee was therefore unreachable from the app FROM THE
 * DAY IT SHIPPED: every Ball Sort finish, solo and room, died at the
 * preflight, and the only sign was a generic "could not post that finish".
 * Three attempts are in the logs as three OPTIONS 405s and no POST.
 *
 * So the preflight is answered, and every reply carries the headers, or the
 * browser discards a perfectly good response.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "no token" }, 401);

  // Read as the PLAYER, so row-level security is what proves they belong in
  // this race rather than a check written here that could be forgotten.
  const asPlayer = createClient(URL_, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await asPlayer.auth.getUser();
  const user = who?.user;
  if (!user) return json({ error: "not signed in" }, 401);

  // Two kinds of finish: a room race (`room`) or a solo attempt at today's
  // board (`solo`, the attempt id). Same replay, different settle.
  let body: { room?: number; solo?: number; moves?: [number, number][]; claimed?: number; ms?: number; log?: string };
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const room = Number(body.room), solo = Number(body.solo);
  const moves = body.moves;
  if ((!Number.isFinite(room) && !Number.isFinite(solo)) || !Array.isArray(moves)) {
    return json({ error: "room or solo, and moves, are required" }, 400);
  }
  // A race is a few dozen pours. Anything near this is someone probing.
  if (moves.length > 2000) return json({ error: "too many moves" }, 400);

  let puzzle: Puzzle;
  let race: { winner: string | null; par: number; seed: number; level: string } | null = null;
  if (Number.isFinite(room)) {
    const { data, error } = await asPlayer
      .from("sort_races").select("*").eq("room_id", room).maybeSingle();
    if (error || !data) return json({ error: "no race you can see there" }, 403);
    race = data;
    if (data.winner) return json({ winner: data.winner, already: true });
    // The same call both phones made to lay the puzzle out: one pick from the bank.
    puzzle = puzzleFor(Number(data.seed), data.level as Level);
  } else {
    const { data, error } = await asPlayer
      .from("sort_solo").select("id, user_id, day, level, ms").eq("id", solo).maybeSingle();
    if (error || !data) return json({ error: "no attempt you can see there" }, 403);
    if (data.user_id !== user.id) return json({ error: "not your attempt" }, 403);
    if (data.ms) return json({ ms: data.ms, already: true });
    // The board the day dealt, from the day the attempt was started on.
    puzzle = dailyPuzzle(String(data.day), data.level as Level);
  }
  let g = newGame(puzzle);
  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i];
    if (!Array.isArray(mv) || mv.length !== 2) {
      return json({ error: `move ${i} is malformed` }, 400);
    }
    const next = pour(g, Number(mv[0]), Number(mv[1]));
    // pour() hands back the object it was given when the pour is illegal, so
    // identity is the check — the same one the UI uses for a stray tap.
    if (next === g) return json({ error: `move ${i} is not a legal pour` }, 400);
    g = next;
  }
  if (!isSolved(g.tubes, g.cap)) return json({ error: "those moves do not finish it" }, 400);

  // Undo does not remove a move from your count, so the client's number can be
  // higher than the replay's — never lower, and a higher one only costs them.
  const claimed = Number(body.claimed);
  const settled = Math.max(g.moves, Number.isFinite(claimed) ? claimed : 0);

  // The replay, if one came: every ball that moved, with its time. Stored
  // only if it is itself a legal line that finishes this board — a film of
  // a different solve is not this finish's film. Missing or bent, it is
  // dropped; the finish still counts.
  const log = typeof body.log === "string" && body.log.length <= 6000 && /^[0-5][0-5]@\d+(,[0-5][0-5]@\d+)*$/.test(body.log)
    && logSolves(puzzle, decodeLog(body.log)) ? body.log : null;

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

  // The ranked/compared time is the player's OWN solve time, measured on their
  // phone -- the only clock the finish round-trip does not warp. Never trusted:
  // the settle caps it at the server wall-clock and floors it at 150ms/move.
  // Measuring it here (now() - started_at) would count this request's latency
  // -- the verify round-trip and the replay -- against a millisecond board.
  const solveMs = Number(body.ms);
  const ms_ = Number.isFinite(solveMs) && solveMs > 0 ? Math.round(solveMs) : null;

  if (race) {
    // Provisional: the room settle records this seat's time and names a winner
    // only once both have finished (or one has conceded) -- lowest time wins, so
    // a faster solve that arrives second still takes it.
    const { data: winner, error: settleError } = await admin.rpc("sort_finish", {
      p_room: room, p_user: user.id, p_tubes: encodeTubes(g.tubes),
      p_moves: settled, p_log: log, p_ms: ms_,
    });
    if (settleError) return json({ error: settleError.message }, 400);
    return json({ winner, moves: settled, par: race.par, tubes: encodeTubes(g.tubes) });
  }
  const { data: ms, error: settleError } = await admin.rpc("sort_solo_finish", {
    p_id: solo, p_user: user.id, p_moves: settled, p_ms: ms_, p_log: log,
  });
  if (settleError) return json({ error: settleError.message }, 400);
  return json({ ms, moves: settled, par: puzzle.par });
});

// decodeTubes is exported by rules.ts and unused here; referenced so a future
// edit that drops it from the shared file fails this build rather than the app.
void decodeTubes;
