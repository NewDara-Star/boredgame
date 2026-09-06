import { useVoice } from "./useVoice";

/** A compact voice-call bar for a room. Shown once both players are in. The
    audio element is always mounted (hidden) so remote audio has somewhere to
    play the instant a track arrives. */
export function VoiceControl({ roomId, userId, peerId, peerName }: {
  roomId: number; userId: string; peerId: string; peerName: string;
}) {
  const { state, muted, start, hangup, toggleMute, audioRef } = useVoice(roomId, userId, peerId);

  return (
    <div className="piece bg-surface p-2.5 flex items-center gap-2">
      <audio ref={audioRef} autoPlay playsInline hidden />

      {state === "idle" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">Talk while you play</span>
          <button onClick={() => void start()}
            className="piece press bg-ink text-paper px-4 min-h-[40px] inline-flex items-center font-display font-semibold text-[14px]">
            Voice call
          </button>
        </>
      )}

      {state === "connecting" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">
            Connecting… waiting for {peerName}
          </span>
          <button onClick={hangup}
            className="text-[12px] font-black uppercase tracking-wider text-ink/50 px-3 py-2">
            Cancel
          </button>
        </>
      )}

      {state === "live" && (
        <>
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">
            On call with {peerName}
          </span>
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
          <span className="min-w-0 flex-1 text-[13px] font-bold truncate">
            Couldn't start — allow microphone access.
          </span>
          <button onClick={() => void start()}
            className="text-[12px] font-black uppercase tracking-wider text-ink/60 px-3 py-2">
            Retry
          </button>
        </>
      )}
    </div>
  );
}
