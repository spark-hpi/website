import type { Group } from "three";
import type { VoxelBody } from "./physics";
import type { VoxelIdle } from "./settings";
import { Vector3 } from "three";

export interface IdleParams {
  bodies: VoxelBody[];
  homes: Vector3[];
  seeds: number[];
  voxelSize: number;
  root: Group;
  t: number;
}

// Directional wavefront — mostly horizontal, slightly tilted, like wind-driven water.
const WAVE_DIR_X = 0.94;
const WAVE_DIR_Y = 0.34;

export function applyIdle(kind: VoxelIdle, p: IdleParams): void {
  // Idles never spin the group now, but keep the guard so stale rotations clear.
  p.root.rotation.set(0, 0, 0);

  switch (kind) {
    case "still":
      for (let i = 0; i < p.bodies.length; i++) p.bodies[i].home.copy(p.homes[i]);
      break;
    case "breathe": {
      // Travelling wave across the star. Voxels heave up (y) and plunge toward/away
      // from camera (z) so you see crests roll through like real water.
      const speed = 3.2;
      const k = 4.5;                   // spatial frequency
      const ampY = 0.6 * p.voxelSize;  // vertical heave — strong
      const ampZ = 0.8 * p.voxelSize;  // depth bob — strong
      for (let i = 0; i < p.bodies.length; i++) {
        const h = p.homes[i];
        const phase = p.t * speed - (h.x * WAVE_DIR_X + h.y * WAVE_DIR_Y) * k;
        const s = Math.sin(phase);
        p.bodies[i].home.set(h.x, h.y + s * ampY, h.z + s * ampZ);
      }
      break;
    }
  }
}
