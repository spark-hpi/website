import { Camera, Plane, Raycaster, Vector2, Vector3 } from "three";

/**
 * Maps a pointer event to a world-space point on the Z=0 plane.
 * Returns null if the ray doesn't intersect (shouldn't happen with ortho).
 */
export function pointerToWorldOnZ0(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  camera: Camera,
): Vector3 | null {
  const rect = canvas.getBoundingClientRect();
  const ndc = new Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const rc = new Raycaster();
  rc.setFromCamera(ndc, camera);
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const ok = rc.ray.intersectPlane(plane, hit);
  return ok ? hit : null;
}
