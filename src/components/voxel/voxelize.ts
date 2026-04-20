export interface VoxelCell {
  gx: number;
  gy: number;
  gz: number;
  seed: number;
}

export interface VoxelizeOptions {
  minDepth: number;
  maxDepth: number;
  scale: number;
}

export function voxelize(
  mask: boolean[],
  dist: Float32Array,
  w: number,
  h: number,
  opts: VoxelizeOptions,
): VoxelCell[] {
  const out: VoxelCell[] = [];
  let seed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const raw = opts.scale === 0 ? opts.minDepth : Math.round(1 + dist[i] * opts.scale);
      const depth = Math.max(opts.minDepth, Math.min(opts.maxDepth, raw));
      const zStart = -Math.floor(depth / 2);
      for (let k = 0; k < depth; k++) {
        out.push({ gx: x, gy: y, gz: zStart + k, seed: seed++ });
      }
    }
  }
  return out;
}

/**
 * Given the total voxel count budget, choose a distance-field scale.
 * Larger scale → more Z extrusion → more voxels.
 */
export function chooseDepthScale(filledCount: number, budget: number): number {
  if (filledCount === 0) return 0;
  const avgDepth = Math.max(1, Math.min(4, budget / filledCount));
  return (avgDepth - 1) / 2;
}
