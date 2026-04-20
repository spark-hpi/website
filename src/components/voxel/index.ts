import { AmbientLight, DirectionalLight, Matrix4, Object3D, Vector3 } from "three";
import { createScene, type SceneHandle } from "./scene";
import { applyHomeMatrices, createSolidMesh } from "./skin-solid";
import { createFrontFaceLines, createWireframeMesh } from "./skin-wireframe";
import { chooseDepthScale, voxelize, type VoxelCell } from "./voxelize";
import { distanceTransform } from "./distanceField";
import { fetchPathD, rasterizeSvgPath } from "./rasterize";
import { DEFAULTS, load as loadSettings, normalize, SETTINGS_EVENT, type VoxelSettings, type VoxelSkin, type VoxelVariant } from "./settings";
import { createVoxelBodies, makeFixedStep, stepPhysics, type VoxelBody } from "./physics";
import { attachInput } from "./input";
import { getMode, type ModeContext } from "./modes";
import { applyIdle } from "./idle";
import { watchFg } from "./theme";

export type { VoxelSettings } from "./settings";
export { DEFAULTS, load as loadSettings, save as saveSettings, SETTINGS_EVENT } from "./settings";

export interface InitOptions {
  settings?: Partial<VoxelSettings>;
  svgUrl?: string;
  budget?: number;
}

export interface VoxelHandle {
  dispose(): void;
}

type ActiveSkin =
  | { kind: "instanced"; handle: { mesh: import("three").InstancedMesh; dispose(): void; recolor(c: string): void } }
  | { kind: "lines"; handle: import("./skin-wireframe").FrontFaceLines };

function supportsWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch { return false; }
}

function forceMobileSafe(s: VoxelSettings): VoxelSettings {
  const touchOnly = typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (touchOnly && s.mode !== "explode") return { ...s, mode: "explode" };
  return s;
}

function forceReducedMotion(s: VoxelSettings): VoxelSettings {
  const rm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm && s.idle !== "still" && !localStorage.getItem("spark-voxel-idle-override")) {
    return { ...s, idle: "still" };
  }
  return s;
}

export function init(canvas: HTMLCanvasElement, options: InitOptions = {}): VoxelHandle {
  let settings: VoxelSettings = forceReducedMotion(forceMobileSafe(normalize({ ...loadSettings(), ...options.settings })));
  const svgUrl = options.svgUrl ?? "/star_monocolor.svg";
  const budget = options.budget ?? 400;
  const host = canvas.parentElement as HTMLElement;

  if (settings.variant === "liquid-glass" && !supportsWebGL2()) {
    console.warn("[voxel] liquid-glass requires WebGL2; falling back to shaded");
    settings.variant = "shaded";
  }

  const scene = createScene(canvas);

  const amb = new AmbientLight(0xffffff, 0.4);
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 4);
  scene.scene.add(amb);
  scene.scene.add(key);

  const input = attachInput(canvas, scene.camera);
  let currentMode: import("./settings").VoxelMode = settings.mode;

  let cells: VoxelCell[] = [];
  let gridW = 0, gridH = 0, gridD = 0;
  let voxelSize = 0;
  let activeRef: ActiveSkin | null = null;
  let activeSkin: VoxelSkin = settings.skin;
  let activeVariant: VoxelVariant = settings.variant;
  let posBuffer: Float32Array | null = null;
  let bodies: VoxelBody[] = [];
  let baseHomes: Vector3[] = [];
  let seeds: number[] = [];
  let t = 0;
  const ZERO = new Vector3();
  const noForce = () => ZERO;
  const fixedStep = makeFixedStep(1 / 60);

  function buildActive(): ActiveSkin {
    const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#11053b";
    if (settings.skin === "wireframe" && settings.variant === "front-face") {
      return { kind: "lines", handle: createFrontFaceLines(cells, voxelSize, fg) };
    } else if (settings.skin === "wireframe") {
      return { kind: "instanced", handle: createWireframeMesh(cells, voxelSize, settings.variant as import("./settings").VoxelWireframeVariant, fg) };
    } else {
      return { kind: "instanced", handle: createSolidMesh(cells, voxelSize, settings.variant as import("./settings").VoxelSolidVariant, fg) };
    }
  }

  function buildCtx(dt: number): ModeContext {
    return { bodies, input: input.state, root: scene.root, dt, voxelSize };
  }

  (async () => {
    const { pathD, viewBox } = await fetchPathD(svgUrl);
    const rect = canvas.getBoundingClientRect();
    const res = Math.max(10, Math.min(28, Math.round(Math.max(rect.width, 1) / 14)));
    const ratio = viewBox.h / viewBox.w;
    const gW = res;
    const gH = Math.max(1, Math.round(res * ratio));

    const { mask } = await rasterizeSvgPath(pathD, viewBox, { w: gW, h: gH });
    const dist = distanceTransform(mask, gW, gH);
    const filled = mask.filter(Boolean).length;
    const scale = chooseDepthScale(filled, budget);
    cells = voxelize(mask, dist, gW, gH, { minDepth: 1, maxDepth: 6, scale });
    gridW = gW; gridH = gH;
    gridD = cells.reduce((d, c) => Math.max(d, Math.abs(c.gz) * 2 + 1), 1);
    voxelSize = 2.0 / Math.max(gW, gH);

    const homes = cells.map((c) => new Vector3(
      (c.gx - gridW / 2 + 0.5) * voxelSize,
      (gridH / 2 - c.gy - 0.5) * voxelSize,
      (c.gz) * voxelSize,
    ));
    baseHomes = homes;
    seeds = cells.map((c) => c.seed);
    bodies = createVoxelBodies(homes);

    activeRef = buildActive();
    if (activeRef.kind === "instanced") {
      applyHomeMatrices(activeRef.handle.mesh, cells, voxelSize, gridW, gridH, gridD);
      scene.root.add(activeRef.handle.mesh);
    } else {
      scene.root.add(activeRef.handle.object);
    }
    activeSkin = settings.skin;
    activeVariant = settings.variant;
    posBuffer = new Float32Array(cells.length * 3);
  })();

  const frameCb = (dt: number) => {
    if (!activeRef) return;
    const active = activeRef;
    const ctx: ModeContext = buildCtx(dt);
    t += dt;
    applyIdle(settings.idle, { bodies, homes: baseHomes, seeds, voxelSize, root: scene.root, t });
    const mode = getMode(currentMode);
    mode.beforeStep?.(ctx);
    fixedStep(dt, () => {
      stepPhysics(bodies, 1 / 60, (b) => mode.force(b, ctx), { k: 40, c: 6 });
    });
    input.endFrame();
    if (active.kind === "instanced") {
      writeMatrices(active.handle.mesh, bodies);
    } else if (posBuffer) {
      for (let i = 0; i < bodies.length; i++) {
        posBuffer[i * 3 + 0] = bodies[i].pos.x;
        posBuffer[i * 3 + 1] = bodies[i].pos.y;
        posBuffer[i * 3 + 2] = bodies[i].pos.z;
      }
      active.handle.update(cells, posBuffer);
    }
  };

  scene.start(frameCb);

  function applySettings(next: VoxelSettings) {
    const oldMode = currentMode;
    settings = next;
    currentMode = next.mode;

    if (next.enabled === false) {
      canvas.style.display = "none";
      host?.removeAttribute("data-ready");
      scene.stop();
      return;
    } else {
      canvas.style.display = "";
      host?.setAttribute("data-ready", "true");
      scene.start(frameCb);
    }

    if (bodies.length && oldMode !== next.mode) {
      const ctx = buildCtx(0);
      getMode(oldMode).onExit?.(ctx);
      getMode(next.mode).onEnter?.(ctx);
    }

    if (activeRef && (activeSkin !== next.skin || activeVariant !== next.variant)) {
      if (activeRef.kind === "instanced") scene.root.remove(activeRef.handle.mesh);
      else                                scene.root.remove(activeRef.handle.object);
      activeRef.handle.dispose();
      activeRef = buildActive();
      if (activeRef.kind === "instanced") {
        applyHomeMatrices(activeRef.handle.mesh, cells, voxelSize, gridW, gridH, gridD);
        scene.root.add(activeRef.handle.mesh);
      } else {
        scene.root.add(activeRef.handle.object);
      }
      activeSkin = next.skin;
      activeVariant = next.variant;
    }
  }

  const settingsListener = (e: Event) => {
    const detail = (e as CustomEvent<VoxelSettings>).detail;
    if (detail) applySettings(detail);
  };
  document.addEventListener(SETTINGS_EVENT, settingsListener);

  const themeWatcher = watchFg((fg) => {
    if (activeRef && "recolor" in activeRef.handle) {
      activeRef.handle.recolor(fg);
    }
  });

  return {
    dispose() {
      themeWatcher.dispose();
      document.removeEventListener(SETTINGS_EVENT, settingsListener);
      input.dispose();
      if (activeRef) {
        if (activeRef.kind === "instanced") {
          scene.root.remove(activeRef.handle.mesh);
        } else {
          scene.root.remove(activeRef.handle.object);
        }
        activeRef.handle.dispose();
      }
      scene.dispose();
    },
  };
}

const _tmp = new Object3D();
function writeMatrices(m: import("three").InstancedMesh, bs: VoxelBody[]) {
  for (let i = 0; i < bs.length; i++) {
    _tmp.position.copy(bs[i].pos);
    _tmp.rotation.set(bs[i].rot.x, bs[i].rot.y, bs[i].rot.z);
    _tmp.updateMatrix();
    m.setMatrixAt(i, _tmp.matrix);
  }
  m.instanceMatrix.needsUpdate = true;
}
