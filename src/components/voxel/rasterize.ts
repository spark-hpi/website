export function thresholdAlpha(alpha: Uint8ClampedArray, w: number, h: number, threshold: number): boolean[] {
  const out = new Array<boolean>(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = alpha[i * 4 + 3] >= threshold;
  }
  return out;
}

export function maskToStrings(mask: boolean[], w: number, h: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = "";
    for (let x = 0; x < w; x++) r += mask[y * w + x] ? "█" : "·";
    rows.push(r);
  }
  return rows;
}

export interface RasterResult {
  mask: boolean[];
  width: number;
  height: number;
}

/**
 * Rasterise an SVG path onto a Canvas and return a boolean mask.
 * Browser-only; Canvas2D required.
 */
export async function rasterizeSvgPath(
  pathD: string,
  viewBox: { w: number; h: number },
  target: { w: number; h: number },
  threshold = 128,
): Promise<RasterResult> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(target.w, target.h)
      : Object.assign(document.createElement("canvas"), { width: target.w, height: target.h });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  // Scale path coordinates into target canvas.
  const sx = target.w / viewBox.w;
  const sy = target.h / viewBox.h;
  ctx.fillStyle = "#000";
  ctx.clearRect(0, 0, target.w, target.h);
  ctx.save();
  ctx.scale(sx, sy);
  const p = new Path2D(pathD);
  ctx.fill(p);
  ctx.restore();

  const img = ctx.getImageData(0, 0, target.w, target.h);
  const mask = thresholdAlpha(img.data, target.w, target.h, threshold);
  return { mask, width: target.w, height: target.h };
}

/**
 * Fetch an SVG and extract its single `<path d="…">` attribute.
 */
export async function fetchPathD(url: string): Promise<{ pathD: string; viewBox: { w: number; h: number } }> {
  const res = await fetch(url);
  const text = await res.text();
  const viewMatch = text.match(/viewBox=["']([\d.\s-]+)["']/);
  let w = 0, h = 0;
  if (viewMatch) {
    const parts = viewMatch[1].trim().split(/\s+/).map(Number);
    w = parts[2] ?? 0;
    h = parts[3] ?? 0;
  }
  const d = text.match(/<path[^>]*\sd=["']([^"']+)["']/);
  if (!d) throw new Error(`No <path d=""> in ${url}`);
  return { pathD: d[1], viewBox: { w, h } };
}
