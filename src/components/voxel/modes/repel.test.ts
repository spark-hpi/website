import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { repelMode } from "./repel";
import type { VoxelBody } from "../physics";

function body(pos: [number, number, number]): VoxelBody {
  return {
    home: new Vector3(...pos),
    pos: new Vector3(...pos),
    vel: new Vector3(), rot: new Vector3(), angVel: new Vector3(),
  };
}

describe("repel", () => {
  it("cursor within radius pushes outward", () => {
    const b = body([0.1, 0, 0]);
    const f = repelMode.force(b, {
      bodies: [b],
      input: { cursorWorld: new Vector3(0, 0, 0), justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(f.x).toBeGreaterThan(0);
  });

  it("cursor outside radius produces zero force", () => {
    const b = body([2, 0, 0]);
    const f = repelMode.force(b, {
      bodies: [b],
      input: { cursorWorld: new Vector3(0, 0, 0), justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(f.length()).toBe(0);
  });

  it("no cursor produces zero force", () => {
    const b = body([0.1, 0, 0]);
    const f = repelMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 },
      root: null as never,
      dt: 1 / 60,
      voxelSize: 0.05,
    });
    expect(f.length()).toBe(0);
  });
});
