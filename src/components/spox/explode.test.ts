import { describe, it, expect } from "vitest";
import { heroProgress, explodeFromProgress } from "./explode";

describe("heroProgress", () => {
  it("is 0 at entry, 0.5 mid, 1 at the end", () => {
    expect(heroProgress(0, 1000)).toBe(0);
    expect(heroProgress(-500, 1000)).toBe(0.5);
    expect(heroProgress(-1000, 1000)).toBe(1);
  });
  it("clamps past either end", () => {
    expect(heroProgress(200, 1000)).toBe(0); // before the section reaches the top
    expect(heroProgress(-2000, 1000)).toBe(1); // scrolled past the section
  });
  it("guards a zero/negative range (section shorter than viewport)", () => {
    expect(heroProgress(-10, 0)).toBe(0);
  });
});

describe("explodeFromProgress", () => {
  it("goes assembled, burst, reassembled", () => {
    expect(explodeFromProgress(0)).toBeCloseTo(0);
    expect(explodeFromProgress(0.5)).toBeCloseTo(1);
    expect(explodeFromProgress(1)).toBeCloseTo(0);
  });
});
