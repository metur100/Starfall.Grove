// Uniform grid for fast "what is near this point / inside this view" queries on large maps.
export class Grid<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();
  private readonly out: T[] = [];
  constructor(readonly size: number, items: T[] = []) { for (const it of items) this.insert(it); }
  private key(cx: number, cy: number) { return cx * 65536 + cy; }
  insert(it: T) {
    const k = this.key(Math.floor(it.x / this.size), Math.floor(it.y / this.size));
    const cell = this.cells.get(k); if (cell) cell.push(it); else this.cells.set(k, [it]);
  }
  /** Items whose position lies in the rectangle (reuses one array: copy it if you keep it). */
  rect(x0: number, y0: number, x1: number, y1: number): T[] {
    const out = this.out; out.length = 0;
    const s = this.size, cx0 = Math.floor(x0 / s), cx1 = Math.floor(x1 / s), cy0 = Math.floor(y0 / s), cy1 = Math.floor(y1 / s);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const cell = this.cells.get(this.key(cx, cy)); if (!cell) continue;
      for (const it of cell) if (it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1) out.push(it);
    }
    return out;
  }
  near(x: number, y: number, r: number) { return this.rect(x - r, y - r, x + r, y + r); }
}
