import { createRoot } from "react-dom/client";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { PICTO_SEED } from "@/shared/data/picto";
import "@/index.css";
import { BOARD, FONT, GROUND, INK, PENCIL } from "@/shared/brand/tokens";

/**
 * Every rebus, rendered by the real renderer, with its answer underneath.
 *
 * check-rebus.mts can tell you a puzzle overlaps, runs off the canvas or spells
 * its own answer. It cannot tell you the picture does not read as the phrase —
 * that needs eyes, and this is what they look at. Not part of the app: built on
 * its own and thrown away.
 */
const page = Number(new URLSearchParams(location.search).get("page") ?? "0");
const PER = 12;
const slice = PICTO_SEED.slice(page * PER, page * PER + PER);

createRoot(document.getElementById("sheet")!).render(
  <div style={{ background: GROUND, padding: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
      {slice.map((p, i) => (
        <div key={p.slug} style={{
          background: BOARD, border: `3px solid ${INK}`, borderRadius: 16, padding: 8,
        }}>
          <div style={{ aspectRatio: "1", width: "100%" }}>
            <PictoRenderer spec={{ items: p.items }} />
          </div>
          <p style={{
            margin: "6px 0 0", fontFamily: FONT.text,
            fontWeight: 800, fontSize: 14, textAlign: "center", lineHeight: 1.15,
          }}>
            <span style={{ color: PENCIL, fontSize: 12 }}>#{page * PER + i + 1}</span>{" "}
            {p.answer}
          </p>
          <p style={{
            margin: 2, fontFamily: FONT.text, fontSize: 11,
            textAlign: "center", color: PENCIL,
          }}>{p.difficulty} · {p.category}</p>
        </div>
      ))}
    </div>
  </div>,
);
