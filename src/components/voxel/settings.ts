export type VoxelMode = "explode" | "repel" | "magnet" | "tilt" | "swirl" | "gravity";
export type VoxelVariant = "solid" | "liquid-glass";
export type VoxelIdle = "still" | "breathe";
export type VoxelEdge = "blocky" | "carved";

export interface VoxelSettings {
  enabled: boolean;
  mode: VoxelMode;
  variant: VoxelVariant;
  idle: VoxelIdle;
  edge: VoxelEdge;
  resolution: number;
  stiffness: number;
  damping: number;
  mass: number;
  strength: number;
  gravity: number;
}

export interface NumericRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const RANGES: Record<
  "resolution" | "stiffness" | "damping" | "mass" | "strength" | "gravity",
  NumericRange
> = {
  resolution: { min: 16, max: 240, step: 2, default: 120 },
  stiffness:  { min: 5,  max: 160, step: 1, default: 40 },
  damping:    { min: 0,  max: 20,  step: 0.2, default: 6 },
  mass:       { min: 0.2, max: 5,  step: 0.1, default: 1 },
  strength:   { min: 0,  max: 3,   step: 0.05, default: 1 },
  gravity:    { min: 0,  max: 10,  step: 0.1, default: 1.5 },
};

const MODES: VoxelMode[] = ["explode", "repel", "magnet", "tilt", "swirl", "gravity"];
const VARIANTS: VoxelVariant[] = ["solid", "liquid-glass"];
const IDLES: VoxelIdle[] = ["still", "breathe"];
const EDGES: VoxelEdge[] = ["blocky", "carved"];

export const DEFAULTS: VoxelSettings = {
  enabled: true,
  mode: "repel",
  variant: "solid",
  idle: "breathe",
  edge: "carved",
  resolution: RANGES.resolution.default,
  stiffness: RANGES.stiffness.default,
  damping: RANGES.damping.default,
  mass: RANGES.mass.default,
  strength: RANGES.strength.default,
  gravity: RANGES.gravity.default,
};

const KEY = "spark-voxel-settings";

export function variants(): VoxelVariant[] {
  return [...VARIANTS];
}

function isMode(v: unknown): v is VoxelMode {
  return typeof v === "string" && (MODES as string[]).includes(v);
}
function isVariant(v: unknown): v is VoxelVariant {
  return typeof v === "string" && (VARIANTS as string[]).includes(v);
}
function isIdle(v: unknown): v is VoxelIdle {
  return typeof v === "string" && (IDLES as string[]).includes(v);
}
function isEdge(v: unknown): v is VoxelEdge {
  return typeof v === "string" && (EDGES as string[]).includes(v);
}
function clampNumeric(v: unknown, r: NumericRange): number {
  if (typeof v !== "number" || !isFinite(v)) return r.default;
  return Math.max(r.min, Math.min(r.max, v));
}

export function normalize(partial: Partial<VoxelSettings>): VoxelSettings {
  const enabled = typeof partial.enabled === "boolean" ? partial.enabled : DEFAULTS.enabled;
  const mode = isMode(partial.mode) ? partial.mode : DEFAULTS.mode;
  const variant = isVariant(partial.variant) ? partial.variant : DEFAULTS.variant;
  const idle = isIdle(partial.idle) ? partial.idle : DEFAULTS.idle;
  const edge = isEdge(partial.edge) ? partial.edge : DEFAULTS.edge;
  const resolution = Math.round(clampNumeric(partial.resolution, RANGES.resolution));
  const stiffness = clampNumeric(partial.stiffness, RANGES.stiffness);
  const damping = clampNumeric(partial.damping, RANGES.damping);
  const mass = clampNumeric(partial.mass, RANGES.mass);
  const strength = clampNumeric(partial.strength, RANGES.strength);
  const gravity = clampNumeric(partial.gravity, RANGES.gravity);
  return { enabled, mode, variant, idle, edge, resolution, stiffness, damping, mass, strength, gravity };
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

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export const SETTINGS_EVENT = "spark:voxel-settings";

export function emitChange(s: VoxelSettings): void {
  document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: s }));
}
