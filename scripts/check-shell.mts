/**
 * The shell, #2–#7: what sits over or around the screens. Decided 28 Sep
 * (Daramola): an invite slides up anywhere and whoever asked sees it's been
 * seen and your answer; no signal shows a card on the screens that need it.
 * Checked in the source and schema; the moments are in the screenshots.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const toast = read("src/features/friends/InviteToast.tsx"), hook = read("src/features/friends/useFriends.ts");
const shell = read("src/app/layout/Shell.tsx"), app = read("src/app/App.tsx"), schema = read("supabase/schema.sql");
const waiting = read("src/features/rooms/RoomScreens.tsx"), home = read("src/features/home/HomePage.tsx");

// #2
ok(/\{user && <InviteToast \/>\}/.test(shell), "the invite bar lives in the shell, over every screen (#2)");
ok(/pathname === "\/" \|\| pathname === `\/rooms\/\$\{i\.room_code\}`/.test(toast), "not on Home (its card says it) or in the room it points to");
ok(/answer\(i\.id, "seen"\)/.test(toast) && /answer\(waiting\.id, "seen"\)/.test(home), "shown means seen, on the bar and on Home's card");
ok(/answer\(i\.id, "hold"\)/.test(toast) && /answer\(i\.id, "no"\)/.test(toast) && /Hold on/.test(toast) && /Not now/.test(toast), "Join, Hold on, Not now");
ok(/focused && open !== i\.id/.test(toast) && /'s inviting you/.test(toast), "in a round it's only a small pill at the top until tapped, clear of the X, answers and board");
ok(/rpc\("answer_invite"/.test(hook) && /from_user=eq\.\$\{user\.id\}/.test(hook), "answers go to the server and the waiting screen listens for them");
ok(/says hold on\./.test(waiting) && /can't play right now\./.test(waiting) && /has seen it\./.test(waiting), "the waiting screen says what they said (#35)");
ok(/function public\.answer_invite\(p_invite bigint, p_answer text\)/.test(schema) && /revoke all on function public\.answer_invite\(bigint, text\) from public, anon/.test(schema),
   "answer_invite in the schema, sign-in only");
// #3
ok(/On call with \$\{target!\.peerName\}/.test(read("src/features/voice/VoiceProvider.tsx")) && /Tap to go back to the room/.test(read("src/features/voice/VoiceProvider.tsx")), "the call bar as drawn (#3)");
// #4
for (const r of ["/daily", "/rooms", "/you/everyone"])
  ok(new RegExp(`path="${r.replace(/\//g, "\\/")}" element=\\{<NeedsSignal>`).test(app), `${r} shows the no-signal card when the phone is offline (#4)`);
ok(!/path="\/play" element=\{<NeedsSignal>/.test(app), "Games and solo play never do");
// #5
const push = read("src/features/push/PushOnboarding.tsx");
ok(/played && !dismissed && onQuietScreen/.test(push) && /markRoomPlayed\(\)/.test(read("src/features/rooms/RoomsPage.tsx")), "notifications are asked once, after your first room (#5)");
ok(/pathname === "\/rooms" \|\|/.test(push) && !/startsWith\("\/rooms"\)/.test(push), "never over a room");
// #6, #7
const unlock = read("src/features/play/Unlock.tsx");
ok(/function SeedBurst/.test(unlock) && !/repeating-conic-gradient/.test(unlock), "the burst is seeds, not rays (brand)");
ok(/label="Share it"/.test(unlock) && /See every rank/.test(unlock) && /to="\/you\/road"/.test(unlock), "Share it, Nice, and See every rank opens the road (#6, #7)");

console.log(`${n} shell assertions hold`);
