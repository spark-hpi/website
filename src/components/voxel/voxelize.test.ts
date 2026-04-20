import { describe, it, expect } from "vitest";
import { voxelize } from "./voxelize";

describe("voxelize", () => {
  it("produces one voxel per filled cell when depth is 1 everywhere", () => {
    const mask = [true, true, false, true];
    const dist = new Float32Array([0.1, 0.1, 0, 0.1]);
    const voxels = voxelize(mask, dist, 2, 2, { minDepth: 1, maxDepth: 1, scale: 0 });
    expect(voxels).toHaveLength(3);
  });

  it("center of a large mask gets maximum depth", () => {
    const w = 5, h = 5;
    const mask = new Array(w * h).fill(true);
    const dist = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      dist[y * w + x] = Math.min(x, y, w - 1 - x, h - 1 - y) + 1;
    }
    const voxels = voxelize(mask, dist, w, h, { minDepth: 1, maxDepth: 6, scale: 1 });
    const center = voxels.filter((v) => v.gx === 2 && v.gy === 2);
    const corner = voxels.filter((v) => v.gx === 0 && v.gy === 0);
    expect(center.length).toBeGreaterThan(corner.length);
    expect(center.length).toBeLessThanOrEqual(6);
  });

  it("positions are centered on origin", () => {
    const mask = [true, true, true, true];
    const dist = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const voxels = voxelize(mask, dist, 2, 2, { minDepth: 1, maxDepth: 1, scale: 0 });
    const xs = voxels.map((v) => v.gx);
    const ys = voxels.map((v) => v.gy);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(1);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(1);
  });
});
