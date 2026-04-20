export interface VoxelSettings {
  enabled: boolean;
  mode: "explode" | "repel" | "magnet" | "tilt" | "swirl" | "gravity";
  skin: "wireframe" | "solid";
  variant: string;
  idle: "still" | "rotate" | "breathe" | "drift";
}

export interface InitOptions {
  settings?: Partial<VoxelSettings>;
}

export interface VoxelHandle {
  dispose(): void;
}

export function init(_canvas: HTMLCanvasElement, _options: InitOptions = {}): VoxelHandle {
  return { dispose() {} };
}
