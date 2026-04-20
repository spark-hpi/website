import { ACESFilmicToneMapping, Group, OrthographicCamera, PMREMGenerator, Scene, WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface SceneHandle {
  scene: Scene;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
  root: Group;
  canvas: HTMLCanvasElement;
  start(render: (dt: number) => void): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();

  // PBR transmission (glass) requires an environment to sample from — otherwise
  // MeshPhysicalMaterial with transmission renders black. RoomEnvironment is a
  // lightweight built-in soft studio that gives clean glass + real reflections.
  const pmrem = new PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  roomEnv.dispose();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const root = new Group();
  scene.add(root);

  let rafId = 0;
  let lastT = 0;
  let running = false;
  let renderCb: ((dt: number) => void) | null = null;

  function loop(t: number) {
    if (!running) return;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    renderCb?.(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  function start(cb: (dt: number) => void) {
    renderCb = cb;
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height;
    const half = 1.0;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  }

  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) start(renderCb ?? (() => {}));
      else stop();
    }
  });
  io.observe(canvas);

  function onVis() {
    if (document.visibilityState === "hidden") stop();
    else if (renderCb) start(renderCb);
  }
  document.addEventListener("visibilitychange", onVis);

  return {
    scene,
    camera,
    renderer,
    root,
    canvas,
    start,
    stop,
    resize,
    dispose() {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
