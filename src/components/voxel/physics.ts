import { Vector3 } from "three";

export interface VoxelBody {
  home: Vector3;
  pos: Vector3;
  vel: Vector3;
  rot: Vector3;
  angVel: Vector3;
}

export interface PhysicsParams {
  k: number;
  c: number;
  mass?: number;
  angDrag?: number;
  angK?: number;
}

export function createVoxelBodies(homes: Vector3[]): VoxelBody[] {
  return homes.map((h) => ({
    home: h.clone(),
    pos: h.clone(),
    vel: new Vector3(),
    rot: new Vector3(),
    angVel: new Vector3(),
  }));
}

const _disp = new Vector3();
const _force = new Vector3();

/**
 * Semi-implicit Euler.
 * `modeForce(body)` returns the per-body external force.
 * Spring + damping are always added on top.
 */
export function stepPhysics(
  bodies: VoxelBody[],
  dt: number,
  modeForce: (b: VoxelBody) => Vector3,
  params: PhysicsParams,
): void {
  const k = params.k;
  const c = params.c;
  const invMass = 1 / (params.mass ?? 1);
  const angDrag = params.angDrag ?? 4;
  const angK = params.angK ?? 10;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];

    _disp.subVectors(b.home, b.pos).multiplyScalar(k);
    _force.copy(_disp).addScaledVector(b.vel, -c).add(modeForce(b));

    b.vel.addScaledVector(_force, dt * invMass);
    b.pos.addScaledVector(b.vel, dt);

    b.angVel.x += (-angK * b.rot.x - angDrag * b.angVel.x) * dt;
    b.angVel.y += (-angK * b.rot.y - angDrag * b.angVel.y) * dt;
    b.angVel.z += (-angK * b.rot.z - angDrag * b.angVel.z) * dt;
    b.rot.addScaledVector(b.angVel, dt);
  }
}

export function makeFixedStep(dtFixed = 1 / 60) {
  let acc = 0;
  return function integrate(dtFrame: number, step: () => void) {
    acc += Math.min(0.1, dtFrame);
    while (acc >= dtFixed) {
      step();
      acc -= dtFixed;
    }
  };
}
