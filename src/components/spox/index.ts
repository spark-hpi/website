// 3D Spox hero: loads the case GLB and explodes its parts on scroll.
// Lazy-loaded by SpoxHero.astro on capable devices; transparent canvas.
// Parts by glTF index: 0 big box, 15 little box, 1 OLED, 2 LD2450,
// 3-7/10-14 BME680, 8 tray, 9 backplate.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  type Mesh,
  type MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { explodeFromProgress, heroProgress } from "./explode";

export interface SpoxHandle {
  dispose(): void;
}

interface Part {
  mesh: Mesh;
  center: Vector3; // hotspot anchor point
  dir: Vector3; // burst direction
}

const SPREAD = 0.62;
const BME = new Set([3, 4, 5, 6, 7, 10, 11, 12, 13, 14]); // move together

export function init(
  canvas: HTMLCanvasElement,
  options: { modelUrl?: string } = {},
): SpoxHandle {
  const host = canvas.closest<HTMLElement>("[data-spox-hero]")!;
  const stage = canvas.parentElement as HTMLElement;
  const hotspotEls = Array.from(
    host.querySelectorAll<HTMLElement>("[data-anchor]"),
  );
  host.dataset.ready = "true"; // reveal the section

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  const target = new Vector3(0, 0.15, 0);
  camera.position.set(0, 3.25, 1.6);
  camera.position.sub(target).multiplyScalar(0.72).add(target); // fill the frame
  camera.lookAt(target);

  scene.add(new AmbientLight(0xffffff, 0.65));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 10, 7);
  scene.add(key);
  const fill = new DirectionalLight(0x88aaff, 0.6);
  fill.position.set(-6, -3, -5);
  scene.add(fill);

  let model: Group | null = null;
  let parts: Part[] = [];

  const paint = (leaves: Mesh[], i: number, hex: number, opacity?: number) => {
    const m = ((leaves[i].material = (
      leaves[i].material as MeshStandardMaterial
    ).clone()) as MeshStandardMaterial);
    m.color.set(hex);
    if (opacity != null) {
      m.transparent = true;
      m.opacity = opacity;
    }
    return m;
  };

  new GLTFLoader().load(options.modelUrl ?? "/models/spox.glb", (gltf) => {
    model = gltf.scene;

    // fit to a ~2-unit box, recenter, lift below the title
    const pre = new Box3().setFromObject(model);
    const size = pre.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(2 / maxDim);
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    model.position.sub(box.getCenter(new Vector3()));
    model.position.y += 0.28;
    scene.add(model);
    model.updateMatrixWorld(true);

    const leaves: Mesh[] = [];
    model.traverse((o) => {
      if ((o as Mesh).isMesh) leaves.push(o as Mesh);
    });

    // part colors; everything else keeps the GLB color
    paint(leaves, 0, 0x5b7db5); // big box
    paint(leaves, 15, 0x5b7db5, 0.4); // little box, see-through
    paint(leaves, 2, 0xbababa); // LD2450
    const oled = paint(leaves, 1, 0x6b6b6b); // OLED
    oled.roughness = 0.25; // screen sheen
    oled.metalness = 0.5;

    // part centers + assembly center, in model-local units
    const assembly = new Box3();
    const centers = leaves.map((mesh) => {
      mesh.geometry.computeBoundingBox();
      const c = mesh.geometry.boundingBox!.getCenter(new Vector3());
      assembly.expandByPoint(c);
      return c;
    });
    const aCenter = assembly.getCenter(new Vector3());

    // BME680 parts slide out sideways as one unit
    const bmeCentroid = new Vector3();
    BME.forEach((i) => bmeCentroid.add(centers[i]));
    bmeCentroid.divideScalar(BME.size);
    const bmeDir = bmeCentroid.clone().sub(aCenter).setY(0);

    parts = leaves.map((mesh, i) => {
      let dir = new Vector3(); // frozen
      if (BME.has(i)) dir = bmeDir.clone();
      else if (i === 1 || i === 2) dir = centers[i].clone().sub(aCenter); // OLED, LD2450
      return { mesh, center: centers[i].clone(), dir };
    });
  });

  function resize() {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  const tmp = new Vector3();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);

    // progress over the pinned stage
    const explode = explodeFromProgress(
      heroProgress(host.getBoundingClientRect().top, host.offsetHeight - stage.offsetHeight),
    );

    for (const part of parts) {
      part.mesh.position.copy(part.dir).multiplyScalar(explode * SPREAD);
    }
    model?.updateMatrixWorld(true);

    // labels fade in with the burst
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    for (const el of hotspotEls) {
      const part = parts[Number(el.dataset.anchor)];
      if (!part) continue;
      tmp.copy(part.center);
      part.mesh.localToWorld(tmp);
      tmp.project(camera);
      if (tmp.z > 1) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        continue;
      }
      el.style.left = `${(tmp.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-tmp.y * 0.5 + 0.5) * h}px`;
      el.style.opacity = String(explode);
      el.style.pointerEvents = explode > 0.5 ? "auto" : "none";
    }

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
