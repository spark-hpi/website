import {
  BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial,
  Object3D, ShaderMaterial, type BufferGeometry, type Material,
} from "three";
import type { VoxelCell } from "./voxelize";
import type { VoxelSolidVariant } from "./settings";
import { pageTextureVert, pageTextureFrag } from "./shaders/page-texture.glsl";

export interface VoxelMesh {
  mesh: InstancedMesh;
  dispose(): void;
  setVariant(v: VoxelSolidVariant): void;
  recolor(fg: string): void;
}

export function createSolidMesh(cells: VoxelCell[], voxelSize: number, variant: VoxelSolidVariant, fg: string): VoxelMesh {
  const geometry: BufferGeometry = new BoxGeometry(voxelSize, voxelSize, voxelSize);
  let material: Material = makeMaterial(variant, fg, voxelSize);
  const mesh = new InstancedMesh(geometry, material, cells.length);
  mesh.count = cells.length;

  return {
    mesh,
    setVariant(v) {
      material.dispose();
      material = makeMaterial(v, fg, voxelSize);
      mesh.material = material;
    },
    recolor(c) {
      if (material instanceof ShaderMaterial) {
        const u = material.uniforms.uColor;
        if (u && u.value && typeof u.value.set === "function") u.value.set(c);
      } else if ("color" in material && (material as MeshBasicMaterial).color) {
        (material as MeshBasicMaterial).color.set(c);
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function makePageTexture(fg: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor:       { value: new Color(fg) },
      uLineSpacing: { value: 0.18 },
      uLineWidth:   { value: 0.06 },
    },
    vertexShader: pageTextureVert,
    fragmentShader: pageTextureFrag,
  });
}

function makeMaterial(v: VoxelSolidVariant, fg: string, _voxelSize: number): Material {
  const color = new Color(fg);
  switch (v) {
    case "flat":         return new MeshBasicMaterial({ color });
    case "shaded":       return new MeshLambertMaterial({ color });
    case "page-texture": return makePageTexture(fg);
    default:             return new MeshBasicMaterial({ color });
  }
}

/**
 * Apply per-voxel home matrices in one pass.
 */
export function applyHomeMatrices(mesh: InstancedMesh, cells: VoxelCell[], voxelSize: number, gridW: number, gridH: number, gridD: number): void {
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
