import {
  DoubleSide, ExtrudeGeometry, Group, Mesh, MeshPhysicalMaterial, type Shape,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export interface LiquidHandle {
  group: Group;
  update(t: number, wavy: boolean): void;
  recolor(fg: string): void;
  dispose(): void;
}

/**
 * Single extruded glass star. No synthetic backdrop — transmission samples
 * the PMREM environment + whatever is in the scene, and the canvas `alpha: true`
 * lets the real page show through unrefracted-transparent regions. A vertex
 * shader adds traveling-wave displacement so it reads as "liquid".
 */
export async function createLiquidStar(svgUrl: string, targetHeight: number): Promise<LiquidHandle> {
  const resp = await fetch(svgUrl);
  const text = await resp.text();
  const data = new SVGLoader().parse(text);

  const shapes: Shape[] = [];
  for (const path of data.paths) {
    for (const s of SVGLoader.createShapes(path)) shapes.push(s);
  }

  const geom = new ExtrudeGeometry(shapes, {
    depth: 36,
    bevelEnabled: true,
    bevelThickness: 6,
    bevelSize: 4,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const height = bb.max.y - bb.min.y;
  const scale = targetHeight / height;
  geom.translate(-cx, -cy, -cz);
  geom.scale(scale, -scale, scale);  // SVG Y down → three Y up
  geom.computeVertexNormals();

  const waveUniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: 0 },
  };

  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 0.35,
    ior: 1.52,
    roughness: 0.03,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.3,
    side: DoubleSide,
    transparent: true,
  });
  (material as unknown as { dispersion: number }).dispersion = 4.5;

  // Traveling-wave vertex displacement with analytical normals so refraction
  // directions stay physically correct.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waveUniforms.uTime;
    shader.uniforms.uWaveAmp = waveUniforms.uWaveAmp;
    shader.vertexShader =
      "uniform float uTime;\nuniform float uWaveAmp;\n" +
      shader.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `
          #include <beginnormal_vertex>
          {
            float k1 = 5.0;
            float k2 = 4.2;
            float dx = cos(position.x * k1 + uTime * 2.0) * k1 * 0.5 * uWaveAmp;
            float dy = cos(position.y * k2 - uTime * 1.4) * k2 * 0.5 * uWaveAmp;
            vec3 waveN = normalize(vec3(-dx, -dy, 1.0));
            objectNormal = normalize(mix(objectNormal, waveN, clamp(uWaveAmp * 8.0, 0.0, 1.0)));
          }
          `
        )
        .replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          {
            float k1 = 5.0;
            float k2 = 4.2;
            float s1 = sin(position.x * k1 + uTime * 2.0);
            float s2 = sin(position.y * k2 - uTime * 1.4);
            transformed.z += (s1 + s2) * 0.5 * uWaveAmp;
          }
          `
        );
  };

  const mesh = new Mesh(geom, material);
  const group = new Group();
  group.add(mesh);

  return {
    group,
    update(t, wavy) {
      waveUniforms.uTime.value = t;
      waveUniforms.uWaveAmp.value = wavy ? 0.06 : 0;
    },
    recolor(_fg) {
      // Liquid glass is intentionally colorless — no theming.
    },
    dispose() {
      geom.dispose();
      material.dispose();
    },
  };
}
