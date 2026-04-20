import { describe, it, expect } from "vitest";
import { distanceTransform } from "./distanceField";

function mk(rows: string[]): { mask: boolean[]; w: number; h: number } {
  const h = rows.length;
  const w = rows[0].length;
  const mask: boolean[] = [];
  for (const r of rows) for (const ch of r) mask.push(ch === "#");
  return { mask, w, h };
}

describe("distanceTransform", () => {
  it("returns 0 for empty cells", () => {
    const { mask, w, h } = mk(["...", ".#.", "..."]);
    const dist = distanceTransform(mask, w, h);
    expect(dist[0]).toBe(0);
    expect(dist[4]).toBeGreaterThan(0); // single filled cell in center
  });

  it("center of a 5x5 filled square has larger distance than edge", () => {
    const { mask, w, h } = mk([
      "#####",
      "#####",
      "#####",
      "#####",
      "#####",
    ]);
    const dist = distanceTransform(mask, w, h);
    const edge = dist[0];       // corner
    const center = dist[2 * w + 2];
    expect(center).toBeGreaterThan(edge);
  });

  it("is monotonically non-decreasing moving inward from edge", () => {
    const { mask, w, h } = mk([
      ".....",
      ".###.",
      ".###.",
      ".###.",
      ".....",
    ]);
    const dist = distanceTransform(mask, w, h);
    const edge = dist[1 * w + 1];
    const center = dist[2 * w + 2];
    expect(center).toBeGreaterThan(edge);
  });
});
