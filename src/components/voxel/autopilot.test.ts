import { describe, it, expect } from "vitest";
import { createAutopilot } from "./autopilot";
import type { InputState } from "./input";

function makeState(): InputState {
  return {
    cursorWorld: null,
    justClicked: false,
    lastClickWorld: null,
    cursorSpeed: 0,
    lastClickSpeed: 0,
  };
}

describe("autopilot", () => {
  it("waits before the first swipe, then drives a moving cursor with speed", () => {
    const state = makeState();
    const ap = createAutopilot(state);

    ap.step(0.1); // still within the ~0.8s initial wait
    expect(state.cursorWorld).toBeNull();

    // advance past the initial wait — a swipe should begin
    for (let i = 0; i < 10; i++) ap.step(0.1);
    expect(state.cursorWorld).not.toBeNull();
    expect(state.cursorSpeed).toBeGreaterThan(0);
  });

  it("ends a swipe (cursor back to null) after its duration, then idles", () => {
    const state = makeState();
    const ap = createAutopilot(state);
    // run well past first wait + max swipe duration (0.8 + 0.85)
    for (let i = 0; i < 30; i++) ap.step(0.1);
    // immediately after a swipe completes we go idle with a null cursor
    let sawNullAfterMove = false;
    for (let i = 0; i < 5; i++) {
      ap.step(0.1);
      if (state.cursorWorld === null) sawNullAfterMove = true;
    }
    expect(sawNullAfterMove).toBe(true);
  });
});
