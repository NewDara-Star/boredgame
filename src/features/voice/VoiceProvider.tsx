import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import { routeFor, troubleText, type CallTarget, type Sig, type SigBody, type VoiceState, type VoiceTrouble } from "./useVoice";

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
 * channel. Direct first, with Cloudflare's relay (TURN) when direct is blocked,
 * as on mobile data (voice-ice, talk item 17). The smaller user id offers, the
 * other answers, so there is no glare; audio is negotiated once.
 */
interface VoiceCtx {
  state: VoiceState;
  /** Why the call is in "error"; null otherwise. */
  trouble: VoiceTrouble | null;
  /** The phone refused to play their voice until a tap (iPhone, V3). */
  blocked: boolean;
  /** Call from a tap: starts their audio when the phone held it back. */
  hear: () => void;
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
  const [trouble, setTrouble] = useState<VoiceTrouble | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [target, setTarget] = useState<CallTarget | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteSet = useRef(false);
  const offered = useRef(false);
  const sawPeer = useRef(false);
  const wentLive = useRef(false);
  // Which call attempt is current. A mic prompt answered after Cancel, or an
  // event from a torn-down call, must not act on the next one.
  const run = useRef(0);

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
    wentLive.current = false;
    setBlocked(false);
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const hangup = useCallback(() => {
    run.current++;
    cleanup();
    setState("idle");
    setMuted(false);
    setTrouble(null);
    setTarget(null);
  }, [cleanup]);

  // The call failed: release the mic and say why. The target stays, so the
  // room's control (or the floating bar) can show the sentence and Try again.
  const fail = useCallback((why: VoiceTrouble) => {
    run.current++;
    cleanup();
    setMuted(false);
    setTrouble(why);
    setState("error");
  }, [cleanup]);

  const hear = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setBlocked(false)).catch(() => { /* still refused; the tap stays offered */ });
  }, []);

  const start = useCallback((t: CallTarget) => {
    if (!supabase || !user) return;
    if (state !== "idle" && state !== "error") return;
    setTarget(t);
    setTrouble(null);
    setState("connecting");
    const me = ++run.current;
    // Ask for the relay while the phone asks for the mic, so it costs no wait.
    const route = routeFor((body) => supabase!.functions.invoke("voice-ice", { body }), t.roomId);
    (async () => {
      let local: MediaStream;
      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        if (run.current === me) fail("mic");
        return;
      }
      if (run.current !== me) { local.getTracks().forEach((tr) => tr.stop()); return; }
      try {
        localRef.current = local;

        // Private: the database only lets the room's seated players on this
        // channel (policy "voice: room members listen/talk", F44).
        const chan = supabase!.channel(`voice:${t.roomId}`, {
          config: { private: true, presence: { key: user.id }, broadcast: { self: false } },
        });
        chanRef.current = chan;
        const send = (s: SigBody) =>
          void chan.send({ type: "broadcast", event: "sig", payload: { from: user.id, ...s } });

        const pc = new RTCPeerConnection(await route);
        pcRef.current = pc;
        local.getTracks().forEach((tr) => pc.addTrack(tr, local));

        pc.ontrack = (e) => {
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            // iPhone can refuse to play until a tap: offer "Tap to hear" (V3).
            audioRef.current.play().then(() => setBlocked(false)).catch(() => {
              if (run.current === me) setBlocked(true);
            });
          }
        };
        pc.onicecandidate = (e) => { if (e.candidate) send({ kind: "ice", candidate: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => {
          if (run.current !== me) return;
          const cs = pc.connectionState;
          if (cs === "connected") { wentLive.current = true; setState("live"); }
          // Never connected: usually mobile data with no relay (V1). Connected
          // and then failed: the line dropped. Either way, say so rather than
          // falling back to 'Voice call'. "disconnected" can be a blip, so it
          // is left to recover.
          else if (cs === "failed") fail(wentLive.current ? "dropped" : "connect");
          else if (cs === "closed") hangup();
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
          // Only the opponent we're calling, never anyone else in the room.
          if (msg.from !== t.peerId) return;
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
          for (const k in st) for (const m of st[k]) if (m.user_id === t.peerId) peerPresent = true;
          if (peerPresent) { sawPeer.current = true; void makeOffer(); }
          // They were here and left the call -> end it.
          else if (sawPeer.current) hangup();
        });

        let joined = false;
        chan.subscribe((status) => {
          if (run.current !== me) return;
          if (status === "SUBSCRIBED") { joined = true; void chan.track({ user_id: user.id }); }
          // Refused (not seated in the room, F44) or unreachable before we ever
          // got on: without this the call sat on 'Connecting…' for ever.
          else if (!joined && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) fail("line");
        });
      } catch {
        if (run.current === me) fail("connect");
      }
    })();
  }, [user, state, hangup, fail]);

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
    <Ctx.Provider value={{ state, trouble, blocked, hear, muted, target, start, hangup, toggleMute }}>
      {children}
      <audio ref={audioRef} autoPlay playsInline hidden />
      {showBar && (
        // #3, from the drawing's code: the .toast in leaf, ink words, a white
        // disc with the mic (tap it to mute; it's crossed out when muted),
        // "On call with Tobi", and the tap goes back to the room. Leave stays
        // one tap away at the end.
        <div className="fixed inset-x-0 z-40 flex justify-center px-[14px]
          bottom-[calc(62px+env(safe-area-inset-bottom)+10px)] sm:bottom-4">
          <div className={`w-full max-w-md rounded-[18px] shadow-lift px-3 py-2.5 flex items-center gap-2.5 text-ink-day ${state === "error" ? "bg-petal-hi" : "bg-leaf"}`}>
            {state !== "error" && (
              <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}
                className="shrink-0 grid place-items-center w-11 h-11 -m-[5px]">
                <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-board shadow-lift-sm">
                  <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
                    <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="var(--color-ink-day)" />
                    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="var(--color-ink-day)" strokeWidth="2.2" strokeLinecap="round" />
                    {muted && <path d="M4 4l16 16" stroke="var(--color-ember-lo)" strokeWidth="2.6" strokeLinecap="round" />}
                  </svg>
                </span>
              </button>
            )}
            {state === "error" ? (
              <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug">{troubleText(trouble, target!.peerName)}</p>
            ) : state === "live" && blocked ? (
              <button onClick={hear} className="min-w-0 flex-1 text-left">
                <b className="block text-[14px] truncate">Tap to hear {target!.peerName}</b>
                <small className="block text-[12px] font-bold">On call</small>
              </button>
            ) : (
              <button onClick={() => nav(`/rooms/${target!.code}`)} className="min-w-0 flex-1 text-left">
                <b className="block text-[14px] truncate">{state === "live" ? `On call with ${target!.peerName}` : `Calling ${target!.peerName}…`}</b>
                <small className="block text-[12px] font-bold">{muted ? "You're muted. " : ""}Tap to go back to the room</small>
              </button>
            )}
            <button onClick={hangup}
              className="shrink-0 min-h-[44px] -my-2 text-[13px] font-extrabold underline underline-offset-4">
              {state === "error" ? "Close" : "Leave"}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
