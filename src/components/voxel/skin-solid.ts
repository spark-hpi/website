import {
  BoxGeometry, Color, InstancedMesh, Matrix4, MeshLambertMaterial,
  Object3D, type BufferGeometry,
} from "three";
import type { VoxelCell } from "./voxelize";

export interface VoxelMesh {
  mesh: InstancedMesh;
  dispose(): void;
  recolor(fg: string): void;
}

export function createSolidMesh(count: number, voxelSize: number, fg: string): VoxelMesh {
  const geometry: BufferGeometry = new BoxGeometry(voxelSize, voxelSize, voxelSize);
  const material = new MeshLambertMaterial({ color: new Color(fg) });
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;

  return {
    mesh,
    recolor(c) {
      material.color.set(c);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
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
