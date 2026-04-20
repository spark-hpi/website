import type { Group } from "three";
import { Vector3 } from "three";
import type { VoxelBody } from "./physics";
import type { VoxelIdle } from "./settings";

const _scratch = new Vector3();

export interface IdleParams {
  bodies: VoxelBody[];
  homes: Vector3[];
  seeds: number[];
  voxelSize: number;
  root: Group;
  t: number;
}

export function applyIdle(kind: VoxelIdle, p: IdleParams): void {
  switch (kind) {
    case "still":
      for (let i = 0; i < p.bodies.length; i++) p.bodies[i].home.copy(p.homes[i]);
      break;
    case "rotate":
      for (let i = 0; i < p.bodies.length; i++) p.bodies[i].home.copy(p.homes[i]);
      p.root.rotation.y += 0.006;
      break;
    case "breathe": {
      const a = Math.sin(p.t * 0.4) * 0.03 * p.voxelSize;
      for (let i = 0; i < p.bodies.length; i++) {
        const h = p.homes[i];
        const n = h.length() || 1;
        _scratch.copy(h).multiplyScalar(1 + a / n);
        p.bodies[i].home.copy(_scratch);
      }
      break;
    }
    case "drift": {
      const amp = 0.015 * p.voxelSize;
      for (let i = 0; i < p.bodies.length; i++) {
        const s = p.seeds[i];
        const ox = Math.sin(p.t * 0.7 + s * 0.13) * amp;
        const oy = Math.sin(p.t * 0.9 + s * 0.27) * amp;
        const oz = Math.sin(p.t * 0.6 + s * 0.41) * amp;
        p.bodies[i].home.set(p.homes[i].x + ox, p.homes[i].y + oy, p.homes[i].z + oz);
      }
      break;
    }
  }
}
