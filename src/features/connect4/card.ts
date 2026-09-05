/** The session card's picture: the frame and a few discs, as on the catalogue. */
import { artStage, INK, PICTO, rounded, TRIVIA, type Hero } from "@/shared/card/frame";



export const connect4Art = (name: string): Hero => (c, box) =>
  artStage(c, box, name, 3, (c, _w, h) => {
    const cols = 5, rows = 3, hole = h * 0.25, gap = hole * 0.28;
    const w = cols * hole + (cols + 1) * gap, hh = rows * hole + (rows + 1) * gap;
    c.fillStyle = INK; rounded(c, -w / 2, -hh / 2 + 12, w, hh, 28); c.fill();
    c.fillStyle = TRIVIA; rounded(c, -w / 2, -hh / 2, w, hh, 28); c.fill();
    c.lineWidth = 8; c.strokeStyle = INK; rounded(c, -w / 2, -hh / 2, w, hh, 28); c.stroke();
    const filled: Record<string, string> = { "1,2": PICTO, "2,2": TRIVIA_DISC, "2,1": PICTO, "3,2": PICTO, "3,1": TRIVIA_DISC, "3,0": PICTO };
    for (let col = 0; col < cols; col++) for (let r = 0; r < rows; r++) {
      const cx = -w / 2 + gap + hole / 2 + col * (hole + gap), cy = -hh / 2 + gap + hole / 2 + r * (hole + gap);
      c.beginPath(); c.arc(cx, cy, hole / 2, 0, Math.PI * 2);
      c.fillStyle = filled[`${col},${r}`] ?? "#FFFFFF"; c.fill();
      c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    }
  });
/** the guest's disc on a blue frame needs to read as a disc, not a hole */
const TRIVIA_DISC = "#8FA4FF";
