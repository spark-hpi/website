import { Vector3 } from "three";
import type { VoxelBody } from "../physics";
import type { InputState } from "../input";
import type { Group } from "three";
import type { VoxelMode } from "../settings";
import { explodeMode } from "./explode";
import { repelMode } from "./repel";
import { magnetMode } from "./magnet";
import { tiltMode } from "./tilt";
import { swirlMode } from "./swirl";

export interface ModeContext {
  bodies: VoxelBody[];
  input: InputState;
  root: Group;
  dt: number;
  voxelSize: number;
}

export interface Mode {
  /** Extra per-body force. May return a shared zero vector — caller must not mutate. */
  force(b: VoxelBody, ctx: ModeContext): Vector3;
  onEnter?(ctx: ModeContext): void;
  onExit?(ctx: ModeContext): void;
  /** Mode-scoped per-frame hook (for group transforms, click impulses, etc.) */
  beforeStep?(ctx: ModeContext): void;
  params?: Record<string, number>;
}

const registry = new Map<VoxelMode, Mode>();

export function registerMode(name: VoxelMode, mode: Mode): void {
  registry.set(name, mode);
}

export function getMode(name: VoxelMode): Mode {
  const m = registry.get(name);
  if (!m) throw new Error(`Mode not registered: ${name}`);
  return m;
}

const ZERO = new Vector3();
export const noForceMode: Mode = {
  force: () => ZERO,
};
registerMode("explode", explodeMode);
registerMode("repel", repelMode);
registerMode("magnet", magnetMode);
registerMode("tilt", tiltMode);
registerMode("swirl", swirlMode);
registerMode("gravity", noForceMode);
