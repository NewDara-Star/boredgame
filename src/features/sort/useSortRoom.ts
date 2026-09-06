import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fire, refusal } from "@/shared/lib/fire";
import { supabase } from "@/shared/lib/supabase";
import { attempt } from "@/shared/lib/write";
import {
  decodeTubes, encodeLog, encodeTubes, isSolved, newGame, pour, puzzleFor, solvedCount, undo, whyNot,
  type Game, type Level, type Tube,
} from "./rules";
import type { Refusal } from "./Board";

export type Seat = "x" | "o";

/** The stored row. The tubes are strings because SQL reads them too. */
export interface SortRow {
  room_id: number;
  seed: number;
  level: Level;
  par: number;
  cap: number;
  colours: number;
  x_tubes: string;
  o_tubes: string;
  x_moves: number;
  o_moves: number;
  x_done_at: string | null;
  o_done_at: string | null;
  /** each seat's own bounded solve time; the winner is the lower of the two */
  x_ms: number | null;
  o_ms: number | null;
  /** conceding hands the other player the race, finished or not */
  x_gave_up: boolean;
  o_gave_up: boolean;
  winner: Seat | null;
  x_player: string | null;
  o_player: string | null;
  /** the winner's replay — see sort_solo.log */
  x_log: string | null;
  o_log: string | null;
  started_at: string;
  updated_at: string;
}

/**
 * A race across two phones.
 *
 * Every other room in here syncs ONE board that both players write, and the
 * hard part is stopping them writing it at the same time. This is the other
 * shape entirely: two independent boards from one seeded puzzle, and the only
 * contended thing is who was faster.
 *
 * Faster, not first-to-arrive. Each phone times its own solve locally, from its
 * OWN first lift -- not the shared deal, so arriving late, or the lobby starting
 * the match while you were still away from the board, never runs your clock. That
 * local time is the one the finish round-trip cannot warp. The server compares those two times, not which packet
 * landed first, so the player on worse wifi is not punished for their ping. A
 * finish is therefore PROVISIONAL: it says "I'm done in 12.4s" and waits for the
 * other board to finish or give up before anyone is called the winner.
 *
 * Your own board is authoritative LOCALLY. Pours apply instantly and are then
 * posted; the row is how she sees you, not how you see yourself.
 */
export function useSortRoom(roomId: number | null, userId: string | undefined) {
  const [row, setRow] = useState<SortRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Game | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [finishing, setFinishing] = useState(false);
  // The clock stops HERE, at the solve, not after the referee has replayed the
  // moves. This is the time that gets compared, and the on-screen clock freezes
  // on it while you wait for the other board.
  const [solvedMs, setSolvedMs] = useState<number | null>(null);
  // When YOUR clock started: the moment of your first lift, not the deal. A ref,
  // so a tick does not depend on it; the first-lift setSelected re-render surfaces
  // it to the screen.
  const startedRef = useRef<number | null>(null);

  const seat: Seat | null = !row || !userId ? null
    : row.x_player === userId ? "x" : row.o_player === userId ? "o" : null;

  const puzzle = useMemo(
    () => (row ? puzzleFor(Number(row.seed), row.level) : null),
    [row?.seed, row?.level],
  );

  // A fresh puzzle — first load, or a rematch — resets the local board.
  const dealtFor = useRef<number | null>(null);
  useEffect(() => {
    if (!puzzle || !row) return;
    if (dealtFor.current === Number(row.seed)) return;
    dealtFor.current = Number(row.seed);
    setMe(newGame(puzzle));
    setSelected(null); setRefused(null);
    setFinishing(false); setSolvedMs(null);
    startedRef.current = null;
  }, [puzzle, row?.seed]);

  // the row, then every change to it
  useEffect(() => {
    if (!supabase || !roomId) return;
    let alive = true;
    void supabase.from("sort_races").select("*").eq("room_id", roomId).maybeSingle()
      .then(({ data }) => { if (alive && data) setRow(data as SortRow); });

    const channel = supabase.channel(`sort:${roomId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sort_races", filter: `room_id=eq.${roomId}` },
        (payload) => {
          // A DELETE delivers `new` as `{}` (truthy), which decodeTubes(undefined)
          // would crash on -- take only a real race row.
          if (payload.eventType === "DELETE" || !(payload.new as SortRow)?.room_id) return;
          if (alive) setRow(payload.new as SortRow);
        })
      .subscribe();
    return () => { alive = false; void supabase!.removeChannel(channel); };
  }, [roomId]);

  /** Post my board so her screen can see it. Fire and forget: the pour has
      already happened here, and a failed post costs a frame of her view, not
      the move. */
  const post = useCallback((g: Game) => {
    if (!supabase || !roomId) return;
    fire(supabase.rpc("sort_move", {
      p_room: roomId, p_tubes: encodeTubes(g.tubes), p_moves: g.moves,
    }), "Posting your board");
  }, [roomId]);

  /**
   * Crossing the line. The move list goes with it, and the server replays it
   * against the puzzle the seed generates before it will keep the time — so this
   * is a claim being submitted for checking, not a result. The time is my own
   * (`ms`), measured from my first lift; the server bounds it and, when the
   * other board is also in, decides who was faster.
   */
  const finish = useCallback(async (g: Game, ms: number) => {
    if (!supabase || !roomId || finishing) return;
    setFinishing(true);
    const { error: err } = await supabase.functions.invoke("sort-finish", {
      body: {
        room: roomId,
        moves: g.history.map((h) => [h.from, h.to]),
        claimed: g.moves,
        ms,
        log: encodeLog(g.log),
      },
    });
    if (err) {
      const why = await refusal(err);
      setError(why ? `That finish was not accepted: ${why}`
                   : "Could not post that finish — try tapping again.");
      // The finish did not land: let them try again rather than stranding the
      // board frozen on a solve the server never recorded.
      setSolvedMs(null);
    }
    setFinishing(false);
  }, [roomId, finishing]);

  /** Tap a tube: the first lifts its top ball, the second drops it there. A
      tube that cannot take it — only ever a full one — refuses visibly and the
      ball stays lifted. */
  const pick = useCallback((i: number) => {
    if (!me || row?.winner || solvedMs !== null) return;
    if (selected === null) {
      if (me.tubes[i].length > 0) {
        // Your clock starts at your first lift, not the shared deal.
        if (startedRef.current === null) startedRef.current = Date.now();
        setSelected(i);
      }
      return;
    }
    if (selected === i) { setSelected(null); return; }
    if (whyNot(me.tubes, me.cap, selected, i)) { setRefused({ tube: i, at: Date.now() }); return; }
    const at = startedRef.current === null ? 0 : Date.now() - startedRef.current;
    const next = pour(me, selected, i, at);
    setSelected(null);
    setMe(next);
    if (isSolved(next.tubes, next.cap)) { setSolvedMs(at); void finish(next, at); }
    else post(next);
  }, [me, selected, row?.winner, solvedMs, post, finish]);

  const takeBack = useCallback(() => {
    if (!me || row?.winner || solvedMs !== null) return;
    setSelected(null);
    const at = startedRef.current === null ? 0 : Date.now() - startedRef.current;
    const back = undo(me, at);
    setMe(back);
    post(back);
  }, [me, row?.winner, solvedMs, post]);

  /** Give up the race. The other player wins now, whether or not they have
      finished — there is no replay to check, so this goes straight to the row. */
  const concede = useCallback(async () => {
    if (!supabase || !roomId) return;
    setError(await attempt("Giving up the race",
      supabase.rpc("sort_concede", { p_room: roomId })));
  }, [roomId]);

  const rematch = useCallback(async () => {
    if (!supabase || !roomId) return;
    const seed = Date.now();
    const p = puzzleFor(seed, row?.level ?? "medium");
    setError(await attempt("Dealing a new race", supabase.rpc("sort_rematch", {
      p_room: roomId, p_seed: seed, p_par: p.par,
      p_colours: p.colours, p_tubes: encodeTubes(p.tubes),
    })));
  }, [roomId, row?.level]);

  const quit = useCallback(async () => {
    if (!supabase || !roomId) return;
    setError(await attempt("Ending the match", supabase.rpc("end_match", { p_room: roomId })));
  }, [roomId]);

  const theirTubes: Tube[] | null = !row || !seat ? null
    : decodeTubes(seat === "x" ? row.o_tubes : row.x_tubes);
  const theirMoves = !row || !seat ? 0 : seat === "x" ? row.o_moves : row.x_moves;

  const myMs = !row || !seat ? null : seat === "x" ? row.x_ms : row.o_ms;
  const theirMs = !row || !seat ? null : seat === "x" ? row.o_ms : row.x_ms;
  const theyGaveUp = !row || !seat ? false : seat === "x" ? row.o_gave_up : row.x_gave_up;

  return {
    row, seat, puzzle, me, selected, refused, error, finishing, solvedMs,
    startedMs: startedRef.current,
    theirTubes, theirMoves,
    // My solve is in the moment I finish; the row catches up a beat later.
    myMs: solvedMs ?? myMs,
    theirMs,
    iFinished: solvedMs !== null || myMs !== null,
    theyFinished: theirMs !== null,
    theyGaveUp,
    myProgress: me ? solvedCount(me.tubes, me.cap) : 0,
    theirProgress: theirTubes && row ? solvedCount(theirTubes, row.cap) : 0,
    won: row?.winner ?? null,
    iWon: !!row?.winner && row.winner === seat,
    pick, takeBack, concede, rematch, quit,
  };
}

/** Deal the race. The database decides who deals, so a second client — or one
    client's effect firing twice — cannot lay a second puzzle over a live one. */
export async function startSortRace(roomId: number, _xId: string, _oId: string) {
  if (!supabase) return null;
  const seed = Date.now();
  const p = puzzleFor(seed, "medium");
  return await attempt("Dealing the tubes", supabase.rpc("sort_start", {
    p_room: roomId, p_seed: seed, p_level: "medium", p_par: p.par,
    p_cap: p.cap, p_colours: p.colours, p_tubes: encodeTubes(p.tubes),
  }));
}
