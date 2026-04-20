import { describe, it, expect } from "vitest";
import { voxelize } from "./voxelize";

function makeFineMask(gW: number, gH: number, SUB: number, pred: (x: number, y: number) => boolean): boolean[] {
  const fw = gW * SUB, fh = gH * SUB;
  const mask = new Array<boolean>(fw * fh).fill(false);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) mask[y * fw + x] = pred(x, y);
  return mask;
}

describe("voxelize", () => {
  it("marks a fully-filled 2×2 grid as interior cells", () => {
    const SUB = 4;
    const fine = makeFineMask(2, 2, SUB, () => true);
    const cells = voxelize(fine, 2, 2, { voxelSize: 1, sub: SUB });
    expect(cells).toHaveLength(4);
    for (const c of cells) expect(c.kind).toBe("interior");
  });

  it("marks cells that are half-filled at sub-pixel level as boundary", () => {
    const SUB = 4;
    // Fill only the left half of a 2×1 grid → cell (0,0) fully filled, (1,0) empty
    //   and then split cell (0,0) so only half of its sub-pixels are filled.
    const fine = makeFineMask(1, 1, SUB, (x) => x < SUB / 2);
    const cells = voxelize(fine, 1, 1, { voxelSize: 1, sub: SUB });
    expect(cells).toHaveLength(1);
    const [c] = cells;
    expect(c.kind).toBe("boundary");
    expect(c.subOffsets).toBeDefined();
    expect(c.subOffsets!.length).toBe(3 * (SUB * SUB) / 2);
  });

  it("skips completely empty cells", () => {
    const SUB = 4;
    const fine = makeFineMask(2, 2, SUB, (x, y) => x < SUB && y < SUB); // only cell (0,0) filled
    const cells = voxelize(fine, 2, 2, { voxelSize: 1, sub: SUB });
    expect(cells).toHaveLength(1);
    expect(cells[0].gx).toBe(0);
    expect(cells[0].gy).toBe(0);
  });

  it("sub-offsets are within ±voxelSize/2", () => {
    const SUB = 4;
    const fine = makeFineMask(1, 1, SUB, (x, y) => (x + y) % 2 === 0);
    const cells = voxelize(fine, 1, 1, { voxelSize: 1, sub: SUB });
    expect(cells[0].kind).toBe("boundary");
    const offs = cells[0].subOffsets!;
    for (let i = 0; i < offs.length; i += 3) {
      expect(Math.abs(offs[i])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(offs[i + 1])).toBeLessThanOrEqual(0.5);
      expect(offs[i + 2]).toBe(0);
    }
  });
});
