import { Vector3 } from "three";
import type { InputState } from "./input";

/**
 * autopilot.ts — drives the `repel` mode on touch devices.
 *
 * On mobile the canvas is non-interactive (pointer-events: none, so the page
 * still scrolls), which leaves the star dead. This injects a synthetic cursor
 * that sweeps across the star at random intervals — a "ghost swipe" — so the
 * spark stays alive without ever capturing a touch.
 *
 * It writes straight into the shared InputState that `repelMode.force()` reads;
 * no new physics. Call `step(dt)` once per frame, before the mode's force runs.
 */
export interface Autopilot {
  step(dt: number): void;
}

// World extents: the star is normalized into roughly x,y ∈ [-1, 1]. A radius of
// 1.5 starts/ends each swipe just outside the silhouette so it reads as a pass.
const R = 1.5;

export function createAutopilot(state: InputState): Autopilot {
  const start = new Vector3();
  const end = new Vector3();
  const cur = new Vector3();
  let swiping = false;
  let elapsed = 0;
  let duration = 0;
  let wait = 0.8; // first swipe shortly after load

  function planSwipe() {
    const a = Math.random() * Math.PI * 2; // entry angle
    const spread = (Math.random() - 0.5) * 1.4; // exit ≈ opposite, with skew
    start.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    end.set(Math.cos(a + Math.PI + spread) * R, Math.sin(a + Math.PI + spread) * R, 0);
    duration = 0.45 + Math.random() * 0.4;
    elapsed = 0;
    swiping = true;
  }

  return {
    step(dt) {
      if (!swiping) {
        wait -= dt;
        if (wait > 0) {
          state.cursorWorld = null;
          return;
        }
        planSwipe();
      }
      elapsed += dt;
      const u = Math.min(1, elapsed / duration);
      cur.lerpVectors(start, end, u);
      state.cursorWorld = cur;
      // Distance/sec along the path → feeds repel's moveBoost so the push has punch.
      state.cursorSpeed = start.distanceTo(end) / duration;
      if (u >= 1) {
        swiping = false;
        state.cursorWorld = null;
        wait = 1.5 + Math.random() * 3; // idle gap before the next swipe
      }
    },
  };
}
