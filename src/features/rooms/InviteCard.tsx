import { useState } from "react";
import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import { shareResult } from "@/shared/card/frame";

/**
 * The whole two-player feature depends on a second person arriving, and the room
 * screen used to show a code with no way to send it and no instruction. This is
 * the missing half of "create a room".
 */
export function InviteCard({ code, waiting }: { code: string; waiting: boolean }) {
  const [said, setSaid] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const flash = (msg: string) => { setSaid(msg); setTimeout(() => setSaid(null), 2200); };

  // One tap to the share sheet where there is one — on a phone that is the
  // difference between "send this to your brother" being one tap or six. The
  // link's preview card is drawn by api/og.
  function share() {
    void shareResult({ text: `Come play me on BoredGame. Room code ${code}:`, url })
      .then((r) => { if (r === "copied") flash("Link copied"); });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      className="card p-5 bg-petal text-ink">
      <p className="text-[12px] font-black opacity-80">
        {waiting ? "Waiting for a second player" : "Invite someone else"}
      </p>

      <button
        onClick={async () => {
          try { await navigator.clipboard.writeText(code); flash("Code copied"); }
          catch { flash("Select it to copy"); }
        }}
        className="card tap w-full mt-3 py-3 bg-board text-ink
          font-display text-[30px] font-semibold tracking-[0.28em] leading-none">
        {code}
      </button>

      <button onClick={share}
        className="cut tap w-full mt-2.5 py-3.5 cut-petal text-ink font-display text-lg font-semibold">
        {said ?? "Send the invite link"}
      </button>

      <p className="text-[12px] font-semibold opacity-85 mt-3">
        They can also open BoredGame, go to Rooms, and type the code in.
      </p>
    </motion.div>
  );
}
