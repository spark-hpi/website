import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createVoxelBodies, stepPhysics, type VoxelBody } from "./physics";

describe("physics", () => {
  it("creates bodies with home == pos, zero velocity", () => {
    const bodies = createVoxelBodies([new Vector3(1, 2, 3)]);
    expect(bodies[0].home.equals(bodies[0].pos)).toBe(true);
    expect(bodies[0].vel.length()).toBe(0);
  });

  it("displaced body returns toward home under spring + damping", () => {
    const bodies = createVoxelBodies([new Vector3(0, 0, 0)]);
    bodies[0].pos.set(1, 0, 0);
    for (let i = 0; i < 120; i++) stepPhysics(bodies, 1 / 60, () => new Vector3(), { k: 40, c: 6 });
    expect(bodies[0].pos.length()).toBeLessThan(0.1);
  });

  it("kinetic energy decays monotonically after an impulse (within damping)", () => {
    const bodies = createVoxelBodies([new Vector3(0, 0, 0)]);
    bodies[0].vel.set(1, 0, 0);
    let ke = 0.5 * bodies[0].vel.lengthSq();
    let prev = ke;
    for (let burst = 0; burst < 20; burst++) {
      for (let i = 0; i < 30; i++) stepPhysics(bodies, 1 / 60, () => new Vector3(), { k: 40, c: 12 });
      ke = 0.5 * bodies[0].vel.lengthSq() + 0.5 * 40 * bodies[0].pos.distanceToSquared(bodies[0].home);
      expect(ke).toBeLessThanOrEqual(prev + 1e-6);
      prev = ke;
    }
  });
});
