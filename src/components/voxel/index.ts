import { AmbientLight, DirectionalLight, Matrix4, Object3D, Vector3 } from "three";
import { createScene, type SceneHandle } from "./scene";
import { applyHomeMatrices, createSolidMesh } from "./skin-solid";
import { chooseDepthScale, voxelize, type VoxelCell } from "./voxelize";
import { distanceTransform } from "./distanceField";
import { fetchPathD, rasterizeSvgPath } from "./rasterize";
import { DEFAULTS, load as loadSettings, normalize, type VoxelSettings } from "./settings";
import { createVoxelBodies, makeFixedStep, stepPhysics, type VoxelBody } from "./physics";

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

export function init(canvas: HTMLCanvasElement, options: InitOptions = {}): VoxelHandle {
  const settings: VoxelSettings = normalize({ ...loadSettings(), ...options.settings });
  const svgUrl = options.svgUrl ?? "/star_monocolor.svg";
  const budget = options.budget ?? 400;

  const scene = createScene(canvas);

  const amb = new AmbientLight(0xffffff, 0.4);
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 4);
  scene.scene.add(amb);
  scene.scene.add(key);

  let cells: VoxelCell[] = [];
  let gridW = 0, gridH = 0, gridD = 0;
  let voxelSize = 0;
  let mesh: ReturnType<typeof createSolidMesh> | null = null;
  let bodies: VoxelBody[] = [];
  const ZERO = new Vector3();
  const noForce = () => ZERO;
  const fixedStep = makeFixedStep(1 / 60);

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
    bodies = createVoxelBodies(homes);

    const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#11053b";
    const m = createSolidMesh(cells, voxelSize, "flat", fg);
    applyHomeMatrices(m.mesh, cells, voxelSize, gridW, gridH, gridD);
    scene.root.add(m.mesh);
    mesh = m;
  })();

  scene.start((dt) => {
    if (!mesh) return;
    fixedStep(dt, () => {
      stepPhysics(bodies, 1 / 60, noForce, { k: 40, c: 6 });
    });
    writeMatrices(mesh.mesh, bodies);
  });

  return {
    dispose() {
      if (mesh) {
        scene.root.remove(mesh.mesh);
        mesh.dispose();
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
