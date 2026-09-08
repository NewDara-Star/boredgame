import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import { RTC, type CallTarget, type Sig, type SigBody, type VoiceState } from "./useVoice";

/**
 * A room voice call that outlives the room screen.
 *
 * The call used to live inside the room component, so navigating to Home ended
 * it and dropped the mic. It lives here now, above the routes, so it keeps
 * running while you move around the app; a floating bar (rendered below) is how
 * you get back to the room or hang up from anywhere. Teardown happens only when
 * this provider unmounts -- i.e. the tab closes.
 *
 * WebRTC audio, peer to peer, signalled over a dedicated `voice:<room>` realtime
 * channel. STUN only. The smaller user id offers, the other answers, so there is
 * no glare; audio is negotiated once.
 */
interface VoiceCtx {
  state: VoiceState;
  muted: boolean;
  target: CallTarget | null;
  start: (t: CallTarget) => void;
  hangup: () => void;
  toggleMute: () => void;
}
const Ctx = createContext<VoiceCtx | null>(null);

export function useVoiceCall(): VoiceCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useVoiceCall must be used inside <VoiceProvider>");
  return c;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const [state, setState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [target, setTarget] = useState<CallTarget | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteSet = useRef(false);
  const offered = useRef(false);
  const sawPeer = useRef(false);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* already closed */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    if (chanRef.current && supabase) void supabase.removeChannel(chanRef.current);
    chanRef.current = null;
    pendingIce.current = [];
    remoteSet.current = false;
    offered.current = false;
    sawPeer.current = false;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const hangup = useCallback(() => {
    cleanup();
    setState("idle");
    setMuted(false);
    setTarget(null);
  }, [cleanup]);

  const start = useCallback((t: CallTarget) => {
    if (!supabase || !user) return;
    if (state !== "idle" && state !== "error") return;
    setTarget(t);
    setState("connecting");
    (async () => {
      try {
        const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localRef.current = local;

        const chan = supabase!.channel(`voice:${t.roomId}`, {
          config: { presence: { key: user.id }, broadcast: { self: false } },
        });
        chanRef.current = chan;
        const send = (s: SigBody) =>
          void chan.send({ type: "broadcast", event: "sig", payload: { from: user.id, ...s } });

        const pc = new RTCPeerConnection(RTC);
        pcRef.current = pc;
        local.getTracks().forEach((tr) => pc.addTrack(tr, local));

        pc.ontrack = (e) => {
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            void audioRef.current.play().catch(() => { /* a tap will start it */ });
          }
        };
        pc.onicecandidate = (e) => { if (e.candidate) send({ kind: "ice", candidate: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => {
          const cs = pc.connectionState;
          if (cs === "connected") setState("live");
          // The peer hung up or dropped for good -> end the call cleanly rather
          // than sitting "live" on dead audio. "disconnected" can be a blip, so
          // it is left to recover.
          else if (cs === "failed" || cs === "closed") hangup();
        };

        const initiator = user.id < t.peerId;
        const makeOffer = async () => {
          if (offered.current || !initiator) return;
          offered.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ kind: "desc", desc: offer });
        };
        const flushIce = async () => {
          for (const c of pendingIce.current) { try { await pc.addIceCandidate(c); } catch { /* stale */ } }
          pendingIce.current = [];
        };

        chan.on("broadcast", { event: "sig" }, async ({ payload }) => {
          const msg = payload as Sig;
          if (msg.from === user.id) return;
          if (msg.kind === "desc") {
            if (msg.desc.type === "offer") {
              await pc.setRemoteDescription(msg.desc); remoteSet.current = true; await flushIce();
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              send({ kind: "desc", desc: answer });
            } else if (msg.desc.type === "answer") {
              await pc.setRemoteDescription(msg.desc); remoteSet.current = true; await flushIce();
            }
          } else {
            if (remoteSet.current) { try { await pc.addIceCandidate(msg.candidate); } catch { /* stale */ } }
            else pendingIce.current.push(msg.candidate);
          }
        });

        chan.on("presence", { event: "sync" }, () => {
          const st = chan.presenceState<{ user_id?: string }>();
          let peerPresent = false;
          for (const k in st) for (const m of st[k]) if (m.user_id && m.user_id !== user.id) peerPresent = true;
          if (peerPresent) { sawPeer.current = true; void makeOffer(); }
          // They were here and left the call -> end it.
          else if (sawPeer.current) hangup();
        });

        chan.subscribe((status) => { if (status === "SUBSCRIBED") void chan.track({ user_id: user.id }); });
      } catch {
        cleanup();
        setState("error");
      }
    })();
  }, [user, state, cleanup, hangup]);

  const toggleMute = useCallback(() => {
    const local = localRef.current;
    if (!local) return;
    setMuted((m) => {
      const next = !m;
      local.getAudioTracks().forEach((tr) => (tr.enabled = !next));
      return next;
    });
  }, []);

  // Only fires when the whole app unmounts (tab close) -- navigation does not
  // reach this, which is the entire point.
  useEffect(() => () => cleanup(), [cleanup]);

  // The floating bar shows whenever a call is up and you are NOT on that room's
  // screen (there the in-room control already shows). It routes you back.
  const onCallScreen = !!target && pathname === `/rooms/${target.code}`;
  const showBar = state !== "idle" && !!target && !onCallScreen;

  return (
    <Ctx.Provider value={{ state, muted, target, start, hangup, toggleMute }}>
      {children}
      <audio ref={audioRef} autoPlay playsInline hidden />
      {showBar && (
        <div className="fixed inset-x-0 z-40 flex justify-center px-3
          bottom-[calc(62px+env(safe-area-inset-bottom)+8px)] sm:bottom-4">
          <div className="piece bg-ink text-paper w-full max-w-md p-2 flex items-center gap-2">
            <button onClick={() => nav(`/rooms/${target!.code}`)}
              className="min-w-0 flex-1 text-left px-2 py-1">
              <span className="block text-[11px] font-black uppercase tracking-wider text-paper/50">
                {state === "live" ? "On call — tap to return" : "Connecting…"}
              </span>
              <span className="block text-[14px] font-bold truncate">{target!.peerName}</span>
            </button>
            <button onClick={toggleMute}
              className={`piece press px-3 min-h-[38px] inline-flex items-center font-display font-semibold text-[13px] ${
                muted ? "bg-bad text-surface" : "bg-acid text-ink"}`}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={hangup}
              className="piece press px-3 min-h-[38px] inline-flex items-center bg-hot text-paper font-display font-semibold text-[13px]">
              Leave
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
