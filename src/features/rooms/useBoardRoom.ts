import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { serverNowIso, serverToLocal, syncClock } from "@/shared/lib/serverClock";
import { shuffle } from "@/features/play/content";
import { BANK_FAILED, useRoomBank } from "./useRoomBank";
import { deal } from "@/features/play/dealer";
import { scopePool, emptyReason, type Scope } from "@/features/play/scope";
export type { Scope };
import { attempt } from "@/shared/lib/write";
import { useMarkPlayed, fileRoomAnswer } from "@/features/play/played";
import { isShot, nextMix, stepLevel, turnKindOf, type Challenge, type Play, type TurnKind } from "@/features/challenge/kinds";
import type { ShotRec } from "@/features/challenge/shots";

export type Mark = "x" | "o";
export type Phase = "picking" | "asking" | "revealed" | "over";

/** Everything this hook needs to know about a game state. Both rules modules
    already satisfy it — c4's `last` carries a column and Square Off's carries a
    square, and that is not any of this file's business. */
export interface BoardState {
  board: (Mark | null)[];
  phase: Phase;
  turn: Mark;
  last: { by: Mark; correct: boolean } | null;
  winner: Mark | "draw" | null;
}

/** The stored row, minus whatever shape the board itself is stored in. */
export interface BoardRow {
  room_id: number;
  turn: Mark;
  winner: Mark | "draw" | null;
  puzzle_id: number | null;
  x_player: string | null;
  o_player: string | null;
  updated_at: string;
  /** the server's time of the last write (a trigger stamps it) */
  stamped_at?: string | null;
  /** Play it with: this turn's challenge under Mix, and each player's shot level */
  play?: Play | null;
  /** the last shot's flight, for the other phone to play back */
  shot?: RoomShotRec | null;
}
/** A flight as a room stores it: which turn it belongs to (the asked seed) and whose. */
export type RoomShotRec = ShotRec & { seed: number; by: Mark };

/**
 * The differences between two board games, and nothing else. Square Off and
 * Connect 4 had a hook each, 234 and 223 lines, whose subscription, optimistic
 * write, win booking, quit, reopen and start were identical to four significant
 * figures — and the realtime publication bug that made every Connect 4 move
 * invisible to the opponent was exactly the kind of thing that hides in a copy.
 */
export interface BoardEngine<G extends BoardState, R extends BoardRow> {
  table: string;
  /** realtime channel prefix, only so two channels never collide */
  channel: string;
  decode(row: R): G;
  encode(g: G): Record<string, unknown>;
  newGame(first: Mark): G;
  /** The plain move: take the square, drop the disc. No question. */
  place(g: G, cell: number): G;
  /** The trivia move: name what you are going for, the question follows. */
  pick(g: G, cell: number): G;
  answer(g: G, correct: boolean): G;
  advance(g: G): G;
  /**
   * Who owes the pending answer. Always whoever's turn it is, in every game —
   * but it stays a hook rather than a constant because each game stores it
   * differently, and because it was NOT always true: Square Off used to hand a
   * missed question to the opponent.
   */
  answerer(g: G): Mark | null;
  /**
   * Where the bot would move. Deliberately not a solved player in any of them —
   * a perfect Tic Tac Toe opponent draws every time and a perfect memory never
   * loses, which is the opposite of the point.
   *
   * `seen` is whatever this engine has been shown this session, kept by the
   * hook and filled in by `observe`. Engines that need no memory ignore it.
   */
  botCell(g: G, me: Mark, rand?: () => number, seen?: Map<number, number>): number;
  /** How long a reveal stays up before play moves on, where the game needs its
      own: Memory's missed pair is the thing you're trying to remember. */
  revealMs?: number;
  /** Called on every state the bot could learn from. Only Memory implements it. */
  observe?(g: G, seen: Map<number, number>): void;
  /** One line of English for what just happened. The board alone is not
      legible: it cannot say "you missed, so the bot gets one shot at it". */
  describe(g: G, names: Record<Mark, string>, you: Mark | null): string;
}

export function useBoardRoom<G extends BoardState, R extends BoardRow>(
  engine: BoardEngine<G, R>,
  roomId: number | null,
  userId: string | undefined,
  scope: Scope | null = null,
  /** No questions at all: taking the square is the whole move. */
  plain = false,
  /** What taking a spot costs (Play it with). A shot deals no puzzle: the
      scene comes from the seed both clients already share. */
  challenge: Challenge = "trivia",
) {
  const [row, setRow] = useState<R | null>(null);
  // Mirrors `row` so `write` can revert a failed move without taking `row` as a
  // dependency — `write` has to keep a stable identity or the reveal timer,
  // which depends on it, restarts every time the row changes.
  const rowRef = useRef<R | null>(null);
  const remember = useCallback((next: R | null) => { rowRef.current = next; setRow(next); }, []);
  // Trivia boards only: nothing to ask, nothing to fetch. Keeps retrying a
  // failed load (useRoomBank) instead of dealing for ever.
  const asksQuestions = challenge === "trivia" || challenge === "mix";
  const bank = useRoomBank("trivia", !plain && asksQuestions);
  const pool = useMemo(() => shuffle(bank.pool.filter((i) => i.choices && i.choices.length >= 2)), [bank.pool]);
  const seen = useRef<Set<string>>(new Set());
  const lastServed = useRef<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => { void syncClock(); }, []);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.from(engine.table).select("*").eq("room_id", roomId).maybeSingle();
      if (cancelled) return;
      remember((data as R | null) ?? null);
      channel = supabase!
        .channel(`${engine.channel}:${roomId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: engine.table, filter: `room_id=eq.${roomId}` },
          (p) => {
            // A DELETE (the room row cascades to the game row) delivers `new` as
            // `{}`, not null -- remembering it and decoding an empty row crashes
            // the screen. Only take a payload that is an actual game row.
            if (p.eventType === "DELETE" || !(p.new as R)?.room_id) return;
            remember(p.new as R);
          })
        .subscribe(async (status) => {
          // The board is dealt a moment after the room turns to "playing", which
          // is what mounts this. A deal that lands between the read above and
          // this subscription taking hold was heard by nobody, and the phone sat
          // on "Dealing the board…" for good (found 26 Sep, two phones in a
          // test room). Once listening, read again if there's still no board.
          if (status !== "SUBSCRIBED" || cancelled || rowRef.current) return;
          const { data: again } = await supabase!.from(engine.table).select("*").eq("room_id", roomId).maybeSingle();
          if (!cancelled && again && !rowRef.current) remember(again as R);
        });
    })();
    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, [roomId, remember, engine.table, engine.channel]);

  const game: G | null = useMemo(() => (row ? engine.decode(row) : null), [row, engine]);
  const myMark: Mark | null =
    !row || !userId ? null : row.x_player === userId ? "x" : row.o_player === userId ? "o" : null;
  const markPlayed = useMarkPlayed();
  const item = row?.puzzle_id != null
    ? pool.find((i) => i.id === String(row.puzzle_id)) ?? null
    : null;

  // Memoised on the scope's CONTENT, not its identity. The room row is replaced
  // on every realtime tick, so a `{categories, difficulty}` built in the parent
  // is a new object each render — and a changing nextPuzzleId changes `write`,
  // which restarts the reveal timer that depends on it, forever.
  const scopeKey = JSON.stringify([scope?.categories ?? null, scope?.difficulty ?? null]);

  const nextPuzzleId = useCallback(() => {
    const scoped = scopePool(pool, scope ?? {});
    // An empty scope is a misconfigured room, not a reason to quietly serve from
    // the whole bank as if the filter had never been set.
    if (scoped.length === 0) {
      setPoolError(emptyReason(scope ?? {}, pool.length === 0));
      return null;
    }
    setPoolError(null);
    const { item: q } = deal(scoped, (i) => i.id, seen.current, { avoid: lastServed.current });
    if (!q) return null;
    lastServed.current = q.id;
    return Number(q.id);
  }, [pool, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Write a transition. Whether a question is dealt is read off the state
   * itself — a state that is `asking` needs one, and nothing else does. It used
   * to be a boolean each caller passed, and Connect 4 passed it wrongly at three
   * call sites, dealing a question for a phase that never asks one.
   */
  const write = useCallback(async (next: G, extra?: Record<string, unknown>) => {
    if (!supabase || !roomId) return;
    const patch: Record<string, unknown> = {
      // updated_at is this phone's (it is also the shots' shared seed);
      // stamped_at is the server's, set on arrival: this is only its stand-in
      // until then, on the server's clock so the bar doesn't jump.
      ...engine.encode(next), updated_at: new Date().toISOString(), stamped_at: serverNowIso(),
    };
    const before = rowRef.current;
    const was = before ? engine.decode(before) : null;
    const kindNow: TurnKind = turnKindOf(challenge, before?.play, roomId);
    if (next.phase === "asking") {
      patch.puzzle_id = kindNow === "trivia" && !plain ? nextPuzzleId() : null;
    }
    // A shot taken (or timed out) moves the thrower's level: two misses running
    // and the game makes theirs easier, two hits and it's back to Normal.
    if (!plain && isShot(kindNow) && was?.phase === "asking" && next.phase !== "asking" && next.last) {
      patch.play = stepLevel(before?.play, next.last.by, next.last.correct);
    }
    // Mix: a new turn deals its challenge, never the same one twice running, and
    // writes it so both phones name the same one before the pick.
    if (challenge === "mix" && !plain && next.phase === "picking" && was && was.phase !== "picking") {
      patch.play = { ...((patch.play as Play | undefined) ?? before?.play), kind: nextMix(kindNow) };
    }
    if (extra) Object.assign(patch, extra);

    // Apply it here first. Waiting for the write AND the realtime echo before
    // showing your own move meant every tap cost a round trip plus a push before
    // anything on your screen moved — and if realtime hiccupped, nothing moved
    // at all. Realtime is the confirmation now, not the trigger.
    if (before) remember({ ...before, ...patch } as R);

    const msg = await attempt("That move",
      supabase.from(engine.table).update(patch).eq("room_id", roomId));
    setWriteError(msg);
    // A refused move must not leave a board on screen that no one else can see.
    if (msg && before) remember(before);
    return msg;
  }, [roomId, nextPuzzleId, remember, engine, challenge, plain]);

  /** Book the win. Incremented in the database rather than read-modify-written
      from this client's copy of the players list, which can lag realtime
      across a rematch. */
  const bookWin = useCallback(async (next: G) => {
    if (next.phase !== "over" || !next.winner || next.winner === "draw") return;
    if (!supabase || !roomId) return;
    // The server reads the board and credits the ACTUAL winner, once. No seat is
    // sent -- the client cannot name who to pay, and a repeat call (both browsers
    // watching, or a rescue) scores nothing further.
    setWriteError(await attempt("Recording the win",
      supabase.rpc("claim_board_win", { p_room: roomId })));
  }, [roomId]);

  const apply = useCallback(async (next: G, extra?: Record<string, unknown>) => {
    // Only book the win if the winning board actually landed. `write` reverts its
    // optimistic row and returns the error when the update is refused; on that
    // path the opponent never sees the win, so crediting the score would leave
    // the tally ahead of a game that, to everyone else, is still going.
    const msg = await write(next, extra);
    if (!msg) await bookWin(next);
  }, [write, bookWin]);

  // And every seated phone books a finished game as it sees it arrive, not only
  // the one that made the winning move: if that phone's call dropped (signal,
  // the app closed on the win), the win was never counted. The server pays once,
  // from the game's own row, whoever calls and however often (RM3); a call that
  // lands before the winning board does finds no winner and pays nothing.
  const bookedFor = useRef<unknown>(null);
  useEffect(() => {
    if (!game || !myMark || game.phase !== "over" || bookedFor.current === row) return;
    bookedFor.current = row;
    void bookWin(game);
    void markPlayed();                       // any finished game keeps the streak (talk item 1)
  }, [game, myMark, row, bookWin, markPlayed]);

  const choose = useCallback((cell: number) => {
    // No phase check here on purpose. Memory's second tap lands during
    // `asking`, and every reducer already refuses an illegal move by handing
    // back the state it was given — so the reducer is the authority and the
    // hook does not keep a second, staler copy of the rules.
    if (!game || myMark !== game.turn) return;
    const next = plain ? engine.place(game, cell) : engine.pick(game, cell);
    if (next === game) return;               // full column, taken square: nothing happened
    void apply(next);
  }, [game, myMark, plain, apply, engine]);

  const submit = useCallback((correct: boolean, given?: string) => {
    if (!game || game.phase !== "asking" || engine.answerer(game) !== myMark) return;
    void apply(engine.answer(game, correct));
    // A question answered in a room counts like one answered solo (talk item 1):
    // the server judges what was picked and files it. The catapult has nothing
    // to file: it hands in no answer.
    if (given !== undefined && row?.puzzle_id != null) {
      const asked = row.stamped_at ? serverToLocal(row.stamped_at) : Date.parse(row.updated_at);
      void fileRoomAnswer(row.puzzle_id, given, Date.now() - asked);
    }
    void markPlayed();
  }, [game, myMark, apply, engine, row, markPlayed]);

  /** A shot's result, with its flight for the other phone. Written the moment
      the shot settles, so their replay starts while your result is still up. */
  const submitShot = useCallback((hit: boolean, rec?: ShotRec) => {
    if (!game || game.phase !== "asking" || !myMark || engine.answerer(game) !== myMark || !row) return;
    const seed = Date.parse(row.updated_at);
    void apply(engine.answer(game, hit), { shot: rec ? { ...rec, seed, by: myMark } : null });
    void markPlayed();
  }, [game, myMark, apply, engine, row, markPlayed]);

  /** Move on now rather than sitting out the pause. The timer stays as the
      fallback so an idle player cannot stall the board, but a pause you can
      skip is the difference between a game that feels quick and one that does
      not — a shorter fixed timer is not the same thing. */
  const advanceNow = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    void write(engine.advance(game));
  }, [game, myMark, write, engine]);

  /** Writes the miss for a question nobody answered — including when the person
      who owed it has closed the tab. Callers must check stallWriter() first. */
  const forceTimeout = useCallback(() => {
    if (!game || game.phase !== "asking") return;
    void write(engine.answer(game, false));
  }, [game, write, engine]);

  /** Moves on from a reveal its owner never wrote. The pause below is a
      setTimeout in that player's tab, so a locked phone, an app switch or a
      backgrounded laptop suspends it and the board freezes for both players
      with nothing else running anywhere. Unguarded on purpose — the caller is
      whichever client stallWriter() named, which is not always the answerer. */
  const forceAdvance = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last) return;
    void write(engine.advance(game));
  }, [game, write, engine]);

  /** Ends the session rather than the game. Rematch keeps the tally; this stops
      it. Through an RPC because the UPDATE policy on rooms is host-only — as a
      direct update this matched zero rows for the guest and said nothing. */
  const quit = useCallback(async () => {
    if (!supabase || !roomId) return;
    setWriteError(await attempt("Ending the match",
      supabase.rpc("end_match", { p_room: roomId })));
  }, [roomId]);

  /** Back to the lobby with the same code and the same two people, so a
      different game does not cost a new room. Clearing the other player's ready
      flag is not something RLS lets a client do, hence the RPC. */
  const changeGame = useCallback(async () => {
    if (!supabase || !roomId) return;
    setWriteError(await attempt("Reopening the room",
      supabase.rpc("reopen_room", { p_room: roomId })));
  }, [roomId]);

  // What this turn costs, and how long the last shot's flight runs: the other
  // phone plays it back, so the board waits for it.
  const kind: TurnKind | null = plain ? null : turnKindOf(challenge, row?.play, roomId ?? 0);
  const flightMs = row?.shot && game?.last && row.shot.by === game.last.by ? Math.round(row.shot.f.length / 30 * 1000) : 0;

  // The player who just answered owns the move on, so exactly one client writes it.
  useEffect(() => {
    if (plain || !game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    // A correct answer has nothing to read; a miss has the right answer and
    // sometimes an explanation. One fixed pause served neither. A shot waits
    // while the other phone replays it, then for its result to be read.
    const pause = engine.revealMs ?? (kind && isShot(kind) ? 2600 + flightMs
      : game.last.correct ? 1300 : item?.explanation ? 2900 : 2200);
    const t = setTimeout(() => void write(engine.advance(game)), pause);
    return () => clearTimeout(t);
  }, [plain, game, myMark, write, engine, item?.explanation, kind, flightMs]);

  const rematch = useCallback(async () => {
    if (!supabase || !roomId || !row) return;
    // Loser starts the next one. After a draw, alternate off whoever started
    // last rather than defaulting to x every time.
    const first: Mark = row.winner === "x" ? "o"
      : row.winner === "o" ? "x"
      : row.turn === "x" ? "o" : "x";
    // Under Mix the next game's first turn is dealt now, so it isn't the last
    // game's again. Levels carry on: it's the same match.
    const play = challenge === "mix" ? { play: { ...row.play, kind: nextMix(turnKindOf(challenge, row.play, roomId)) } } : {};
    setWriteError(await attempt("Starting the rematch",
      supabase.from(engine.table)
        .update({ ...engine.encode(engine.newGame(first)), puzzle_id: null, scored: false, ...play })
        .eq("room_id", roomId)));
  }, [roomId, row, engine, challenge]);

  return {
    game, myMark, item, choose, submit, submitShot, rematch, quit, changeGame,
    /** what this turn costs (null on a plain board) */
    kind,
    /** each player's shot level and, under Mix, the turn's challenge */
    play: row?.play ?? null,
    /** the last flight, for the phone that's watching */
    shot: row?.shot ?? null,
    /** how long that flight takes to play back */
    flightMs,
    forceTimeout, forceAdvance, advanceNow,
    error: poolError ?? writeError,
    /** A plain or shots-only game is never waiting for content — it has none. */
    ready: plain || !asksQuestions || pool.length > 0,
    /** the questions didn't load; it keeps trying, and this says so */
    bankTrouble: bank.failed && pool.length === 0 ? BANK_FAILED : null,
    retryBank: bank.retryNow,
    /** when the current question went up, on this phone's clock: the server's
        stamp corrected by this phone's offset (a row from before the stamp
        existed falls back to the writer's own time) */
    askedAt: row ? (row.stamped_at ? serverToLocal(row.stamped_at) : Date.parse(row.updated_at)) : 0,
    /** the same for both phones, for anything drawn from it (the catapult's pot) */
    askedSeed: row ? Date.parse(row.updated_at) : 0,
    seats: { x: row?.x_player ?? null, o: row?.o_player ?? null },
  };
}

/**
 * Dealing the board is not a hook — the lobby starts the game once both players
 * have agreed, and the lobby does not own a board subscription.
 */
export async function startBoard<G extends BoardState, R extends BoardRow>(
  engine: BoardEngine<G, R>, roomId: number, xId: string, oId: string,
) {
  if (!supabase) return null;
  // The database decides who starts. A client-side "am I the host" guard holds
  // against two people but not against one client's effect firing twice, and a
  // second upsert here wipes a board that is already in play.
  const { data: won, error } = await supabase.rpc("claim_room_start", { p_room: roomId });
  if (error) return await attempt("Starting the game", Promise.resolve({ error }));
  if (won !== true) return null;
  return await attempt("Dealing the board", supabase.from(engine.table).upsert({
    room_id: roomId, ...engine.encode(engine.newGame("x")),
    puzzle_id: null, x_player: xId, o_player: oId, scored: false,
    // a new match: everyone back on Normal, and no flight from the last one
    play: null, shot: null,
  }));
}
