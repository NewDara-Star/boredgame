import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GAMES } from "@/features/play/registry";
import { useVoiceCall } from "@/features/voice/VoiceProvider";
import { useFocused } from "@/app/layout/focus";
import { Avatar } from "@/shared/ui/Avatar";
import { useFriends } from "./useFriends";

/** Invites answered on this phone this session: the bar doesn't come back for them. */
const done = new Set<number>();

/**
 * #2, an invite wherever you are (Daramola 28 Sep: whoever asked shouldn't
 * feel ignored). The drawing's .toast: an ink bar with their disc, what they
 * want to play and the room, and Join. Hold on and Not now answer them; the
 * moment the bar shows, their waiting screen says you've seen it. On Home the
 * big card does this job; in the room it points to, there's nothing to say.
 * In a round it's only a small pill at the top ("Tobi's inviting you"), clear
 * of the X, the answers and the board; a tap opens the bar there.
 */
export function InviteToast() {
  const { invites, respond, answer } = useFriends();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const focused = useFocused();
  const call = useVoiceCall();
  const [, bump] = useState(0);
  // In a round: the pill, until you tap it open.
  const [open, setOpen] = useState<number | null>(null);
  const i = invites.find((x) => !done.has(x.id));
  const here = !!i && (pathname === "/" || pathname === `/rooms/${i.room_code}`);
  const show = !!i && !here;

  // Seen, once, the first time the bar is actually on screen.
  const told = useRef<number | null>(null);
  useEffect(() => {
    if (show && i && told.current !== i.id) { told.current = i.id; void answer(i.id, "seen"); }
  }, [show, i?.id, answer]);

  const close = (id: number) => { done.add(id); bump((n) => n + 1); };
  const game = i ? GAMES.find((g) => g.room?.mode === i.mode)?.name ?? "a game" : "";
  const code = i && i.room_code.length === 6 ? `${i.room_code.slice(0, 3)} ${i.room_code.slice(3)}` : i?.room_code;
  // The call bar sits where this would; stand above it.
  const callBar = call.state !== "idle" && !!call.target && pathname !== `/rooms/${call.target.code}`;

  if (show && i && focused && open !== i.id) {
    return (
      <motion.div key={`pill-${i.id}`} role="status" aria-live="polite" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="fixed inset-x-0 z-40 flex justify-center pointer-events-none top-[calc(2px+env(safe-area-inset-top))]">
        <button onClick={() => setOpen(i.id)} aria-label={`${i.from_name} is inviting you to ${game}. Open`}
          className="pointer-events-auto min-h-[44px] grid place-items-center">
          <span className="flex items-center gap-1.5 rounded-full bg-ink-day text-board shadow-lift pl-1 pr-3 py-1">
            <Avatar id={i.from_id} name={i.from_name} size={22} />
            <span className="text-[13px] font-extrabold whitespace-nowrap">{i.from_name}'s inviting you</span>
          </span>
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {show && i && (
        <motion.div key={i.id} role="status" aria-live="polite"
          initial={{ y: focused ? -40 : 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: focused ? -40 : 40, opacity: 0 }}
          className={`fixed inset-x-0 z-40 flex justify-center px-[14px] ${focused
            ? "top-[calc(6px+env(safe-area-inset-top))]"
            : callBar ? "bottom-[calc(62px+env(safe-area-inset-bottom)+80px)]" : "bottom-[calc(62px+env(safe-area-inset-bottom)+10px)]"}`}>
          <div className="w-full max-w-md rounded-[18px] bg-ink-day text-board shadow-lift px-3 py-2.5 grid gap-1.5">
            <div className="flex items-center gap-2.5">
              {!focused && <Avatar id={i.from_id} name={i.from_name} size={34} />}
              <div className="min-w-0 flex-1">
                <b className="block text-[14px] leading-tight truncate">{i.from_name} wants to play {game}</b>
                {!focused && <small className="block text-[12px] font-bold text-board/75">Room <span className="font-mono">{code}</span></small>}
              </div>
              <button onClick={() => { close(i.id); void respond(i.id, true).then(() => nav(`/rooms/${i.room_code}`)); }}
                className="cut tap cut-leaf shrink-0 min-h-[42px] px-3 font-display text-[16px]"
                style={{ boxShadow: "inset 0 5px 0 var(--h), inset 5px 0 0 var(--h), inset -5px 0 0 var(--l), inset 0 -6px 0 var(--d)" }}>
                Join
              </button>
            </div>
            <div className={`flex gap-4 ${focused ? "" : "pl-[44px]"}`}>
              <button onClick={() => { close(i.id); void answer(i.id, "hold"); }}
                className="min-h-[44px] -my-2 text-[13px] font-extrabold text-board underline underline-offset-4">Hold on</button>
              <button onClick={() => { close(i.id); void answer(i.id, "no"); }}
                className="min-h-[44px] -my-2 text-[13px] font-extrabold text-board/75 underline underline-offset-4">Not now</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
