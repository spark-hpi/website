import { describe, it, expect } from "vitest";
import { thresholdAlpha, maskToStrings } from "./rasterize";

describe("thresholdAlpha", () => {
  it("returns all-false for an all-transparent buffer", () => {
    const w = 4, h = 3;
    const buf = new Uint8ClampedArray(w * h * 4);
    expect(thresholdAlpha(buf, w, h, 128)).toEqual(new Array(w * h).fill(false));
  });

  it("returns true for alpha >= threshold", () => {
    const w = 2, h = 2;
    const buf = new Uint8ClampedArray(w * h * 4);
    buf[3] = 200;   // cell (0,0) alpha
    buf[4 * 3 + 3] = 128;  // cell (1,1) alpha = threshold
    const out = thresholdAlpha(buf, w, h, 128);
    expect(out).toEqual([true, false, false, true]);
  });

  it("maskToStrings renders a small visualisation", () => {
    const mask = [true, false, true, false, true, true];
    expect(maskToStrings(mask, 3, 2)).toEqual(["█·█", "·██"]);
  });
});
