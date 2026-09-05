import { createRoot } from "react-dom/client";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { PICTO_SEED } from "@/shared/data/picto";
import "@/index.css";

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
  <div style={{ background: "#FBF4E6", padding: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
      {slice.map((p, i) => (
        <div key={p.slug} style={{
          background: "#fff", border: "3px solid #16130F", borderRadius: 16, padding: 8,
        }}>
          <div style={{ aspectRatio: "1", width: "100%" }}>
            <PictoRenderer spec={{ items: p.items }} />
          </div>
          <p style={{
            margin: "6px 0 0", fontFamily: "Nunito, system-ui, sans-serif",
            fontWeight: 800, fontSize: 14, textAlign: "center", lineHeight: 1.15,
          }}>
            <span style={{ color: "#8A8175", fontSize: 12 }}>#{page * PER + i + 1}</span>{" "}
            {p.answer}
          </p>
          <p style={{
            margin: 2, fontFamily: "Nunito, system-ui, sans-serif", fontSize: 11,
            textAlign: "center", color: "#8A8175",
          }}>{p.difficulty} · {p.category}</p>
        </div>
      ))}
    </div>
  </div>,
);
