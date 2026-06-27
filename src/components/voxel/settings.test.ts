import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULTS, load, save, normalize, type VoxelSettings } from "./settings";

function mockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  } as unknown as Storage;
}

describe("settings", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = mockLocalStorage();
  });

  it("DEFAULTS has the expected shape", () => {
    expect(DEFAULTS.enabled).toBe(true);
    expect(DEFAULTS.mode).toBe("repel");
    expect(DEFAULTS.variant).toBe("solid");
    expect(DEFAULTS.idle).toBe("still");
  });

  it("load returns DEFAULTS when storage is empty", () => {
    expect(load()).toEqual(DEFAULTS);
  });

  it("save then load round-trips", () => {
    const s: VoxelSettings = { ...DEFAULTS, mode: "tilt", idle: "still" };
    save(s);
    expect(load()).toEqual(s);
  });

  it("load falls back to DEFAULTS on invalid JSON", () => {
    localStorage.setItem("spark-voxel-settings", "not json");
    expect(load()).toEqual(DEFAULTS);
  });

  it("normalize fills missing keys with DEFAULTS", () => {
    const partial = { mode: "tilt" as const };
    const full = normalize(partial);
    expect(full.mode).toBe("tilt");
    expect(full.variant).toBe(DEFAULTS.variant);
    expect(full.enabled).toBe(DEFAULTS.enabled);
  });

  it("normalize rejects invalid enum values", () => {
    const bad = { mode: "nope" as unknown as VoxelSettings["mode"] };
    expect(normalize(bad).mode).toBe(DEFAULTS.mode);
  });

  it("normalize rejects invalid variant values", () => {
    expect(normalize({ variant: "crosshatch" as unknown as VoxelSettings["variant"] }).variant).toBe(DEFAULTS.variant);
  });
});
