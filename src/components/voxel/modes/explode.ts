import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const ZERO = new Vector3();
const _dir = new Vector3();
const _rand = new Vector3();

function randUnit(v: Vector3): Vector3 {
  v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  const n = v.length();
  if (n > 1e-6) v.multiplyScalar(1 / n);
  else v.set(1, 0, 0);
  return v;
}

// Flick-click → bigger boom. Gentle click → softer pop.
// Maps click-time cursor speed to a 0.6×–3.5× multiplier.
function clickBoost(speed: number): number {
  return 0.6 + 2.9 * (speed / (speed + 1.5));
}

export const explodeMode: Mode = {
  params: { impulseScale: 2.2, angularImpulse: 3.5 },
  force: () => ZERO,
  beforeStep(ctx: ModeContext) {
    if (!ctx.input.justClicked || !ctx.input.lastClickWorld) return;
    const click = ctx.input.lastClickWorld;
    const boost = clickBoost(ctx.input.lastClickSpeed);
    const s = this.params!.impulseScale * boost;
    const a = this.params!.angularImpulse * boost;
    for (const b of ctx.bodies) {
      _dir.subVectors(b.pos, click);
      const d = _dir.length();
      if (d < 1e-6) {
        randUnit(_dir);
      } else {
        _dir.multiplyScalar(1 / d);
      }
      const mag = s / (1 + d);
      b.vel.addScaledVector(_dir, mag);
      randUnit(_rand).multiplyScalar(a);
      b.angVel.add(_rand);
    }
  },
};
