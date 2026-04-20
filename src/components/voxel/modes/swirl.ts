import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const _offset = new Vector3();
const _axis = new Vector3(0, 1, 0);
const _tan = new Vector3();

export const swirlMode: Mode = {
  params: { strength: 40, axisTiltScale: 0.8 },
  force(b, ctx: ModeContext) {
    _offset.subVectors(b.pos, b.home);
    if (_offset.lengthSq() < 1e-10) return _tan.set(0, 0, 0);
    _axis.set(0, 1, 0);
    if (ctx.input.cursorWorld) {
      _axis.set(ctx.input.cursorWorld.x, 1, ctx.input.cursorWorld.y)
        .multiplyScalar(this.params!.axisTiltScale)
        .normalize();
    }
    _tan.crossVectors(_axis, _offset).multiplyScalar(this.params!.strength);
    return _tan;
  },
  onEnter(ctx) {
    for (const b of ctx.bodies) {
      b.pos.x += (Math.random() - 0.5) * ctx.voxelSize * 0.3;
      b.pos.y += (Math.random() - 0.5) * ctx.voxelSize * 0.3;
    }
  },
};
