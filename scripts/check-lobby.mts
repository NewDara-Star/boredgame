/**
 * Picking a game in a room picks exactly one game.
 *
 * A fresh room is `mode: squareoff, game: trivia, challenge: trivia`, and the
 * lobby lit up TWO cards on it: Square Off, and Catapult Squares. They are the
 * same mode and the same board — only what a move costs tells them apart — and
 * the highlight test looked at the mode and the bank alone. Catapult Squares
 * draws on no bank, so it matched every row of its mode.
 *
 * The identity of a room game is therefore (mode, bank, challenge), and the
 * rule this file holds is that no two games share one: whatever the row says,
 * at most one card can be on. registry.tsx is JSX and cannot be imported by a
 * plain node script, so the entries are read out of the source — which also
 * catches the case where someone adds a game and forgets the challenge.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

const src = readFileSync(new URL("../src/features/play/registry.tsx", import.meta.url), "utf8");
const lobby = readFileSync(new URL("../src/features/rooms/Lobby.tsx", import.meta.url), "utf8");

interface Entry { slug: string; bank: string | null; mode: string; challenge?: string }
const entries: Entry[] = [];
for (const block of src.split(/\n  \{\n/).slice(1)) {
  const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
  const bankM = block.match(/bank:\s*(?:"([^"]+)"|null)/);
  const mode = block.match(/room:\s*\{[^}]*mode:\s*"([^"]+)"/s)?.[1];
  if (!slug || !bankM || !mode) continue;
  const challenge = block.match(/room:\s*\{[^}]*challenge:\s*"([^"]+)"/s)?.[1];
  entries.push({ slug, bank: bankM[1] ?? null, mode, challenge });
}
ok(entries.length >= 7, `every room game was read out of the registry (${entries.length})`);
console.log(`  ${entries.map((e) => e.slug).join(", ")}`);

/** the lobby's own highlight test, kept in step with Lobby.tsx */
const lit = (e: Entry, row: { mode: string; game: string; challenge: string }) =>
  row.mode === e.mode
  && (e.bank === null || row.game === e.bank)
  && (e.challenge === undefined || row.challenge === e.challenge);

// Picking a game writes the row the lobby writes. Whatever it writes, exactly
// one card must be on — including for a bankless game, which leaves whichever
// bank key was there before, so every leftover is tried.
const LEFTOVERS = ["trivia", "picto"];
for (const e of entries) {
  for (const leftover of LEFTOVERS) {
    const row = {
      mode: e.mode,
      game: e.bank ?? leftover,
      challenge: e.challenge ?? "trivia",
    };
    const on = entries.filter((x) => lit(x, row));
    ok(on.length === 1,
       `picking ${e.slug} (leftover bank ${leftover}) lights exactly one card, not ${on.length}` +
       (on.length > 1 ? ` — ${on.map((x) => x.slug).join(" and ")}` : ""));
    ok(on[0]?.slug === e.slug, `and the one it lights is ${e.slug}, not ${on[0]?.slug}`);
  }
}

// A room as it is created, before anyone has chosen anything.
{
  const fresh = { mode: "squareoff", game: "trivia", challenge: "trivia" };
  const on = entries.filter((e) => lit(e, fresh));
  ok(on.length === 1, `a fresh room shows one game selected, not ${on.length} (${on.map((e) => e.slug).join(", ")})`);
  ok(on[0].slug === "squareoff", "and it is the one createRoom writes");
}

// Two games in one mode are only ever told apart by the challenge, so a mode
// with two games must have it on both.
{
  const byMode = new Map<string, Entry[]>();
  for (const e of entries) byMode.set(e.mode, [...(byMode.get(e.mode) ?? []), e]);
  for (const [mode, es] of byMode) {
    if (es.length < 2) continue;
    ok(es.every((e) => e.challenge !== undefined || e.bank !== null),
       `${mode} has ${es.length} games, so each is a bank or a challenge: ${es.map((e) => e.slug).join(", ")}`);
  }
}

// The structural half: the lobby must actually consult the challenge, and must
// not offer a choice that does not exist for the mode on screen.
{
  ok(/c\.challenge === undefined \|\| challenge === c\.challenge/.test(lobby),
     "the lobby's highlight test consults the challenge");
  ok(/onSetup\(c\.mode, c\.game \?\? room\.game,[\s\S]{0,120}c\.challenge \?\? challenge\)/.test(lobby),
     "and picking a game writes that game's challenge");
  ok(/const hasChallenge = ROOM_GAMES\.some/.test(lobby),
     "whether a move can cost a shot is asked of the mode");
  ok(/\{hasChallenge && \(/.test(lobby), "and step 3 only appears where it does");
  ok(!/\{hasBank && \(/.test(lobby),
     "the question and difficulty steps are gated on asking questions, not on a bank existing");
}

console.log(`${n} lobby assertions hold`);
