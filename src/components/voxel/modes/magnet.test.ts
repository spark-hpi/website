import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { magnetMode } from "./magnet";
import type { VoxelBody } from "../physics";

function body(pos: [number, number, number]): VoxelBody {
  return { home: new Vector3(...pos), pos: new Vector3(...pos), vel: new Vector3(), rot: new Vector3(), angVel: new Vector3() };
}

describe("magnet", () => {
  it("cursor within radius pulls toward cursor", () => {
    const b = body([0.2, 0, 0]);
    const f = magnetMode.force(b, {
      bodies: [b],
      input: { cursorWorld: new Vector3(0, 0, 0), justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    });
    expect(f.x).toBeLessThan(0);
  });

  it("no cursor → zero force", () => {
    const b = body([0.2, 0, 0]);
    const f = magnetMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    });
    expect(f.length()).toBe(0);
  });
});
