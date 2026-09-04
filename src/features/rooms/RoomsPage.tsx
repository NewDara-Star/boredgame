import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRoom, createRoom } from "./useRoom";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Field, Input } from "@/shared/ui/Field";
import { isCorrect } from "@/shared/lib/normalise";
import { SquareOffRoom } from "@/features/squareoff/SquareOffRoom";
import { supabase } from "@/shared/lib/supabase";

/** Names only. The room screen does not have a loaded pool to count against, and
    a wrong count is worse than none. */
function useCategoryNames() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!supabase) return;
    void supabase.from("categories").select("name").order("name")
      .then(({ data }) => setNames((data ?? []).map((c: { name: string }) => c.name)));
  }, []);
  return names;
}

export function RoomsPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, offline } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const allCategories = useCategoryNames();
  const [guess, setGuess] = useState("");
  const uname = user?.email?.split("@")[0] ?? "player";

  const { room, players, round, currentPuzzle, error, join, startNextRound, claimWin } =
    useRoom(code, user?.id);

  if (offline) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold">Head-to-head needs a database</h1>
        <p className="text-sm text-soft mt-2">
          Two browsers have to see the same room. Add your Supabase URL and anon key to <code>.env</code>,
          run <code>supabase/schema.sql</code>, and this page comes alive. Single-player works without it.
        </p>
      </Card>
    );
  }

  if (!user) {
    return <p className="text-sm text-soft">Sign in on the Profile tab first — rooms need to know who you are.</p>;
  }

  if (!code) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Head-to-head</h1>

        {/* Above the create buttons, not inside one of them. Buried in the Square
            Off card it was unlabelled, applied to only one of the three modes,
            and nobody found it. */}
        <div className="piece p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-soft">
            Question pool · optional
          </p>
          <p className="text-sm font-semibold mt-1">
            Every category unless you narrow it. Pick before you create — both players
            share one pool, and it can't be changed once the room exists.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allCategories.map((n) => {
              const on = picked.includes(n);
              return (
                <button key={n} type="button"
                  onClick={() => setPicked(on ? picked.filter((x) => x !== n) : [...picked, n])}
                  className={`border-2 border-ink rounded-full px-2.5 py-1 text-[12px] font-bold
                    ${on ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-soft flex-1">
              {picked.length === 0
                ? "All categories"
                : `${picked.length} selected`}
            </p>
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])}
                className="border-2 border-ink rounded-full px-2.5 py-1 text-[11px] font-black
                  uppercase tracking-wider bg-pop">
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="piece p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-soft">Square Off</p>
          <p className="text-sm font-semibold mt-1">
            Tic-tac-toe where a square costs a right answer. Miss, and your opponent gets one shot at it.
          </p>
          <Button className="w-full mt-3"
            onClick={async () => {
              const c = await createRoom(user.id, "trivia", uname, "squareoff", picked);
              if (c) nav(`/rooms/${c}`);
            }}>
            Create a Square Off room
          </Button>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-soft mb-2">
            Race — same puzzle, first correct answer takes the round
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="ghost" onClick={async () => {
              const c = await createRoom(user.id, "picto", uname, "race", picked);
              if (c) nav(`/rooms/${c}`);
            }}>
              Picto race
            </Button>
            <Button variant="ghost" onClick={async () => {
              const c = await createRoom(user.id, "trivia", uname, "race", picked);
              if (c) nav(`/rooms/${c}`);
            }}>
              Trivia race
            </Button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (joinCode.trim()) nav(`/rooms/${joinCode.trim().toUpperCase()}`); }}>
          <Field label="Join with a code">
            <div className="flex gap-2">
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123" maxLength={6} className="tracking-[0.3em] font-bold" />
              <Button type="submit" variant="ghost">Join</Button>
            </div>
          </Field>
        </form>
      </div>
    );
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!room) return <p className="text-sm text-soft">Finding room {code}…</p>;

  const iAmIn = players.some((p) => p.user_id === user.id);
  const isHost = room.host_id === user.id;
  const won = round?.winner_id;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-soft">Room code</p>
          <p className="text-3xl font-bold tracking-[0.3em]">{room.code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-soft uppercase tracking-widest">{room.status}</p>
          {!!room.categories?.length && (
            <p className="text-[11px] font-bold text-soft mt-0.5 max-w-[180px]">
              {room.categories.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {players.map((p) => (
          <span key={p.user_id} className="text-sm bg-surface border-[2.5px] border-ink rounded-full px-3 py-1.5">
            {p.username} <b className="text-picto tabular-nums ml-1">{p.score}</b>
          </span>
        ))}
        {players.length === 0 && <span className="text-sm text-soft">Nobody has joined yet</span>}
      </div>

      {!iAmIn && (
        <Button onClick={() => void join(user.email?.split("@")[0] ?? "player")}>Join this room</Button>
      )}

      {iAmIn && room.mode === "squareoff" && (
        <SquareOffRoom roomId={room.id} code={room.code} status={room.status}
          categories={room.categories} players={players} userId={user.id} isHost={isHost} />
      )}

      {room.mode !== "squareoff" && iAmIn && !round && isHost &&
        <Button onClick={() => void startNextRound()}>Start the match</Button>}
      {room.mode !== "squareoff" && iAmIn && !round && !isHost &&
        <p className="text-sm text-soft">Waiting for the host to start…</p>}

      {room.mode !== "squareoff" && round && currentPuzzle && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-soft">Round {round.round_no} of {room.best_of}</p>
          <Card className="aspect-square max-h-[44vh] mx-auto w-full grid place-items-center p-6 text-ink">
            {currentPuzzle.spec
              ? <PictoRenderer spec={currentPuzzle.spec} />
              : <p className="text-xl font-semibold text-center">{currentPuzzle.prompt}</p>}
          </Card>

          {!won && currentPuzzle.choices ? (
            // A trivia room previously rendered the same free-text box as picto,
            // so the four options were never shown and answers like "Minutes
            // played" were effectively untypeable. Round 2 of the first test
            // was unwinnable for exactly this reason.
            <div className="grid gap-2.5">
              {currentPuzzle.choices.map((opt, i) => (
                <button key={opt}
                  onClick={() => { if (opt === currentPuzzle.answer) void claimWin(); }}
                  className="piece press flex items-center gap-3 text-left px-4 py-4 bg-surface"
                  style={{ borderLeft: `4px solid ${["#EF5A2A","#4B5BD6","#FFC93C","#17914B"][i % 4]}` }}>
                  <span aria-hidden style={{ color: ["#EF5A2A","#4B5BD6","#FFC93C","#17914B"][i % 4] }}>
                    {["▲","◆","●","■"][i % 4]}
                  </span>
                  <span className="text-[15px] font-bold">{opt}</span>
                </button>
              ))}
            </div>
          ) : won ? (
            <div className="text-center">
              <p className={`text-sm font-bold ${won === user.id ? "text-good" : "text-bad"}`}>
                {won === user.id ? "You took it" : `${players.find((p) => p.user_id === won)?.username ?? "They"} took it`}
              </p>
              <p className="text-lg font-semibold mt-1">{currentPuzzle.answer}</p>
              {isHost && <Button className="mt-4 w-full" onClick={() => void startNextRound()}>Next round</Button>}
              {currentPuzzle.explanation && (
                <p className="text-sm text-soft font-semibold mt-3 text-left">{currentPuzzle.explanation}</p>
              )}
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (isCorrect(guess, currentPuzzle.answer)) { void claimWin(); setGuess(""); }
                else setGuess("");
              }}
            >
              <Input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Answer first to win the round" />
              <Button type="submit">Go</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
