import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _out = new Vector3();

function moveBoost(speed: number): number {
  return 0.35 + 2.25 * (speed / (speed + 1.2));
}

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
    const boost = moveBoost(ctx.input.cursorSpeed);
    _out.multiplyScalar((this.params!.strength * falloff * falloff * boost) / d);
    return _out;
  },
};
