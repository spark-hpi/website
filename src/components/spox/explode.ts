// Scroll-to-explosion math for the Spox hero. Pure, so it's unit-tested
// in explode.test.ts.

// Scroll fraction through the hero section, clamped to [0, 1].
// rectTop: section top relative to viewport. range: section minus stage height.
export function heroProgress(rectTop: number, range: number): number {
  if (range <= 0) return 0;
  const p = -rectTop / range;
  return p <= 0 ? 0 : p > 1 ? 1 : p; // <= 0 also turns -0 into 0
}

// 0, 1, 0 across the hero: assembled, burst, reassembled.
export function explodeFromProgress(p: number): number {
  return Math.sin(p * Math.PI);
}
