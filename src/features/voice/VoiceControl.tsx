import { useVoiceCall } from "./VoiceProvider";

/** The in-room voice control. It no longer owns the call -- it drives the shared
    one in VoiceProvider, so leaving the room screen keeps it running (the
    floating bar takes over) instead of dropping it. Shown once both players are
    in the room. */
export function VoiceControl({ roomId, code, peerId, peerName }: {
  roomId: number; code: string; peerId: string; peerName: string;
}) {
  const { state, muted, target, start, hangup, toggleMute } = useVoiceCall();
  const active = !!target && target.roomId === roomId;

  // A call is up for a different room -> the global bar owns it; show nothing here.
  if (target && !active) return null;

  if (!active) {
    return (
      <div className="piece bg-surface p-2.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[13px] font-bold truncate">Talk while you play</span>
        <button onClick={() => start({ roomId, code, peerId, peerName })}
          className="piece press bg-ink text-paper px-4 min-h-[40px] inline-flex items-center font-display font-semibold text-[14px]">
          Voice call
        </button>
      </div>
    );
  }

  return (
    <div className="piece bg-surface p-2.5 flex items-center gap-2">
      {state === "connecting" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">Connecting… waiting for {peerName}</span>
          <button onClick={hangup}
            className="text-[12px] font-black uppercase tracking-wider text-ink/50 px-3 py-2">Cancel</button>
        </>
      )}
      {state === "live" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">On call with {peerName}</span>
          <button onClick={toggleMute}
            className={`piece press px-3 min-h-[40px] inline-flex items-center font-display font-semibold text-[13px] ${
              muted ? "bg-bad text-surface" : "bg-acid"}`}>
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={hangup}
            className="piece press bg-ink text-paper px-3 min-h-[40px] inline-flex items-center font-display font-semibold text-[13px]">
            Leave
          </button>
        </>
      )}
      {state === "error" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">Couldn't start — allow microphone access.</span>
          <button onClick={() => start({ roomId, code, peerId, peerName })}
            className="text-[12px] font-black uppercase tracking-wider text-ink/60 px-3 py-2">Retry</button>
        </>
      )}
    </div>
  );
}
