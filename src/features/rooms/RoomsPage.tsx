import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRoom, useMyRooms, createRoom } from "./useRoom";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Field, Input } from "@/shared/ui/Field";
import { SquareOffRoom } from "@/features/squareoff/SquareOffRoom";
import { startSquareOff } from "@/features/squareoff/useTttRoom";
import { TicTacToeRoom } from "@/features/tictactoe/TicTacToeRoom";
import { Connect4Room } from "@/features/connect4/Connect4Room";
import { startConnect4 } from "@/features/connect4/useC4Room";
import { MemoryRoom } from "@/features/memory/MemoryRoom";
import { startMemory } from "@/features/memory/useMemoryRoom";
import { SortRaceRoom } from "@/features/sort/SortRaceRoom";
import { startSortRace } from "@/features/sort/useSortRoom";
import { Lobby } from "./Lobby";
import { InviteCard } from "./InviteCard";
import { PeerNotice } from "./matchUi";
import { VoiceControl } from "@/features/voice/VoiceControl";
import { AuthCard } from "@/features/profile/AuthCard";
import { GuestCard, ClaimCard } from "@/features/profile/GuestCard";
import { Avatar } from "@/shared/ui/Avatar";
import { Note, Dealing } from "@/shared/ui/Note";
import { ROOM_GAMES } from "@/features/play/registry";
import { FriendsPanel } from "@/features/friends/Friends";

export function RoomsPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, profile, offline, isGuest } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [guess, setGuess] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const uname = profile?.username ?? user?.email?.split("@")[0] ?? "player";

  const {
    room, players, present, round, currentPuzzle, error, categories, levels,
    join, startNextRound, claimRound, setup, setReady, leave,
  } = useRoom(code, user?.id);
  const myRooms = useMyRooms(user?.id);

  // Race deals a puzzle a round and scores in room_players. The board games own
  // their own row and their own writer, so everything the race UI does below is
  // gated on this one flag rather than on a growing list of mode names.
  const BOARDS = {
    squareoff: "3x3", tictactoe: "3x3", connect4: "c4", connect4trivia: "c4",
    memory: "mem", ballsort: "sort",
  } as const;
  const board = room ? BOARDS[room.mode as keyof typeof BOARDS] ?? null : null;

  const isHost = !!room && !!user && room.host_id === user.id;
  const everyoneReady = !!room && players.length === room.capacity && players.every((p) => p.ready);

  // Following an invite IS the intent to join, so do not make them find a
  // button for it after signing in. join_room refuses a full or started room,
  // and that refusal now has somewhere to show.
  useEffect(() => {
    if (!user || !room || !code) return;
    if (room.status !== "waiting") return;
    if (players.some((pl) => pl.user_id === user.id)) return;
    if (players.length >= room.capacity) return;
    void join(uname);
  }, [user, room, code, players, uname, join]);

  // One writer: the host turns agreement into a started game. Both clients see
  // the same ready flags, so letting either start would race to deal twice.
  //
  // Deal only on the RISING edge of everyoneReady. reopen_room ("Play something
  // else") resets status and both ready flags in one transaction, but the
  // client receives those as SEPARATE realtime events. When status→waiting
  // arrived while `players` still held the stale ready=true from the finished
  // game, this fired and re-dealt the same game before the ready→false events
  // landed — so "Play something else" restarted the game instead of opening the
  // lobby. A rising edge is a real ready-up in the lobby; the stale window,
  // where everyoneReady was already true, is not one.
  const wasReady = useRef(false);
  useEffect(() => {
    const rising = everyoneReady && !wasReady.current;
    wasReady.current = everyoneReady;
    if (!room || !isHost || !rising || room.status !== "waiting") return;
    if (!board) { void startNextRound(); return; }
    const guest = players.find((p) => p.user_id !== room.host_id);
    if (!guest) return;
    const start = board === "c4" ? startConnect4
      : board === "mem" ? startMemory
      : board === "sort" ? startSortRace
      : startSquareOff;
    void start(room.id, room.host_id, guest.user_id)
      .then((msg) => { if (msg) setStartError(msg); });
  }, [room, isHost, everyoneReady, players, startNextRound, board]);

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
    // Arriving on a room link signed out used to be a dead end: one sentence
    // pointing at another tab, with the code nowhere on screen. Someone shared a
    // link and their friend had to read the code out of the URL by hand.
    if (code) {
      return (
        <div className="space-y-4">
          <div>
            <p className="text-[12px] font-black uppercase tracking-widest text-soft">
              You've been invited
            </p>
            <h1 className="font-display text-[30px] leading-none font-semibold mt-1">
              Room {code.toUpperCase()}
            </h1>
            {players.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-2.5">
                  {players.map((p) => (
                    <Avatar key={p.user_id} id={p.user_id} name={p.username} size={30} />
                  ))}
                </div>
                <p className="text-[13px] font-bold text-soft">
                  {players.map((p) => p.username).join(" and ")} {players.length === 1 ? "is" : "are"} waiting
                </p>
              </div>
            )}
          </div>
          <GuestCard note="Type a name and you're in the room. No password." />
          <details className="group">
            <summary className="text-[13px] font-black uppercase tracking-wider text-soft
              underline underline-offset-4 cursor-pointer list-none text-center">
              I have an account
            </summary>
            <div className="mt-3"><AuthCard /></div>
          </details>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h1 className="font-display text-[30px] leading-none font-semibold">Head-to-head</h1>
        <p className="text-sm text-soft font-semibold">
          A room needs to tell you two apart. A name is enough for that.
        </p>
        <GuestCard />
        <details>
          <summary className="text-[13px] font-black uppercase tracking-wider text-soft
            underline underline-offset-4 cursor-pointer list-none text-center">
            I have an account
          </summary>
          <div className="mt-3"><AuthCard /></div>
        </details>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[32px] leading-none font-semibold">Head-to-head</h1>
        <p className="text-sm text-soft font-semibold">
          Play someone you've added with one tap, or make a room and send the code.
        </p>

        <FriendsPanel />

        {myRooms.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-widest text-soft">Rooms you're in</p>
            {myRooms.map((r) => (
              <button key={r.id} onClick={() => nav(`/rooms/${r.code}`)}
                className="piece press w-full flex items-center justify-between px-4 py-3.5 bg-surface text-left">
                <span className="font-display text-lg font-semibold tracking-[0.2em]">{r.code}</span>
                <span className="text-[12px] font-black uppercase tracking-wider text-soft">
                  {r.status === "playing" ? "in progress" : "waiting"} · rejoin →
                </span>
              </button>
            ))}
          </div>
        )}

        <Button className="w-full"
          onClick={async () => { const c = await createRoom(user.id, uname); if (c) nav(`/rooms/${c.code}`); }}>
          Create a room
        </Button>

        <form onSubmit={(e) => { e.preventDefault(); if (joinCode.trim()) nav(`/rooms/${joinCode.trim().toUpperCase()}`); }}>
          <Field label="Or join with a code">
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

  if (!room) return (
    <div className="space-y-3">
      <Dealing what={`room ${code}`} />
      <Note>{error}</Note>
    </div>
  );

  const iAmIn = players.some((p) => p.user_id === user.id);
  const waiting = room.status === "waiting";
  const won = round?.winner_id;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-semibold">
          {waiting ? "Your room" : (ROOM_GAMES.find((g) => g.room.mode === room.mode
            && (g.bank === null || g.bank === room.game))?.name ?? "Race")}
        </p>
        <p className="text-xs text-soft uppercase tracking-widest font-bold">{room.status}</p>
      </div>

      <Note>{error ?? startError}</Note>

      {iAmIn && <PeerNotice players={players} present={present} userId={user.id} waiting={waiting} />}

      {iAmIn && (() => {
        const other = players.find((pl) => pl.user_id !== user.id);
        return other
          ? <VoiceControl roomId={room.id} userId={user.id} peerId={other.user_id} peerName={other.username} />
          : null;
      })()}

      {!iAmIn && (
        <div className="space-y-2">
          <Button className="w-full" onClick={() => void join(uname)}>Join this room</Button>
          {players.length >= room.capacity && (
            <p className="text-[13px] font-bold text-soft text-center">
              This one looks full — {players.map((p) => p.username).join(" and ")} are already in it.
            </p>
          )}
        </div>
      )}

      {iAmIn && waiting && players.length < room.capacity && <InviteCard code={room.code} waiting />}

      {iAmIn && waiting && (
        <Lobby room={room} players={players} categories={categories} levels={levels}
          userId={user.id}
          alone={players.length < room.capacity}
          onSetup={(m, g, c, d, ch) => void setup(m, g, c, d, ch)}
          onReady={(r) => void setReady(r)} />
      )}

      {iAmIn && !waiting && room.mode === "squareoff" && (
        <SquareOffRoom roomId={room.id} code={room.code} status={room.status}
          categories={room.categories} difficulty={room.difficulty}
          challenge={room.challenge} players={players} userId={user.id} />
      )}

      {iAmIn && !waiting && room.mode === "tictactoe" && (
        <TicTacToeRoom roomId={room.id} code={room.code} status={room.status}
          players={players} userId={user.id} />
      )}

      {iAmIn && !waiting && board === "sort" && (
        <SortRaceRoom roomId={room.id} code={room.code} status={room.status}
          players={players} userId={user.id} />
      )}

      {iAmIn && !waiting && board === "mem" && (
        <MemoryRoom roomId={room.id} code={room.code} status={room.status}
          players={players} userId={user.id} />
      )}

      {iAmIn && !waiting && board === "c4" && (
        <Connect4Room roomId={room.id} code={room.code} status={room.status}
          categories={room.categories} difficulty={room.difficulty}
          challenge={room.challenge} players={players} userId={user.id}
          plain={room.mode === "connect4"} />
      )}

      {iAmIn && isGuest && (waiting || room.status === "finished") && <ClaimCard />}

      {iAmIn && (
        <button onClick={async () => { await leave(); nav("/rooms"); }}
          className="block mx-auto text-[13px] font-black uppercase tracking-wider
            text-soft underline underline-offset-4 pt-2">
          Leave this room
        </button>
      )}

      {!board && room.status === "finished" && (() => {
        const ranked = [...players].sort((a, b) => b.score - a.score);
        const drawn = ranked.length > 1 && ranked[0].score === ranked[1].score;
        return (
          <div className={`piece p-6 text-center ${drawn ? "bg-sand" : "bg-good text-surface"}`}>
            <p className="text-[12px] font-black uppercase tracking-widest opacity-70">Match over</p>
            <p className="font-display text-3xl font-semibold mt-1">
              {drawn ? "All square" : `${ranked[0]?.username ?? "Nobody"} takes it`}
            </p>
            <p className="font-display text-5xl font-semibold tabular-nums mt-3">
              {ranked.map((p) => p.score).join(" — ")}
            </p>
            <button onClick={async () => { await leave(); nav("/rooms"); }}
              className="piece press w-full mt-5 py-3.5 font-display text-lg font-semibold bg-surface text-ink">
              New room
            </button>
          </div>
        );
      })()}

      {!board && !waiting && room.status !== "finished" && round && currentPuzzle && (
        <>
          <div className="flex gap-2 flex-wrap">
            {players.map((p) => (
              <span key={p.user_id} className="piece text-sm px-3 py-1.5">
                {p.username} <b className="text-picto tabular-nums ml-1">{p.score}</b>
              </span>
            ))}
          </div>
          <p className="text-[12px] uppercase tracking-widest text-soft font-black">
            Round {round.round_no} of {room.best_of}
          </p>
          <Card className="aspect-square max-h-[44vh] mx-auto w-full grid place-items-center p-6 text-ink">
            {currentPuzzle.spec
              ? <PictoRenderer spec={currentPuzzle.spec} />
              : <p className="text-xl font-semibold text-center">{currentPuzzle.prompt}</p>}
          </Card>

          {!won && currentPuzzle.choices ? (
            <div className="grid gap-2.5">
              {currentPuzzle.choices.map((opt, i) => (
                <button key={opt}
                  onClick={() => void claimRound(opt)}
                  className="piece press flex items-center gap-3 text-left px-4 py-4 bg-surface">
                  <span aria-hidden style={{ color: ["#FF5A1F","#2B4BFF","#FFD028","#10A04E"][i % 4] }}>
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
              {currentPuzzle.explanation && (
                <p className="text-sm text-soft font-semibold mt-3 text-left">{currentPuzzle.explanation}</p>
              )}
              {isHost && (
                <Button className="mt-4 w-full" onClick={() => void startNextRound()}>
                  {round.round_no >= room.best_of ? "See the result" : "Next round"}
                </Button>
              )}
            </div>
          ) : (
            <form className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void claimRound(guess);
                setGuess("");
              }}>
              <Input value={guess} onChange={(e) => setGuess(e.target.value)}
                placeholder="Answer first to win the round" />
              <Button type="submit">Go</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
