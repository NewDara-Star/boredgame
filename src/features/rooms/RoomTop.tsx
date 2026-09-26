import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useVoiceCall } from "@/features/voice/VoiceProvider";
import { troubleText } from "@/features/voice/useVoice";

/** "D97RFU" as the drawings write it, two groups of three: "D97 RFU". */
export const spaced = (code: string) => code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

/**
 * A room's top bar (drawings 36–41): back to Rooms on the left, the code in
 * the middle, and on the right the call (or whatever the screen puts there: a
 * round count, a clock). The app's own header and tab bar step aside in a room.
 */
export function RoomTop({ code, end, label }: {
  code?: string;
  /** the right-hand end: the Call pill, "Round 2 of 5", a clock */
  end?: ReactNode;
  /** #35: the words in the middle while you wait, instead of the code */
  label?: string;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-2.5 min-h-10">
      <Link to="/rooms" aria-label="Back to Rooms" className="shrink-0 grid place-items-center w-11 h-11 -m-[3px]">
        <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-board shadow-lift-sm">
          <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
            <path d="M10 2L4 8l6 6" fill="none" stroke="var(--color-ink-day)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
      {label
        ? <span className="text-[12px] font-extrabold">{label}</span>
        : code && <CodePill code={code} />}
      <span className="shrink-0 min-w-[38px] flex justify-end">{end}</span>
    </div>
  );
}

/** .code.sm: the room code, white, mono. Tap to copy it. */
function CodePill({ code }: { code: string }) {
  const [said, setSaid] = useState(false);
  return (
    <button aria-label={`Room code ${code}. Copy it`}
      onClick={async () => { try { await navigator.clipboard.writeText(code); setSaid(true); setTimeout(() => setSaid(false), 1400); } catch { /* select it instead */ } }}
      className="card tap rounded-[14px] bg-board px-3 py-1.5 font-mono text-[16px] font-bold tracking-[.06em] text-ink min-h-[36px]">
      {said ? "Copied" : spaced(code)}
    </button>
  );
}

/** The mic in the .voice pill. */
const Mic = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
    <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="var(--color-ink-day)" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="var(--color-ink-day)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * .voice: the call as a pill in the top bar. "Call" to start, "On call" while
 * it's up; tapping it while on a call opens Mute and Leave under the bar. The
 * old card with its buttons took a row of the phone for the whole game.
 */
export function CallPill({ roomId, code, peerId, peerName }: {
  roomId: number; code: string; peerId: string; peerName: string;
}) {
  const { state, trouble, blocked, hear, muted, target, start, hangup, toggleMute } = useVoiceCall();
  const [open, setOpen] = useState(false);
  const active = !!target && target.roomId === roomId;
  // a call up for another room is the floating bar's, not this pill's
  if (target && !active) return null;
  const pill = "card tap inline-flex items-center gap-[5px] rounded-full px-[11px] py-1.5 text-[13px] font-extrabold text-ink min-h-[36px]";
  if (!active) {
    return (
      <button onClick={() => start({ roomId, code, peerId, peerName })} className={`${pill} bg-leaf`}>
        <Mic />Call
      </button>
    );
  }
  if (state === "error") {
    return (
      <button onClick={() => start({ roomId, code, peerId, peerName })} aria-label={`${troubleText(trouble, peerName)} Try again`}
        className={`${pill} bg-ember-hi`}>
        <Mic />Try again
      </button>
    );
  }
  if (state === "live" && blocked) {
    return <button onClick={hear} className={`${pill} bg-leaf-hi`}><Mic />Tap to hear</button>;
  }
  return (
    <span className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`${pill} ${state === "live" ? (muted ? "bg-ember-hi" : "bg-leaf") : "bg-leaf-hi"}`}>
        <Mic />{state === "live" ? (muted ? "Muted" : "On call") : "Calling…"}
      </button>
      {open && (
        <span className="card absolute right-0 top-[calc(100%+6px)] z-30 flex gap-1.5 rounded-2xl bg-board p-1.5 shadow-lift">
          {state === "live" && (
            <button onClick={() => { toggleMute(); setOpen(false); }}
              className="tap rounded-full bg-mist px-3 min-h-[40px] text-[13px] font-extrabold text-ink">
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
          <button onClick={() => { hangup(); setOpen(false); }}
            className="tap rounded-full bg-ink-day px-3 min-h-[40px] text-[13px] font-extrabold text-board">
            {state === "live" ? "Leave call" : "Cancel"}
          </button>
        </span>
      )}
    </span>
  );
}
