import { describe, it, expect } from "vitest";
import { Group, Vector3 } from "three";
import { tiltMode } from "./tilt";

describe("tilt", () => {
  it("cursor right biases root.rotation.y positive", () => {
    const root = new Group();
    const ctx = {
      bodies: [], input: { cursorWorld: new Vector3(0.5, 0, 0), justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 },
      root, dt: 1 / 60, voxelSize: 0.05,
    };
    for (let i = 0; i < 60; i++) tiltMode.beforeStep!(ctx);
    expect(root.rotation.y).toBeGreaterThan(0);
  });

  it("no cursor eases back toward zero", () => {
    const root = new Group();
    root.rotation.y = 0.5;
    const ctx = {
      bodies: [], input: { cursorWorld: null, justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 },
      root, dt: 1 / 60, voxelSize: 0.05,
    };
    for (let i = 0; i < 120; i++) tiltMode.beforeStep!(ctx);
    expect(Math.abs(root.rotation.y)).toBeLessThan(0.05);
  });

  it("force() is zero", () => {
    const root = new Group();
    const f = tiltMode.force({ home: new Vector3(), pos: new Vector3(), vel: new Vector3(), rot: new Vector3(), angVel: new Vector3() },
      { bodies: [], input: { cursorWorld: null, justClicked: false, lastClickWorld: null, cursorSpeed: 0, lastClickSpeed: 0 }, root, dt: 1 / 60, voxelSize: 0.05 });
    expect(f.length()).toBe(0);
  });
});
