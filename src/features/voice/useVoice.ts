// Voice primitives shared by the provider. (This file was the old per-room
// hook; the call now lives in VoiceProvider so it survives navigation, and
// these are the low-level bits it builds on.)

export type VoiceState = "idle" | "connecting" | "live" | "error";

/** Why a call is in "error" (F45, V1). Each one gets its own sentence, so a
    failed call never just drops back to 'Voice call' with no word. */
export type VoiceTrouble = "mic" | "line" | "connect" | "dropped";

export function troubleText(t: VoiceTrouble | null, name: string): string {
  switch (t) {
    case "mic": return "Couldn't use your microphone. Allow it for this site, then try again.";
    case "line": return "Couldn't reach the call line. Check your connection, then try again.";
    case "connect": return `Couldn't connect to ${name}. Calls work best with both of you on Wi-Fi.`;
    case "dropped": return `The call with ${name} dropped. Calls hold best on Wi-Fi.`;
    default: return "The call stopped. Try again.";
  }
}

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
