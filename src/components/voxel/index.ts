import { AmbientLight, DirectionalLight, Euler, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { createScene } from "./scene";
import { createSolidMesh } from "./skin-solid";
import { voxelize, type VoxelCell } from "./voxelize";
import { fetchPathD, rasterizeSvgPath } from "./rasterize";
import { DEFAULTS, load as loadSettings, normalize, SETTINGS_EVENT, type VoxelSettings, type VoxelEdge } from "./settings";
import { createVoxelBodies, makeFixedStep, stepPhysics, type VoxelBody } from "./physics";
import { attachInput } from "./input";
import { getMode, type ModeContext } from "./modes";
import { explodeMode } from "./modes/explode";
import { repelMode } from "./modes/repel";
import { magnetMode } from "./modes/magnet";
import { tiltMode } from "./modes/tilt";
import { gravityMode } from "./modes/gravity";
import { applyIdle } from "./idle";
import { createAutopilot } from "./autopilot";
import { watchFg } from "./theme";

export type { VoxelSettings } from "./settings";
export { DEFAULTS, load as loadSettings, save as saveSettings, SETTINGS_EVENT } from "./settings";

export interface InitOptions {
  settings?: Partial<VoxelSettings>;
  svgUrl?: string;
}

export interface VoxelHandle {
  dispose(): void;
}

const SUB = 8;

interface SolidHandle {
  mesh: InstancedMesh;
  dispose(): void;
  recolor(c: string): void;
}

interface ActiveSkin {
  interior: SolidHandle;
  boundary: SolidHandle | null;
}

const isTouchOnly = () =>
  typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches;

function forceMobileSafe(s: VoxelSettings): VoxelSettings {
  // Touch devices have no live cursor and the canvas ignores pointer events
  // (so the page can scroll), so force `repel` — the autopilot drives it.
  if (isTouchOnly() && s.mode !== "repel") return { ...s, mode: "repel" };
  return s;
}

function forceReducedMotion(s: VoxelSettings): VoxelSettings {
  const rm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm && s.idle !== "still" && !localStorage.getItem("spark-voxel-idle-override")) {
    return { ...s, idle: "still" };
  }
  return s;
}

function applyTuning(s: VoxelSettings): void {
  const k = s.strength;
  explodeMode.params!.impulseScale   = 2.2 * k;
  explodeMode.params!.angularImpulse = 3.5 * k;
  repelMode.params!.strength         = 30  * k;
  magnetMode.params!.strength        = 60  * k;
  tiltMode.params!.maxTiltY          = 0.6 * k;
  tiltMode.params!.maxTiltX          = 0.4 * k;
  gravityMode.params!.g              = s.gravity;
  gravityMode.params!.globalK        = s.stiffness;
}

export function init(canvas: HTMLCanvasElement, options: InitOptions = {}): VoxelHandle {
  let settings: VoxelSettings = forceReducedMotion(forceMobileSafe(normalize({ ...loadSettings(), ...options.settings })));
  const svgUrl = options.svgUrl ?? "/star_monocolor.svg";
  const host = canvas.parentElement as HTMLElement;

  const scene = createScene(canvas);

  const amb = new AmbientLight(0xffffff, 0.4);
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 4);
  scene.scene.add(amb);
  scene.scene.add(key);

  const input = attachInput(canvas, scene.camera);
  const autopilot = isTouchOnly() ? createAutopilot(input.state) : null;
  let currentMode: import("./settings").VoxelMode = settings.mode;

  let pathD = "";
  let viewBox = { w: 1, h: 1 };

  let cells: VoxelCell[] = [];
  let gridW = 0, gridH = 0;
  let voxelSize = 0;
  let activeRef: ActiveSkin | null = null;
  let activeResolution = settings.resolution;
  let activeEdge: VoxelEdge = settings.edge;
  let bodies: VoxelBody[] = [];
  let baseHomes: Vector3[] = [];
  let seeds: number[] = [];

  let interiorBody: Uint32Array = new Uint32Array(0);
  let boundaryBody: Uint32Array = new Uint32Array(0);
  let boundaryLocal: Float32Array = new Float32Array(0);

  let t = 0;
  const fixedStep = makeFixedStep(1 / 60);

  applyTuning(settings);

  function buildVoxelSkin(): { interior: SolidHandle; boundary: SolidHandle | null } {
    const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#11053b";
    const carved = settings.edge === "carved";
    const interiorCount = carved ? interiorBody.length : cells.length;
    const boundaryCount = carved ? boundaryBody.length : 0;
    const subSize = voxelSize / SUB;

    const interior = createSolidMesh(interiorCount, voxelSize, fg);
    const boundary = boundaryCount > 0
      ? createSolidMesh(boundaryCount, subSize, fg)
      : null;
    return { interior, boundary };
  }

  function attachActive(a: ActiveSkin) {
    scene.root.add(a.interior.mesh);
    if (a.boundary) scene.root.add(a.boundary.mesh);
  }
  function detachActive(a: ActiveSkin) {
    scene.root.remove(a.interior.mesh);
    if (a.boundary) scene.root.remove(a.boundary.mesh);
  }
  function disposeActive(a: ActiveSkin) {
    a.interior.dispose();
    a.boundary?.dispose();
  }

  function buildCtx(dt: number): ModeContext {
    return { bodies, input: input.state, root: scene.root, dt, voxelSize };
  }

  async function rebuildVoxels(res: number, edge: VoxelEdge): Promise<void> {
    if (!pathD) {
      const p = await fetchPathD(svgUrl);
      pathD = p.pathD;
      viewBox = p.viewBox;
    }
    const ratio = viewBox.h / viewBox.w;
    const gW = res;
    const gH = Math.max(1, Math.round(res * ratio));

    const fineW = gW * SUB;
    const fineH = gH * SUB;
    const { mask: fineMask } = await rasterizeSvgPath(pathD, viewBox, { w: fineW, h: fineH });

    const vs = 2.0 / Math.max(gW, gH);
    cells = voxelize(fineMask, gW, gH, { voxelSize: vs, sub: SUB });

    gridW = gW; gridH = gH;
    voxelSize = vs;

    baseHomes = cells.map((c) => new Vector3(
      (c.gx - gridW / 2 + 0.5) * voxelSize,
      (gridH / 2 - c.gy - 0.5) * voxelSize,
      (c.gz) * voxelSize,
    ));
    seeds = cells.map((c) => c.seed);
    bodies = createVoxelBodies(baseHomes);

    const carved = edge === "carved";
    const interiorIdx: number[] = [];
    const boundaryCellOf: number[] = [];
    const boundaryOffsets: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!carved || c.kind === "interior") {
        interiorIdx.push(i);
      } else if (c.subOffsets) {
        const n = c.subOffsets.length / 3;
        for (let k = 0; k < n; k++) {
          boundaryCellOf.push(i);
          boundaryOffsets.push(
            c.subOffsets[k * 3 + 0],
            c.subOffsets[k * 3 + 1],
            c.subOffsets[k * 3 + 2],
          );
        }
      } else {
        interiorIdx.push(i);
      }
    }
    interiorBody = Uint32Array.from(interiorIdx);
    boundaryBody = Uint32Array.from(boundaryCellOf);
    boundaryLocal = Float32Array.from(boundaryOffsets);

    const { interior, boundary } = buildVoxelSkin();
    const next: ActiveSkin = { interior, boundary };
    if (activeRef) {
      detachActive(activeRef);
      disposeActive(activeRef);
    }
    activeRef = next;
    attachActive(next);

    activeResolution = res;
    activeEdge = edge;
  }

  void rebuildVoxels(settings.resolution, settings.edge);

  const _tmp = new Object3D();
  const _bodyMat = new Matrix4();
  const _subMat = new Matrix4();
  const _finalMat = new Matrix4();
  const _quat = new Quaternion();
  const _euler = new Euler();
  const _one = new Vector3(1, 1, 1);
  const _pos = new Vector3();

  const frameCb = (dt: number) => {
    t += dt;
    if (!activeRef) return;

    const active = activeRef;
    const ctx: ModeContext = buildCtx(dt);
    autopilot?.step(dt); // ghost-swipe the synthetic cursor on touch devices
    applyIdle(settings.idle, { bodies, homes: baseHomes, seeds, voxelSize, root: scene.root, t });
    const mode = getMode(currentMode);
    mode.beforeStep?.(ctx);
    fixedStep(dt, () => {
      stepPhysics(bodies, 1 / 60, (b) => mode.force(b, ctx), {
        k: settings.stiffness,
        c: settings.damping,
        mass: settings.mass,
      });
    });
    input.endFrame(dt);

    const im = active.interior.mesh;
    for (let i = 0; i < interiorBody.length; i++) {
      const b = bodies[interiorBody[i]];
      _tmp.position.copy(b.pos);
      _tmp.rotation.set(b.rot.x, b.rot.y, b.rot.z);
      _tmp.updateMatrix();
      im.setMatrixAt(i, _tmp.matrix);
    }
    im.instanceMatrix.needsUpdate = true;

    if (active.boundary) {
      const bm = active.boundary.mesh;
      for (let i = 0; i < boundaryBody.length; i++) {
        const b = bodies[boundaryBody[i]];
        _euler.set(b.rot.x, b.rot.y, b.rot.z);
        _quat.setFromEuler(_euler);
        _bodyMat.compose(b.pos, _quat, _one);
        _pos.set(boundaryLocal[i * 3 + 0], boundaryLocal[i * 3 + 1], boundaryLocal[i * 3 + 2]);
        _subMat.makeTranslation(_pos.x, _pos.y, _pos.z);
        _finalMat.multiplyMatrices(_bodyMat, _subMat);
        bm.setMatrixAt(i, _finalMat);
      }
      bm.instanceMatrix.needsUpdate = true;
    }
  };

  scene.start(frameCb);

  function applySettings(next: VoxelSettings) {
    const oldMode = currentMode;
    settings = next;
    currentMode = next.mode;
    applyTuning(next);

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

    if (next.resolution !== activeResolution || next.edge !== activeEdge) {
      void rebuildVoxels(next.resolution, next.edge);
    }
  }

  const settingsListener = (e: Event) => {
    const detail = (e as CustomEvent<VoxelSettings>).detail;
    if (detail) applySettings(detail);
  };
  document.addEventListener(SETTINGS_EVENT, settingsListener);

  const themeWatcher = watchFg((fg) => {
    if (!activeRef) return;
    activeRef.interior.recolor(fg);
    activeRef.boundary?.recolor(fg);
  });

  return {
    dispose() {
      themeWatcher.dispose();
      document.removeEventListener(SETTINGS_EVENT, settingsListener);
      input.dispose();
      if (activeRef) {
        detachActive(activeRef);
        disposeActive(activeRef);
      }
      scene.dispose();
    },
  };
}
