/**
 * A friend's link (#44, #45, Daramola 26 Sep): it says whose it is before you
 * sign up, one tap makes your guest name and adds them, and friends now leads
 * to a game. Checked in the source and schema; the flow is in the screenshots.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const page = read("src/features/friends/AddFriendPage.tsx"), hook = read("src/features/friends/useFriends.ts"), schema = read("supabase/schema.sql");

ok(/rpc\("friend_name"/.test(hook) && /user \? whoseCode\(code\)\s*: friendName\(code\)/.test(page), "signed out, the link asks for the name only (friend_name); signed in, friend_by_code");
ok(/grant execute on function public\.friend_name\(text\) to anon, authenticated/.test(schema) && /revoke all on function public\.friend_by_code\(text\) from public, anon/.test(schema),
   "friend_name is open to anyone; friend_by_code stays sign-in only");
ok(/returns text language sql stable security definer/.test(schema.slice(schema.lastIndexOf("create or replace function public.friend_name"))), "friend_name returns a name, nothing else");
ok(/signInAsGuest\(guestName\)[\s\S]{0,200}await add\(\)/.test(page), "one tap makes your guest name and adds them (#44)");
ok(/wants to play you/.test(page) && /Sunflower state="bloom"/.test(page) && /Play \$\{name\} now/.test(page), "the request and friends now, as drawn (#44, #45)");
ok(/createRoom\(/.test(page) && /invite\(r\.id, id\)/.test(page) && /friend_id/.test(hook), "Play Tobi now opens a room and asks them");
ok(/useFocusMode\(!added\)/.test(page), "the request has the whole phone; friends now has the tab bar back");
ok(!/Head-to-head/.test(page), "Rooms is called Rooms (N6)");

console.log(`${n} friends assertions hold`);
