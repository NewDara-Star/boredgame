import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRoom, useMyRooms, createRoom } from "./useRoom";
import { Card } from "@/shared/ui/Card";
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
import { BankTrouble } from "./BankTrouble";
import { PeerNotice } from "./matchUi";
import { AuthCard } from "@/features/profile/AuthCard";
import { GuestCard, ClaimCard } from "@/features/profile/GuestCard";
import { Avatar } from "@/shared/ui/Avatar";
import { Note, Dealing } from "@/shared/ui/Note";
import { GAMES } from "@/features/play/registry";
import { parseWith, roomSetup, roomWith } from "@/features/challenge/kinds";
import { useFocusMode } from "@/app/layout/focus";
import { markRoomPlayed } from "@/features/push/PushOnboarding";
import { useFriends } from "@/features/friends/useFriends";
import { RoomTop, CallPill } from "./RoomTop";
import { Countdown, RoomUnavailable, Waiting } from "./RoomScreens";
import { RaceRoom } from "./RaceRoom";
import { RoomsGuest, RoomsHome } from "./RoomsHome";

export function RoomsPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, profile, offline, isGuest, claimedAs } = useAuth();
  const [startError, setStartError] = useState<string | null>(null);
  /** set by "Play" on a friend when their invite didn't go through */
  const inviteFailed = (useLocation().state as { inviteFailed?: string } | null)?.inviteFailed ?? null;
  const uname = profile?.username ?? user?.email?.split("@")[0] ?? "player";

  const {
    room, players, present, round, currentPuzzle, error, categories, levels,
    join, startNextRound, claimRound, revealRound, setup, setReady, bankTrouble, retryBank, typing, sendTyping,
  } = useRoom(code, user?.id);
  const myRooms = useMyRooms(user?.id);

  // "Play a friend" on the Games sheet (#14) opens a room already set to that
  // game. Once, and only by the host, while the room is still waiting.
  // With Tic Tac Toe and Connect 4 it's set to the "Play it with" chosen there.
  const sent = useLocation().state as { preset?: string; with?: string } | null;
  const preset = sent?.preset ?? null, presetWith = parseWith(sent?.with);
  const presetDone = useRef(false);
  useEffect(() => {
    if (presetDone.current || !preset || !room || !user || room.status !== "waiting" || room.host_id !== user.id) return;
    const g = GAMES.find((x) => x.slug === preset);
    if (!g?.room) return;
    presetDone.current = true;
    if ((preset === "tictactoe" || preset === "connect4") && presetWith) {
      const r = roomSetup(preset, presetWith);
      void setup(r.mode, room.game, [], room.difficulty ?? [], r.challenge);
      return;
    }
    void setup(g.room.mode, g.bank ?? room.game, [], room.difficulty ?? [], g.room.challenge ?? room.challenge ?? "trivia");
  }, [preset, presetWith, room, user, setup]);

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

  // In a room with both of you there (the lobby and the games, drawings 36–42),
  // the room has the whole phone: its own top bar, no app header or tab bar.
  const iAmInRoom = !!room && !!user && players.some((p) => p.user_id === user.id);
  const together = iAmInRoom && !!room && !(room.status === "waiting" && players.length < room.capacity);
  useFocusMode(together && !!code);

  // #37: both ready, the game starting — a three-second count on both phones,
  // each from when it saw the room turn to playing.
  const [counting, setCounting] = useState(false);
  const lastStatus = useRef(room?.status);
  useEffect(() => {
    if (lastStatus.current === "waiting" && room?.status === "playing") setCounting(true);
    // Your first room game: from now on a ping means something (#5).
    if (room?.status === "playing") markRoomPlayed();
    lastStatus.current = room?.status;
  }, [room?.status]);

  const { friends, invite } = useFriends();
  const [invited, setInvited] = useState<string | null>(null);
  const newRoom = async () => {
    if (!user) { nav("/rooms"); return; }
    const c = await createRoom(user.id, uname);
    if (c) nav(`/rooms/${c.code}`);
  };

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
            <p className="text-[12px] font-black text-soft">
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
            <summary className="text-[13px] font-black text-soft
              underline underline-offset-4 cursor-pointer list-none text-center">
              I have an account
            </summary>
            <div className="mt-3"><AuthCard /></div>
          </details>
        </div>
      );
    }
    return <RoomsGuest />;
  }

  if (!code) return <RoomsHome myRooms={myRooms} />;

  if (!room) return error
    ? <RoomUnavailable room={null} players={[]} onNew={() => void newRoom()} />
    : <Dealing what={`room ${code}`} />;

  const iAmIn = iAmInRoom;
  const waiting = room.status === "waiting";

  // #43: full, or started without you. (Following a link into a waiting room
  // with a seat free joins you; that's the effect above.)
  if (!iAmIn) {
    if (!waiting || players.length >= room.capacity)
      return <RoomUnavailable room={room} players={players} onNew={() => void newRoom()} />;
    return <div className="space-y-3"><Dealing what={`room ${code}`} /><Note>{error}</Note></div>;
  }

  const other = players.find((p) => p.user_id !== user.id) ?? null;
  const notes = (
    <>
      <Note>{error !== bankTrouble ? error ?? startError : startError}</Note>
      <PeerNotice players={players} present={present} userId={user.id} waiting={waiting} />
    </>
  );
  const call = other
    ? <CallPill roomId={room.id} code={room.code} peerId={other.user_id} peerName={other.username} />
    : null;
  const top = <><RoomTop code={room.code} end={call} />{notes}</>;

  // #35: on your own, waiting for someone.
  if (waiting && players.length < room.capacity) {
    return (
      <div className="space-y-3">
        {notes}
        <Waiting room={room} me={players.find((p) => p.user_id === user.id) ?? null}
          friends={friends.map((f) => ({ id: f.id, username: f.username }))}
          onInvite={(id, name) => void invite(room.id, id).then((ok) => setInvited(ok ? null : name))}
          inviteFailed={invited ?? inviteFailed} />
        {(isGuest || claimedAs) && <ClaimCard />}
      </div>
    );
  }

  // #36: both in, choosing together.
  if (waiting) {
    return (
      <div className="space-y-3">
        {top}
        <BankTrouble message={bankTrouble} onRetry={retryBank} />
        <Lobby room={room} players={players} categories={categories} levels={levels}
          userId={user.id}
          alone={players.length < room.capacity}
          onSetup={(m, g, c, d, ch) => void setup(m, g, c, d, ch)}
          onReady={(r) => void setReady(r)} />
        {(isGuest || claimedAs) && <ClaimCard />}
      </div>
    );
  }

  if (counting) return <Countdown room={room} players={players} userId={user.id} onDone={() => setCounting(false)} />;

  if (room.mode === "squareoff") return (
    <SquareOffRoom top={top} roomId={room.id} code={room.code} status={room.status}
      categories={room.categories} difficulty={room.difficulty}
      challenge={roomWith(room.mode, room.challenge)} players={players} userId={user.id} />
  );
  if (room.mode === "tictactoe") return (
    <TicTacToeRoom top={top} roomId={room.id} code={room.code} status={room.status}
      players={players} userId={user.id} />
  );
  if (board === "sort") return (
    <SortRaceRoom top={top} topWith={(end) => <><RoomTop code={room.code} end={end} />{notes}</>} roomId={room.id} code={room.code} status={room.status}
      players={players} userId={user.id} />
  );
  if (board === "mem") return (
    <MemoryRoom top={top} roomId={room.id} code={room.code} status={room.status}
      players={players} userId={user.id} />
  );
  if (board === "c4") return (
    <Connect4Room top={top} roomId={room.id} code={room.code} status={room.status}
      categories={room.categories} difficulty={room.difficulty}
      challenge={roomWith(room.mode, room.challenge)} players={players} userId={user.id}
      plain={room.mode === "connect4"} />
  );

  // The races (Trivia, Picto): #40.
  return (
    <RaceRoom top={(end) => <><RoomTop code={room.code} end={end ?? call} />{notes}<BankTrouble message={bankTrouble} onRetry={retryBank} /></>}
      room={room} players={players} userId={user.id} isHost={isHost}
      round={round} puzzle={currentPuzzle}
      claimRound={claimRound} revealRound={revealRound} startNextRound={startNextRound}
      typing={typing} sendTyping={sendTyping} />
  );
}
