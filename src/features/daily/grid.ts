/** Right and wrong in round order, kept for the day so the share grid survives a
    reload. The server's grid (from submit_daily) replaces this phone's once the
    round is filed, so a round played on two phones still shares all ten. */
const gridKey = (day: string) => `bg-daily-grid-${day}`;
export function readGrid(day: string): boolean[] | null {
  try { const v = JSON.parse(localStorage.getItem(gridKey(day)) ?? "null"); return Array.isArray(v) ? v : null; }
  catch { return null; }
}
export function keepGrid(day: string, grid: boolean[]) {
  try { localStorage.setItem(gridKey(day), JSON.stringify(grid)); } catch { /* private mode */ }
}
