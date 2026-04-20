import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _out = new Vector3();

export const repelMode: Mode = {
  params: { strength: 30, radius: 0.45 },
  force(b, ctx: ModeContext) {
    _out.set(0, 0, 0);
    const cursor = ctx.input.cursorWorld;
    if (!cursor) return _out;
    const R = this.params!.radius;
    _out.subVectors(b.pos, cursor);
    const d = _out.length();
    if (d >= R || d < 1e-6) return _out.set(0, 0, 0);
    const falloff = 1 - d / R;
    _out.multiplyScalar((this.params!.strength * falloff * falloff) / d);
    return _out;
  },
};
