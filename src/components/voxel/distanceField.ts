/**
 * Two-pass 8-connected Chamfer distance transform.
 * For filled cells, returns approximate Euclidean distance to nearest empty cell (or image edge).
 * Empty cells return 0.
 */
export function distanceTransform(mask: boolean[], w: number, h: number): Float32Array {
  const INF = 1e9;
  const D1 = 1;
  const D2 = Math.SQRT2;
  const d = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let best = d[i];
      best = Math.min(best, (x > 0 ? d[i - 1] : 0) + D1);
      best = Math.min(best, (y > 0 ? d[i - w] : 0) + D1);
      best = Math.min(best, (x > 0 && y > 0 ? d[i - w - 1] : 0) + D2);
      best = Math.min(best, (x < w - 1 && y > 0 ? d[i - w + 1] : 0) + D2);
      d[i] = best;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let best = d[i];
      best = Math.min(best, (x < w - 1 ? d[i + 1] : 0) + D1);
      best = Math.min(best, (y < h - 1 ? d[i + w] : 0) + D1);
      best = Math.min(best, (x < w - 1 && y < h - 1 ? d[i + w + 1] : 0) + D2);
      best = Math.min(best, (x > 0 && y < h - 1 ? d[i + w - 1] : 0) + D2);
      d[i] = best;
    }
  }

  for (let i = 0; i < w * h; i++) if (d[i] >= INF) d[i] = 0;
  return d;
}
