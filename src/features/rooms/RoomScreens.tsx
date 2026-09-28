import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Room, RoomPlayer } from "@/shared/types/db";
import { Sunflower } from "@/shared/brand/Sunflower";
import { SEAT_RAMP } from "@/shared/brand/seats";
import { shareResult } from "@/shared/card/frame";
import { Seats } from "@/features/play/PlaySurface";
import { ROOM_GAMES } from "@/features/play/registry";
import { challengeName, roomWith } from "@/features/challenge/kinds";
import { RoomTop, spaced } from "./RoomTop";
import { useSentInvites } from "@/features/friends/useFriends";

type Mark = "x" | "o";

/** What the room is set to, in words and with its tile: "Tic Tac Toe · Cup toss". */
export function roomGame(room: Room): { slug: string; name: string } {
  const w = roomWith(room.mode, room.challenge);
  if (room.mode === "tictactoe" || room.mode === "squareoff")
    return { slug: "tictactoe", name: w === "none" ? "Tic Tac Toe" : `Tic Tac Toe · ${challengeName(w)}` };
  if (room.mode === "connect4" || room.mode === "connect4trivia")
    return { slug: "connect4", name: w === "none" ? "Connect 4" : `Connect 4 · ${challengeName(w)}` };
  if (room.mode === "memory") return { slug: "memory", name: "Memory Match" };
  if (room.mode === "ballsort") return { slug: "ballsort", name: "Ball Sort race" };
  return room.game === "picto" ? { slug: "picto", name: "Picto race" } : { slug: "trivia", name: "Trivia race" };
}

/** The host sits at x (crosses, gold), the guest at o (rings, blue): startBoard deals it so. */
export const markOf = (room: Room, userId: string): Mark => (room.host_id === userId ? "x" : "o");

/** .av: a disc with the first letter in the seat's colour. */
function Disc({ mark, name, size = 34 }: { mark: Mark; name: string; size?: number }) {
  const r = SEAT_RAMP[mark];
  return (
    <span aria-hidden className="shrink-0 grid place-items-center rounded-full font-display text-ink"
      style={{ width: size, height: size, fontSize: size * .43,
               background: `radial-gradient(circle at 35% 30%, ${r.hi}, ${r.base} 60%)`,
               border: "2.5px solid var(--color-ink-day)", boxShadow: "0 3px 0 var(--color-ink-day)" }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Both seats as the lobby and the count show them: "You · Ready", "Tobi · Deciding". */
export function RoomSeats({ room, players, userId, says }: {
  room: Room; players: RoomPlayer[]; userId: string;
  says: (p: RoomPlayer) => string;
}) {
  const seats = [...players].sort((a) => (a.user_id === room.host_id ? -1 : 1)).map((p) => ({
    mark: markOf(room, p.user_id), name: p.user_id === userId ? "You" : p.username,
    initial: p.username, count: says(p), active: false,
  }));
  return <Seats seats={seats} />;
}

/**
 * #35: waiting for someone. The code in two groups of three, your seat and the
 * empty one with the flower looking at it, and one button: send the invite.
 * The game is picked once they're in; this says which it's set to now.
 */
export function Waiting({ room, me, friends, onInvite, inviteFailed }: {
  room: Room; me: RoomPlayer | null;
  /** people you've added, for "Or invite Tobi or Mo directly" */
  friends: { id: string; username: string }[];
  onInvite: (id: string, name: string) => void;
  inviteFailed: string | null;
}) {
  const [said, setSaid] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const sent = useSentInvites(room.id);
  const game = roomGame(room);
  const Art = ROOM_GAMES.find((g) => g.slug === game.slug)?.Art;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const share = () => void shareResult({ text: `Come play me on BoredGame. Room code ${room.code}:`, url })
    .then((r) => { if (r === "copied") { setSaid("Link copied"); setTimeout(() => setSaid(null), 2200); } });
  const names = friends.slice(0, 2).map((f) => f.username);
  return (
    <div className="space-y-3">
      <RoomTop label="Your room" />
      <div className="card grid justify-items-center gap-2 text-center p-[18px] bg-board text-ink">
        <span className="text-[12px] font-extrabold text-soft">Room code</span>
        <button onClick={async () => { try { await navigator.clipboard.writeText(room.code); setSaid("Code copied"); setTimeout(() => setSaid(null), 1800); } catch { /* select it */ } }}
          aria-label={`Room code ${room.code}. Copy it`}
          className="w-full rounded-[14px] bg-mist py-2.5 font-mono text-[28px] font-bold tracking-[.08em]">
          {spaced(room.code)}
        </button>
        <div className="flex items-center gap-[18px] my-1.5">
          <Disc mark="x" name={me?.username ?? "?"} size={52} />
          <Sunflower state="look-right" stem={false} size={58} />
          <span aria-label="The empty seat" className="grid place-items-center w-[52px] h-[52px] rounded-full bg-board font-display text-[22px]"
            style={{ border: "2.5px dashed var(--color-ink-day)" }}>?</span>
        </div>
        <p className="text-[14px] font-semibold text-soft">Waiting for a second player</p>
        {/* What the people you asked have said (drawing 2, Daramola 28 Sep):
            nobody waits wondering whether they were ignored. */}
        {sent.slice(0, 2).map((r) => {
          const who = friends.find((f) => f.id === r.to_user)?.username ?? "They";
          const said = r.reply === "no" || r.status === "declined" ? `${who} can't play right now.`
            : r.reply === "hold" ? `${who} says hold on.`
            : r.status === "accepted" ? `${who}'s on the way.`
            : r.seen_at ? `${who} has seen it.` : `Asked ${who}.`;
          return <p key={r.id} role="status" className={`text-[14px] font-bold ${r.reply === "hold" || r.status === "accepted" ? "text-leaf-deep" : ""}`}>{said}</p>;
        })}
        <button onClick={share} className="cut tap cut-petal w-full min-h-[52px] font-display text-[19px]">
          {said ?? "Send the invite"}
        </button>
        {friends.length > 0 && (picking ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {friends.map((f) => (
              <button key={f.id} onClick={() => { onInvite(f.id, f.username); setPicking(false); }}
                className="min-h-[44px] -my-[7px] grid place-items-center">
                <span className="card rounded-full bg-board px-[11px] py-[5px] text-[13px] font-extrabold">{f.username}</span>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setPicking(true)} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
            Or invite {names.join(" or ")}{friends.length > 2 ? " or someone else" : ""} directly
          </button>
        ))}
        {inviteFailed && <p className="text-[13px] font-bold text-ember-deep">Couldn't invite {inviteFailed}. Send them the code instead.</p>}
      </div>
      <div className="card flex items-center gap-2.5 px-3 py-2.5 bg-board text-ink">
        {Art && <span className="shrink-0 w-11 h-11 grid place-items-center"><Art size={44} /></span>}
        <div className="min-w-0 flex-1">
          <b className="block text-[15px]">{game.name}</b>
          <small className="block text-[12px] font-semibold text-soft">You can change the game once they're in</small>
        </div>
      </div>
    </div>
  );
}

const SAYS: Record<string, (you: Mark, them: string) => string> = {
  tictactoe: (m, t) => (m === "x" ? `You're crosses. ${t}'s rings.` : `You're rings. ${t}'s crosses.`),
  connect4: (m, t) => (m === "x" ? `You're gold. ${t}'s blue.` : `You're blue. ${t}'s gold.`),
  memory: () => "Find a pair and you go again.",
  ballsort: () => "Same tubes. First to sort them wins.",
  trivia: () => "First right answer takes the round.",
  picto: () => "First right answer takes the round.",
};

/**
 * #37: both ready. Three seconds so nobody is caught looking away, the same on
 * both phones (each counts from when it saw the game start).
 */
export function Countdown({ room, players, userId, onDone }: {
  room: Room; players: RoomPlayer[]; userId: string; onDone: () => void;
}) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const n = 3 - Math.floor((Date.now() - t0) / 1000);
      if (n <= 0) { clearInterval(id); onDone(); } else setLeft(n);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const game = roomGame(room);
  const them = players.find((p) => p.user_id !== userId)?.username ?? "They";
  return (
    <div className="play-surface play-focus">
      <RoomTop code={room.code} />
      <div className="flex-1" />
      <div className="card grid justify-items-center gap-2 text-center p-[22px] bg-board text-ink" role="status" aria-live="assertive">
        <Sunflower state="awake" stem={false} size={80} />
        <span className="text-[12px] font-extrabold text-soft">{game.name}</span>
        <motion.b key={left} initial={{ scale: 1.25, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="font-display font-normal text-[80px] leading-none">{left}</motion.b>
        <p className="text-[14px] font-semibold text-soft">{SAYS[game.slug]?.(markOf(room, userId), them)}</p>
      </div>
      <div className="flex-1" />
      <RoomSeats room={room} players={players} userId={userId} says={() => "Ready"} />
    </div>
  );
}

/**
 * #43: the room's full or already playing. Say which, and offer your own room,
 * with the people in it named.
 */
export function RoomUnavailable({ room, players, onNew }: {
  room: Room | null; players: RoomPlayer[]; onNew: () => void;
}) {
  const names = players.map((p) => p.username);
  const playing = !!room && room.status !== "waiting";
  const head = !room ? "There's no room with that code"
    : playing ? "This room's already playing" : "This room's full";
  const sub = !room ? "Check the code, or start your own."
    : names.length >= 2 ? `${names[0]} and ${names[1]} ${playing ? "started without you" : "are in it"}. Start your own?`
    : "Start your own?";
  return (
    <div className="flex flex-col gap-3 min-h-[60dvh]">
      <RoomTop />
      <div className="flex-1" />
      <div className="card grid justify-items-center gap-2 text-center p-5 bg-board text-ink">
        <Sunflower state="bored" size={100} />
        <h3 className="font-display font-normal text-[22px] leading-[1.1]">{head}</h3>
        <p className="text-[14px] font-semibold text-soft">{sub}</p>
        <button onClick={onNew} className="cut tap cut-petal w-full min-h-[52px] font-display text-[19px]">New room</button>
      </div>
      <div className="flex-1" />
      <Link to="/rooms" className="text-center text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px]">Back to Rooms</Link>
    </div>
  );
}
