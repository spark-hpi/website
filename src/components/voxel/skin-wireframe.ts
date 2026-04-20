import {
  BufferAttribute, BufferGeometry, Color,
  InstancedMesh, LineBasicMaterial, LineSegments, Material, MeshBasicMaterial,
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

function buildGeometry(_v: VoxelWireframeVariant, voxelSize: number): BufferGeometry {
  // "front-face" is handled by createFrontFaceLines (LineSegments path),
  // so createWireframeMesh only ever builds corner-dots geometry.
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

export interface FrontFaceLines {
  object: LineSegments;
  update(cells: VoxelCell[], pos: Float32Array): void;
  recolor(c: string): void;
  dispose(): void;
}

export function createFrontFaceLines(cells: VoxelCell[], voxelSize: number, fg: string): FrontFaceLines {
  const s = voxelSize / 2 * 0.9;
  const perVoxel = 8 * 3; // 4 edges × 2 vertices × (x,y,z)
  const positions = new Float32Array(cells.length * perVoxel);
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions, 3).setUsage(35048 /* DynamicDrawUsage */));
  const mat = new LineBasicMaterial({ color: new Color(fg) });
  const object = new LineSegments(geom, mat);

  function update(_cells: VoxelCell[], posXYZ: Float32Array) {
    for (let i = 0; i < _cells.length; i++) {
      const px = posXYZ[i * 3 + 0];
      const py = posXYZ[i * 3 + 1];
      const pz = posXYZ[i * 3 + 2];
      const o = i * perVoxel;
      positions[o +  0] = px - s; positions[o +  1] = py - s; positions[o +  2] = pz;
      positions[o +  3] = px + s; positions[o +  4] = py - s; positions[o +  5] = pz;
      positions[o +  6] = px + s; positions[o +  7] = py - s; positions[o +  8] = pz;
      positions[o +  9] = px + s; positions[o + 10] = py + s; positions[o + 11] = pz;
      positions[o + 12] = px + s; positions[o + 13] = py + s; positions[o + 14] = pz;
      positions[o + 15] = px - s; positions[o + 16] = py + s; positions[o + 17] = pz;
      positions[o + 18] = px - s; positions[o + 19] = py + s; positions[o + 20] = pz;
      positions[o + 21] = px - s; positions[o + 22] = py - s; positions[o + 23] = pz;
    }
    geom.attributes.position.needsUpdate = true;
  }

  return {
    object,
    update,
    recolor(c) { mat.color.set(c); },
    dispose() { geom.dispose(); mat.dispose(); },
  };
}
