export type VoxelMode = "explode" | "repel" | "magnet" | "tilt" | "swirl" | "gravity";
export type VoxelSkin = "wireframe" | "solid";
export type VoxelWireframeVariant = "corner-dots" | "front-face";
export type VoxelSolidVariant = "flat" | "shaded" | "page-texture" | "crosshatch" | "halftone" | "liquid-glass";
export type VoxelVariant = VoxelWireframeVariant | VoxelSolidVariant;
export type VoxelIdle = "still" | "rotate" | "breathe" | "drift";

export interface VoxelSettings {
  enabled: boolean;
  mode: VoxelMode;
  skin: VoxelSkin;
  variant: VoxelVariant;
  idle: VoxelIdle;
}

const MODES: VoxelMode[] = ["explode", "repel", "magnet", "tilt", "swirl", "gravity"];
const SKINS: VoxelSkin[] = ["wireframe", "solid"];
const WIRE: VoxelWireframeVariant[] = ["corner-dots", "front-face"];
const SOLID: VoxelSolidVariant[] = ["flat", "shaded", "page-texture", "crosshatch", "halftone", "liquid-glass"];
const IDLES: VoxelIdle[] = ["still", "rotate", "breathe", "drift"];

export const DEFAULTS: VoxelSettings = {
  enabled: true,
  mode: "explode",
  skin: "wireframe",
  variant: "corner-dots",
  idle: "breathe",
};

const KEY = "spark-voxel-settings";

export function variantsFor(skin: VoxelSkin): VoxelVariant[] {
  return skin === "wireframe" ? [...WIRE] : [...SOLID];
}

function isMode(v: unknown): v is VoxelMode {
  return typeof v === "string" && (MODES as string[]).includes(v);
}
function isSkin(v: unknown): v is VoxelSkin {
  return typeof v === "string" && (SKINS as string[]).includes(v);
}
function isIdle(v: unknown): v is VoxelIdle {
  return typeof v === "string" && (IDLES as string[]).includes(v);
}
function defaultVariant(skin: VoxelSkin): VoxelVariant {
  return skin === "wireframe" ? "corner-dots" : "shaded";
}
function isVariantFor(skin: VoxelSkin, v: unknown): v is VoxelVariant {
  if (typeof v !== "string") return false;
  const allowed = skin === "wireframe" ? WIRE : SOLID;
  return (allowed as string[]).includes(v);
}

export function normalize(partial: Partial<VoxelSettings>): VoxelSettings {
  const enabled = typeof partial.enabled === "boolean" ? partial.enabled : DEFAULTS.enabled;
  const mode = isMode(partial.mode) ? partial.mode : DEFAULTS.mode;
  const skin = isSkin(partial.skin) ? partial.skin : DEFAULTS.skin;
  const variant = isVariantFor(skin, partial.variant) ? partial.variant : defaultVariant(skin);
  const idle = isIdle(partial.idle) ? partial.idle : DEFAULTS.idle;
  return { enabled, mode, skin, variant, idle };
}

export function load(): VoxelSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<VoxelSettings>;
    return normalize(parsed);
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(s: VoxelSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota or disabled */
  }
}

export const SETTINGS_EVENT = "spark:voxel-settings";

export function emitChange(s: VoxelSettings): void {
  document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: s }));
}
