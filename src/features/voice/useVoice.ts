// Voice primitives shared by the provider. (This file was the old per-room
// hook; the call now lives in VoiceProvider so it survives navigation, and
// these are the low-level bits it builds on.)

export type VoiceState = "idle" | "connecting" | "live" | "error";

// STUN only for now: a direct connection, which lands on Wi-Fi. A TURN relay
// for the mobile-data case is a later bolt-on.
export const RTC: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type SigBody =
  | { kind: "desc"; desc: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };
export type Sig = SigBody & { from: string };

/** Who you're calling, carried so a global call bar can name them and route
    back to the room even when you've navigated away. */
export interface CallTarget {
  roomId: number;
  code: string;
  peerId: string;
  peerName: string;
}
