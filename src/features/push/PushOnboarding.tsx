import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sunflower } from "@/shared/brand/Sunflower";
import { usePush } from "./usePush";

const KEY = "bg_push_primed"; // per-device: "1" once they've dismissed the primer
const PLAYED = "bg_room_played"; // per-device: "1" once they've played a room

const read = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const mark = (k: string) => { try { localStorage.setItem(k, "1"); } catch { /* private mode */ } };

/** A room game has started on this phone: the primer may ask now (#5). */
export const markRoomPlayed = () => { if (!read(PLAYED)) mark(PLAYED); };

/**
 * #5, turning on notifications, from the drawing's code: a sheet, asked once,
 * after your first room (a ping means something once you've played someone),
 * on a quiet screen: Home, Rooms or You, never over a game. It is our own
 * sheet, not the phone's prompt: that fires only on Turn on, so Not now never
 * spends iOS's one-time ask. On an iPhone that isn't installed yet, the three
 * add-to-home steps come first. The Notifications row on You is the way back.
 */
export function PushOnboarding() {
  const { ready, state, needsInstall, signedIn, enable, busy } = usePush();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage
  const [played, setPlayed] = useState(false);

  useEffect(() => { setDismissed(read(KEY)); setPlayed(read(PLAYED)); }, [pathname]);

  const close = () => { mark(KEY); setDismissed(true); };

  const onQuietScreen = pathname === "/" || pathname === "/rooms" || pathname === "/you";
  const canOfferNow = state === "default" || state === "granted";
  const show = signedIn && ready && played && !dismissed && onQuietScreen && (canOfferNow || needsInstall);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 grid items-end" role="dialog" aria-modal="true" aria-label="Know when it's your move">
      <button aria-label="Close" onClick={close} className="absolute inset-0 bg-ink-day/55" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative bg-board text-ink rounded-t-[26px] px-4 pt-[14px] pb-[calc(18px+env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto grid gap-[10px] shadow-[0_-10px_30px_rgba(14,74,176,.25)]">
        <div className="w-10 h-[5px] rounded-full bg-hair mx-auto" />
        <div className="flex items-center gap-2.5">
          <Sunflower state="look-right" stem={false} size={52} className="shrink-0" />
          <div className="min-w-0">
            <b className="block font-display font-normal text-[21px] leading-tight">Know when it's your move</b>
            <p className="text-[14px] font-semibold text-soft">A ping when a friend invites you or plays their turn.</p>
          </div>
        </div>
        {needsInstall && (
          <div className="rounded-[20px] bg-mist px-3 py-2.5 grid gap-1">
            <span className="text-[12px] font-extrabold text-soft">On iPhone, first</span>
            <p className="text-[14px] font-semibold">1. Tap Share in Safari · 2. Add to Home Screen · 3. Open BoredGame from the icon</p>
          </div>
        )}
        <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
          {needsInstall ? (
            <button onClick={close} className="cut tap cut-petal min-h-[52px] font-display text-[19px]">Got it</button>
          ) : (
            <button onClick={() => void enable().then(close)} disabled={busy} className="cut tap cut-petal min-h-[52px] font-display text-[19px]">
              {busy ? "Turning on…" : "Turn on"}
            </button>
          )}
          <button onClick={close} className="cut tap cut-board min-h-[52px] font-display text-[19px]">Not now</button>
        </div>
      </motion.div>
    </div>
  );
}
