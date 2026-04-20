import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { swirlMode } from "./swirl";
import type { VoxelBody } from "../physics";

function body(h: [number, number, number], p: [number, number, number]): VoxelBody {
  return {
    home: new Vector3(...h), pos: new Vector3(...p),
    vel: new Vector3(), rot: new Vector3(), angVel: new Vector3(),
  };
}

describe("swirl", () => {
  it("voxel offset from home gets a tangential force around the axis", () => {
    const b = body([0, 0, 0], [0.1, 0, 0]);
    const f = swirlMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    });
    expect(Math.abs(f.x)).toBeLessThan(1e-6);
    expect(f.length()).toBeGreaterThan(0);
  });

  it("voxel at home gets zero force", () => {
    const b = body([0, 0, 0], [0, 0, 0]);
    const f = swirlMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    });
    expect(f.length()).toBe(0);
  });
});
