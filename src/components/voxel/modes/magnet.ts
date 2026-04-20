import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _out = new Vector3();

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
    _out.multiplyScalar((this.params!.strength * falloff * attenuation) / d);
    return _out;
  },
};
