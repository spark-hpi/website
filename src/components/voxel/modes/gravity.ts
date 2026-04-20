import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _out = new Vector3();
const _toHome = new Vector3();

/**
 * Gravity tricks the global spring by adding a counter-force proportional to
 * the home-displacement, scaled by (1 - cursorInfluence). When cursor is near,
 * influence=1 → no cancellation → spring at full strength. When cursor is far,
 * influence≈0 → most of the spring is cancelled and voxels can fall.
 */
export const gravityMode: Mode = {
  params: { g: 1.5, springCancel: 0.9, globalK: 40, levitationRadius: 0.35 },
  force(b, ctx: ModeContext) {
    let influence = 0;
    if (ctx.input.cursorWorld) {
      const d = b.pos.distanceTo(ctx.input.cursorWorld);
      const R = this.params!.levitationRadius;
      influence = Math.max(0, 1 - d / R);
    }
    _out.set(0, -this.params!.g * (1 - influence), 0);
    _toHome.subVectors(b.home, b.pos).multiplyScalar(this.params!.globalK);
    _out.addScaledVector(_toHome, -this.params!.springCancel * (1 - influence));
    return _out;
  },
};
