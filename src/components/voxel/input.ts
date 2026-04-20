import type { Camera } from "three";
import { Vector3 } from "three";
import { pointerToWorldOnZ0 } from "./raycast";

export interface InputState {
  cursorWorld: Vector3 | null;
  justClicked: boolean;
  lastClickWorld: Vector3 | null;
}

export interface InputHandle {
  state: InputState;
  endFrame(): void;
  dispose(): void;
}

export function attachInput(canvas: HTMLCanvasElement, camera: Camera): InputHandle {
  const state: InputState = { cursorWorld: null, justClicked: false, lastClickWorld: null };

  function onMove(e: PointerEvent) {
    state.cursorWorld = pointerToWorldOnZ0(e, canvas, camera);
  }
  function onLeave() {
    state.cursorWorld = null;
  }
  function onDown(e: PointerEvent) {
    const w = pointerToWorldOnZ0(e, canvas, camera);
    state.justClicked = true;
    state.lastClickWorld = w;
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);

  return {
    state,
    endFrame() {
      state.justClicked = false;
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    },
  };
}
