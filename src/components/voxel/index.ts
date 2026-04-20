export { type VoxelSettings, type VoxelMode, type VoxelSkin, type VoxelVariant, type VoxelIdle, DEFAULTS, load as loadSettings, save as saveSettings, SETTINGS_EVENT } from "./settings";

export interface InitOptions {
  settings?: Partial<import("./settings").VoxelSettings>;
}

export interface VoxelHandle {
  dispose(): void;
}

export function init(_canvas: HTMLCanvasElement, _options: InitOptions = {}): VoxelHandle {
  return { dispose() {} };
}
