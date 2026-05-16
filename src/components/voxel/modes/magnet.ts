import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _out = new Vector3();

// Scales continuous cursor effects by smoothed cursor speed.
// speed=0 → 0.35×, speed=1.2 → ~1.4×, high speed asymptote ~2.6×.
function moveBoost(speed: number): number {
  return 0.35 + 2.25 * (speed / (speed + 1.2));
}

export const magnetMode: Mode = {
  params: { strength: 60, radius: 0.6, clampInside: 0.04 },
  force(b, ctx: ModeContext) {
    _out.set(0, 0, 0);
    const cursor = ctx.input.cursorWorld;
    if (!cursor) return _out;
    const R = this.params!.radius;
    _out.subVectors(cursor, b.pos);
    const d = _out.length();
    if (d >= R || d < 1e-6) return _out.set(0, 0, 0);
    const clamp = this.params!.clampInside;
    const attenuation = d < clamp ? (d / clamp) : 1;
    const falloff = 1 - d / R;
    const boost = moveBoost(ctx.input.cursorSpeed);
    _out.multiplyScalar((this.params!.strength * falloff * attenuation * boost) / d);
    return _out;
  },
};
