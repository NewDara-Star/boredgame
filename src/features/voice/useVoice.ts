import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";

/**
 * A two-phone voice call inside a room.
 *
 * WebRTC audio, peer to peer. Signalling (the SDP offer/answer and the ICE
 * candidates) rides a dedicated realtime channel, voice:<room>, kept apart from
 * the game channel so a call can start and end on its own. STUN only for now --
 * good enough on Wi-Fi, where the two phones can reach each other directly; a
 * TURN relay (for the mobile-data case) is a later bolt-on.
 *
 * Glare is avoided by not racing: the peer with the smaller user id is always
 * the one who makes the offer, the other only answers. Audio is negotiated once
 * -- both add their mic before offering -- so there is no renegotiation to get
 * wrong.
 */
type SigBody =
  | { kind: "desc"; desc: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };
type Sig = SigBody & { from: string };

export type VoiceState = "idle" | "connecting" | "live" | "error";

const RTC: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useVoice(roomId: number | null, userId: string | undefined, peerId: string | null) {
  const [state, setState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteSet = useRef(false);
  const offered = useRef(false);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* already closed */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    if (chanRef.current && supabase) { void supabase.removeChannel(chanRef.current); }
    chanRef.current = null;
    pendingIce.current = [];
    remoteSet.current = false;
    offered.current = false;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const hangup = useCallback(() => { cleanup(); setState("idle"); setMuted(false); }, [cleanup]);

  const start = useCallback(async () => {
    if (!supabase || !roomId || !userId || !peerId) return;
    if (state !== "idle" && state !== "error") return;
    setState("connecting");
    try {
      const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localRef.current = local;

      const chan = supabase.channel(`voice:${roomId}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });
      chanRef.current = chan;
      const send = (s: SigBody) =>
        void chan.send({ type: "broadcast", event: "sig", payload: { from: userId, ...s } });

      const pc = new RTCPeerConnection(RTC);
      pcRef.current = pc;
      local.getTracks().forEach((t) => pc.addTrack(t, local));

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
        else if (cs === "failed") setState("error");
      };

      const initiator = userId < peerId; // deterministic: the smaller id offers
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
        if (msg.from === userId) return;
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
        for (const k in st) for (const m of st[k]) if (m.user_id && m.user_id !== userId) peerPresent = true;
        if (peerPresent) void makeOffer();
      });

      chan.subscribe((status) => { if (status === "SUBSCRIBED") void chan.track({ user_id: userId }); });
    } catch {
      // mic permission denied, or no device
      cleanup();
      setState("error");
    }
  }, [roomId, userId, peerId, state, cleanup]);

  const toggleMute = useCallback(() => {
    const local = localRef.current;
    if (!local) return;
    setMuted((m) => {
      const next = !m;
      local.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  // Leaving the room (unmount) ends the call and frees the mic.
  useEffect(() => () => cleanup(), [cleanup]);

  return { state, muted, start, hangup, toggleMute, audioRef };
}
