import { Vector3 } from "three";
import type { Mode, ModeContext } from "./index";

const ZERO = new Vector3();

function moveBoost(speed: number): number {
  return 0.35 + 2.25 * (speed / (speed + 1.2));
}

export const tiltMode: Mode = {
  params: { maxTiltY: 0.6, maxTiltX: 0.4, smoothing: 0.1 },
  force: () => ZERO,
  beforeStep(ctx: ModeContext) {
    const boost = ctx.input.cursorWorld ? moveBoost(ctx.input.cursorSpeed) : 1;
    const targetY = ctx.input.cursorWorld ? ctx.input.cursorWorld.x * this.params!.maxTiltY * boost : 0;
    const targetX = ctx.input.cursorWorld ? -ctx.input.cursorWorld.y * this.params!.maxTiltX * boost : 0;
    ctx.root.rotation.y += (targetY - ctx.root.rotation.y) * this.params!.smoothing;
    ctx.root.rotation.x += (targetX - ctx.root.rotation.x) * this.params!.smoothing;
  },
  onExit(ctx) {
    ctx.root.rotation.set(0, 0, 0);
  },
};
