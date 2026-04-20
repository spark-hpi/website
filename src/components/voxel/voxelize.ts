export interface VoxelCell {
  gx: number;
  gy: number;
  gz: number;
  seed: number;
  /** "interior" = fully inside the silhouette → render as one cube of voxelSize.
   *  "boundary" = straddles the silhouette curve → render as N sub-cubes carved to the curve. */
  kind: "interior" | "boundary";
  /** Local XYZ offsets (one per sub-cube), in voxel-local world units. Present only for boundary cells. */
  subOffsets?: Float32Array;
}

export interface VoxelizeOptions {
  voxelSize: number;
  /** Sub-samples per cell side; edge cells emit one sub-cube per filled sub-pixel. */
  sub: number;
}

/**
 * Classify each coarse cell as interior / boundary / exterior by super-sampling `fineMask`
 * at `sub × sub` sub-pixels per cell. Interior cells emit one full-size voxel. Boundary cells
 * emit a list of sub-cube local offsets, one per filled sub-pixel, so the rendered shape
 * matches the SVG curve inside the cell.
 */
export function voxelize(
  fineMask: boolean[],
  gW: number,
  gH: number,
  opts: VoxelizeOptions,
): VoxelCell[] {
  const SUB = opts.sub;
  const fineW = gW * SUB;
  const vs = opts.voxelSize;
  const total = SUB * SUB;
  const out: VoxelCell[] = [];
  let seed = 0;

  for (let y = 0; y < gH; y++) {
    for (let x = 0; x < gW; x++) {
      const filled: number[] = [];
      for (let sy = 0; sy < SUB; sy++) {
        const fy = y * SUB + sy;
        for (let sx = 0; sx < SUB; sx++) {
          const fx = x * SUB + sx;
          if (fineMask[fy * fineW + fx]) filled.push(sy * SUB + sx);
        }
      }
      if (filled.length === 0) continue;
      if (filled.length === total) {
        out.push({ gx: x, gy: y, gz: 0, seed: seed++, kind: "interior" });
        continue;
      }
      const subOffsets = new Float32Array(filled.length * 3);
      for (let k = 0; k < filled.length; k++) {
        const i = filled[k];
        const sx = i % SUB;
        const sy = (i - sx) / SUB;
        subOffsets[k * 3 + 0] = ((sx + 0.5) / SUB - 0.5) * vs;
        subOffsets[k * 3 + 1] = (0.5 - (sy + 0.5) / SUB) * vs;
        subOffsets[k * 3 + 2] = 0;
      }
      out.push({ gx: x, gy: y, gz: 0, seed: seed++, kind: "boundary", subOffsets });
    }
  }
  return out;
}
