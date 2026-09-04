import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRoom, createRoom } from "./useRoom";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Field, Input } from "@/shared/ui/Field";
import { isCorrect } from "@/shared/lib/normalise";

export function RoomsPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, offline } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [guess, setGuess] = useState("");

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
        <p className="text-sm text-soft">Same puzzle, two players, first correct answer takes the round.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={async () => { const c = await createRoom(user.id, "picto"); if (c) nav(`/rooms/${c}`); }}>
            Create a Picto room
          </Button>
          <Button variant="ghost" onClick={async () => { const c = await createRoom(user.id, "trivia"); if (c) nav(`/rooms/${c}`); }}>
            Create a Trivia room
          </Button>
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
        <p className="text-xs text-soft uppercase tracking-widest">{room.status}</p>
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

      {iAmIn && !round && isHost && <Button onClick={() => void startNextRound()}>Start the match</Button>}
      {iAmIn && !round && !isHost && <p className="text-sm text-soft">Waiting for the host to start…</p>}

      {round && currentPuzzle && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-soft">Round {round.round_no} of {room.best_of}</p>
          <Card className="aspect-square max-h-[44vh] mx-auto w-full grid place-items-center p-6 text-ink">
            {currentPuzzle.spec
              ? <PictoRenderer spec={currentPuzzle.spec} />
              : <p className="text-xl font-semibold text-center">{currentPuzzle.prompt}</p>}
          </Card>

          {won ? (
            <div className="text-center">
              <p className={`text-sm font-bold ${won === user.id ? "text-good" : "text-bad"}`}>
                {won === user.id ? "You took it" : `${players.find((p) => p.user_id === won)?.username ?? "They"} took it`}
              </p>
              <p className="text-lg font-semibold mt-1">{currentPuzzle.answer}</p>
              {isHost && <Button className="mt-4 w-full" onClick={() => void startNextRound()}>Next round</Button>}
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
