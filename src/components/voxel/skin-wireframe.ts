import {
  BufferAttribute, BufferGeometry, Color,
  InstancedMesh, LineBasicMaterial, Material, MeshBasicMaterial,
} from "three";
import type { VoxelCell } from "./voxelize";
import type { VoxelWireframeVariant } from "./settings";

export interface WireframeMesh {
  mesh: InstancedMesh;
  dispose(): void;
  setVariant(v: VoxelWireframeVariant): void;
  recolor(fg: string): void;
}

/**
 * Build a small geometry representing "8 corner dots" of a unit cube.
 * Each corner = a tiny camera-facing quad centered on the corner.
 */
function cornerDotsGeometry(size: number, dotSize: number): BufferGeometry {
  const positions: number[] = [];
  const s = size / 2;
  const d = dotSize / 2;
  const corners: [number, number, number][] = [
    [-s, -s, -s], [ s, -s, -s], [-s,  s, -s], [ s,  s, -s],
    [-s, -s,  s], [ s, -s,  s], [-s,  s,  s], [ s,  s,  s],
  ];
  for (const [cx, cy, cz] of corners) {
    positions.push(
      cx - d, cy - d, cz,
      cx + d, cy - d, cz,
      cx + d, cy + d, cz,
      cx - d, cy - d, cz,
      cx + d, cy + d, cz,
      cx - d, cy + d, cz,
    );
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return g;
}

function buildGeometry(v: VoxelWireframeVariant, voxelSize: number): BufferGeometry {
  if (v === "front-face") {
    console.warn("[voxel] front-face variant pending Task 18; falling back to corner-dots");
    return cornerDotsGeometry(voxelSize, voxelSize * 0.18);
  }
  return cornerDotsGeometry(voxelSize, voxelSize * 0.18);
}

export function createWireframeMesh(cells: VoxelCell[], voxelSize: number, variant: VoxelWireframeVariant, fg: string): WireframeMesh {
  let geometry = buildGeometry(variant, voxelSize);
  let material: Material = variant === "front-face"
    ? new LineBasicMaterial({ color: new Color(fg) })
    : new MeshBasicMaterial({ color: new Color(fg) });

  const mesh = new InstancedMesh(geometry, material, cells.length);
  mesh.count = cells.length;

  return {
    mesh,
    setVariant(v) {
      geometry.dispose();
      geometry = buildGeometry(v, voxelSize);
      mesh.geometry = geometry;
      material.dispose();
      material = v === "front-face"
        ? new LineBasicMaterial({ color: new Color(fg) })
        : new MeshBasicMaterial({ color: new Color(fg) });
      mesh.material = material;
    },
    recolor(c) {
      if ("color" in material) (material as MeshBasicMaterial).color.set(c);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
