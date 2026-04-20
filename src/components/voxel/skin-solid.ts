import {
  BoxGeometry, Color, InstancedMesh, Matrix4, MeshLambertMaterial,
  MeshPhysicalMaterial, Object3D, type BufferGeometry, type Material,
} from "three";
import type { VoxelCell } from "./voxelize";
import type { VoxelVariant } from "./settings";

export interface VoxelMesh {
  mesh: InstancedMesh;
  dispose(): void;
  setVariant(v: VoxelVariant): void;
  recolor(fg: string): void;
}

export function createSolidMesh(count: number, voxelSize: number, variant: VoxelVariant, fg: string): VoxelMesh {
  const geometry: BufferGeometry = new BoxGeometry(voxelSize, voxelSize, voxelSize);
  let activeVariant = variant;
  let material: Material = makeMaterial(variant, fg, voxelSize);
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;

  return {
    mesh,
    setVariant(v) {
      material.dispose();
      material = makeMaterial(v, fg, voxelSize);
      activeVariant = v;
      mesh.material = material;
    },
    recolor(c) {
      // Liquid glass must stay colorless — tinting it with --fg kills the refraction look.
      if (activeVariant === "liquid-glass") return;
      if ("color" in material && (material as MeshLambertMaterial).color) {
        (material as MeshLambertMaterial).color.set(c);
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function makeLiquidGlass(_fg: string, voxelSize: number): MeshPhysicalMaterial {
  // Real glass recipe: colorless, ior ~1.5, full transmission, very low roughness,
  // a clearcoat to add sharp specular highlights, and — crucially — heavy
  // dispersion so each voxel splits light into a rainbow like a miniature prism.
  // The scene MUST have `scene.environment` set (RoomEnvironment PMREM), otherwise
  // transmission samples nothing and the material renders black.
  const m = new MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: voxelSize * 2.5,
    ior: 1.52,
    roughness: 0.02,
    metalness: 0,
    attenuationColor: 0xffffff,
    attenuationDistance: 2.0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    specularIntensity: 1,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 1,
  });
  // Dispersion (Three r160+) fans the transmission lobe across the visible spectrum —
  // this is what produces the rainbow edges on refracted light.
  (m as unknown as { dispersion: number }).dispersion = 5.5;
  return m;
}

function makeMaterial(v: VoxelVariant, fg: string, voxelSize: number): Material {
  const color = new Color(fg);
  switch (v) {
    case "liquid-glass": return makeLiquidGlass(fg, voxelSize);
    case "solid":
    default:             return new MeshLambertMaterial({ color });
  }
}

/**
 * Apply per-voxel home matrices in one pass.
 */
export function applyHomeMatrices(mesh: InstancedMesh, cells: VoxelCell[], voxelSize: number, gridW: number, gridH: number, _gridD: number): void {
  const dummy = new Object3D();
  const m = new Matrix4();
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    dummy.position.set(
      (c.gx - gridW / 2 + 0.5) * voxelSize,
      (gridH / 2 - c.gy - 0.5) * voxelSize,
      (c.gz) * voxelSize,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    m.copy(dummy.matrix);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
