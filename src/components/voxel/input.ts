import type { Camera } from "three";
import { Vector3 } from "three";
import { pointerToWorldOnZ0 } from "./raycast";

export interface InputState {
  cursorWorld: Vector3 | null;
  justClicked: boolean;
  lastClickWorld: Vector3 | null;
  /** Smoothed cursor speed in world units/sec. Decays when no pointer moves. */
  cursorSpeed: number;
  /** Snapshot of cursorSpeed at the instant of the last pointerdown. */
  lastClickSpeed: number;
}

export interface InputHandle {
  state: InputState;
  endFrame(dt: number): void;
  dispose(): void;
}

const SPEED_TAU = 0.08;

export function attachInput(canvas: HTMLCanvasElement, camera: Camera): InputHandle {
  const state: InputState = {
    cursorWorld: null,
    justClicked: false,
    lastClickWorld: null,
    cursorSpeed: 0,
    lastClickSpeed: 0,
  };

  let instSpeed = 0;
  let lastMoveT = 0;
  let lastMovePos: Vector3 | null = null;

  function onMove(e: PointerEvent) {
    const w = pointerToWorldOnZ0(e, canvas, camera);
    const now = performance.now() / 1000;
    if (lastMovePos && lastMoveT) {
      const dt = Math.max(0.008, now - lastMoveT);
      instSpeed = w.distanceTo(lastMovePos) / dt;
    }
    lastMovePos = w.clone();
    lastMoveT = now;
    state.cursorWorld = w;
  }
  function onLeave() {
    state.cursorWorld = null;
    instSpeed = 0;
    lastMovePos = null;
    lastMoveT = 0;
  }
  function onDown(e: PointerEvent) {
    const w = pointerToWorldOnZ0(e, canvas, camera);
    state.justClicked = true;
    state.lastClickWorld = w;
    state.lastClickSpeed = state.cursorSpeed;
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);

  return {
    state,
    endFrame(dt: number) {
      const alpha = 1 - Math.exp(-dt / SPEED_TAU);
      state.cursorSpeed += (instSpeed - state.cursorSpeed) * alpha;
      instSpeed *= Math.exp(-dt / SPEED_TAU);
      state.justClicked = false;
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    },
  };
}
