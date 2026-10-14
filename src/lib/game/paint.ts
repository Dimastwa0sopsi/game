// Low-level canvas pixel-art helpers (no imports, shared by texture painters).

export type Rng = () => number;

export interface Ctx {
  ctx: CanvasRenderingContext2D;
  rng: Rng;
  t: number; // tile size in px
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function css(rgb: [number, number, number], a = 1) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
}

export function mix(base: string, target: string, k: number): [number, number, number] {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function shade(base: string, k: number): [number, number, number] {
  return k >= 0 ? mix(base, "#ffffff", k) : mix(base, "#000000", -k);
}

export function shadeHex(base: string, k: number): string {
  const [r, g, b] = shade(base, k);
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

export function fill(c: Ctx, color: string) {
  c.ctx.fillStyle = color;
  c.ctx.fillRect(0, 0, c.t, c.t);
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: [number, number, number], a = 1) {
  c.ctx.fillStyle = css(color, a);
  c.ctx.fillRect(x, y, w, h);
}

/** Random per-pixel brightness variation, the backbone of every MC-ish texture. */
export function grain(c: Ctx, base: string, amount = 0.14, density = 1) {
  for (let y = 0; y < c.t; y++) {
    for (let x = 0; x < c.t; x++) {
      if (density < 1 && c.rng() > density) continue;
      const k = (c.rng() * 2 - 1) * amount;
      rect(c, x, y, 1, 1, shade(base, k));
    }
  }
}

export function speckle(c: Ctx, color: string, count: number, size = 1, alpha = 1) {
  const rgb = hexToRgb(color);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(c.rng() * c.t);
    const y = Math.floor(c.rng() * c.t);
    rect(c, x, y, size, size, rgb, alpha);
  }
}

export function blobs(c: Ctx, color: string, count: number, minR = 1, maxR = 3, alpha = 1) {
  const rgb = hexToRgb(color);
  for (let i = 0; i < count; i++) {
    const cx = c.rng() * c.t;
    const cy = c.rng() * c.t;
    const r = minR + c.rng() * (maxR - minR);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) rect(c, ((x % c.t) + c.t) % c.t, ((y % c.t) + c.t) % c.t, 1, 1, rgb, alpha);
      }
    }
  }
}

/** Draw string art: rows of chars, palette maps char -> css color, '.' = clear. */
export function art(c: Ctx, rows: string[], palette: Record<string, string>) {
  c.ctx.clearRect(0, 0, c.t, c.t);
  const s = c.t / 16;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const col = palette[ch];
      if (!col) continue;
      c.ctx.fillStyle = col;
      c.ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(s), Math.ceil(s));
    }
  }
}

export function clearAll(c: Ctx) {
  c.ctx.clearRect(0, 0, c.t, c.t);
}

/** Simple brick / plank lines */
export function rows(c: Ctx, color: string, step: number, thickness = 1) {
  const rgb = hexToRgb(color);
  for (let y = 0; y < c.t; y += step) rect(c, 0, y, c.t, thickness, rgb);
}

export function cols(c: Ctx, color: string, step: number, thickness = 1) {
  const rgb = hexToRgb(color);
  for (let x = 0; x < c.t; x += step) rect(c, x, 0, thickness, c.t, rgb);
}

export function border(c: Ctx, color: string, thickness = 1, alpha = 1) {
  const rgb = hexToRgb(color);
  rect(c, 0, 0, c.t, thickness, rgb, alpha);
  rect(c, 0, c.t - thickness, c.t, thickness, rgb, alpha);
  rect(c, 0, 0, thickness, c.t, rgb, alpha);
  rect(c, c.t - thickness, 0, thickness, c.t, rgb, alpha);
}

/** Diagonal tool: wooden handle + head drawn by the callback. */
export function toolBase(c: Ctx, handle = "#8a5a2b") {
  const h = hexToRgb(handle);
  for (let i = 0; i < 9; i++) {
    const x = 3 + i;
    const y = 13 - i;
    rect(c, x, y, 2, 2, h);
    rect(c, x, y, 1, 1, shade(handle, 0.18));
  }
}
