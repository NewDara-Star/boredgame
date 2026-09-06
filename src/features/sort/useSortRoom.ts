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
 * contended thing is who finished. So there is no turn, no stall rescue and no
 * single-writer rule — just your board, hers arriving over realtime, and a
 * finish the server adjudicates.
 *
 * Your own board is authoritative LOCALLY. Pours apply instantly and are then
 * posted; the row is how she sees you, not how you see yourself. A round trip
 * to Dublin before a ball moves would make the game feel broken, and there is
 * nothing to reconcile because nobody else can write your columns.
 */
export function useSortRoom(roomId: number | null, userId: string | undefined) {
  const [row, setRow] = useState<SortRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Game | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [finishing, setFinishing] = useState(false);

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
    setFinishing(false);
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
   * against the puzzle the seed generates before it will call anyone a winner
   * — so this is a claim being submitted for checking, not a result.
   */
  const finish = useCallback(async (g: Game) => {
    if (!supabase || !roomId || finishing) return;
    setFinishing(true);
    const { error: err } = await supabase.functions.invoke("sort-finish", {
      body: {
        room: roomId,
        moves: g.history.map((h) => [h.from, h.to]),
        claimed: g.moves,
        log: encodeLog(g.log),
      },
    });
    if (err) {
      const why = await refusal(err);
      setError(why ? `That finish was not accepted: ${why}`
                   : "Could not post that finish — try tapping again.");
    }
    setFinishing(false);
  }, [roomId, finishing]);

  /** Tap a tube: the first lifts its top ball, the second drops it there. A
      tube that cannot take it — only ever a full one — refuses visibly and the
      ball stays lifted. */
  const pick = useCallback((i: number) => {
    if (!me || row?.winner) return;
    if (selected === null) {
      if (me.tubes[i].length > 0) setSelected(i);
      return;
    }
    if (selected === i) { setSelected(null); return; }
    if (whyNot(me.tubes, me.cap, selected, i)) { setRefused({ tube: i, at: Date.now() }); return; }
    // the race's clock, not the phone's: the film counts from the deal
    const next = pour(me, selected, i, Date.now() - Date.parse(row?.started_at ?? "") || 0);
    setSelected(null);
    setMe(next);
    if (isSolved(next.tubes, next.cap)) void finish(next);
    else post(next);
  }, [me, selected, row?.winner, row?.started_at, post, finish]);

  const takeBack = useCallback(() => {
    if (!me || row?.winner) return;
    setSelected(null);
    const back = undo(me, Date.now() - Date.parse(row?.started_at ?? "") || 0);
    setMe(back);
    post(back);
  }, [me, row?.winner, row?.started_at, post]);

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

  return {
    row, seat, puzzle, me, selected, refused, error, finishing,
    theirTubes, theirMoves,
    myProgress: me ? solvedCount(me.tubes, me.cap) : 0,
    theirProgress: theirTubes && row ? solvedCount(theirTubes, row.cap) : 0,
    won: row?.winner ?? null,
    iWon: !!row?.winner && row.winner === seat,
    pick, takeBack, rematch, quit,
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
