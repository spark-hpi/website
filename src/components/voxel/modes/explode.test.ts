import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { explodeMode } from "./explode";
import type { VoxelBody } from "../physics";

function body(pos: [number, number, number]): VoxelBody {
  return {
    home: new Vector3(...pos),
    pos: new Vector3(...pos),
    vel: new Vector3(),
    rot: new Vector3(),
    angVel: new Vector3(),
  };
}

describe("explode", () => {
  it("click imparts outward velocity from click point", () => {
    const b = body([1, 0, 0]);
    explodeMode.beforeStep!({
      bodies: [b],
      input: { cursorWorld: null, justClicked: true, lastClickWorld: new Vector3(0, 0, 0) },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(b.vel.x).toBeGreaterThan(0);
    expect(b.vel.length()).toBeGreaterThan(0);
  });

  it("no click → no impulse", () => {
    const b = body([1, 0, 0]);
    explodeMode.beforeStep!({
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(b.vel.length()).toBe(0);
  });

  it("force() is zero (mode only applies impulses)", () => {
    const b = body([1, 0, 0]);
    const f = explodeMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(f.length()).toBe(0);
  });
});
