import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { gravityMode } from "./gravity";
import type { VoxelBody } from "../physics";

function body(pos: [number, number, number]): VoxelBody {
  return { home: new Vector3(...pos), pos: new Vector3(...pos), vel: new Vector3(), rot: new Vector3(), angVel: new Vector3() };
}

describe("gravity", () => {
  it("with no cursor, force includes downward gravity", () => {
    const b = body([0, 0, 0]);
    const f = gravityMode.force(b, {
      bodies: [b],
      input: { cursorWorld: null, justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    });
    expect(f.y).toBeLessThan(0);
  });

  it("cursor near voxel dampens the spring-cancellation (stronger hold)", () => {
    const b = body([0, 0, 0]);
    const far = gravityMode.force(b, {
      bodies: [b],
      input: { cursorWorld: new Vector3(10, 0, 0), justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    }).clone();
    const near = gravityMode.force(b, {
      bodies: [b],
      input: { cursorWorld: new Vector3(0, 0, 0), justClicked: false, lastClickWorld: null },
      root: null as never, dt: 1 / 60, voxelSize: 0.05,
    }).clone();
    expect(near.equals(far)).toBe(false);
  });
});
