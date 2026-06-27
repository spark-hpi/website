/**
 * copy-images.ts — make workshop images available to the built site.
 *
 * Responsibility: mirror each workshop's images/ folder from CONTENT_PATH into
 *   this project's public/images/<workshop>/ so the markdown's image links
 *   resolve. Runs once at config-evaluation time (called from astro.config.mjs);
 *   public/images/ is gitignored because it is regenerated every build.
 * Gotcha: this wipes and rewrites public/images on each run — don't hand-edit it.
 */
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export function copyImages(contentPath: string, projectRoot: string): void {
  const publicImages = join(projectRoot, "public", "images");
  if (existsSync(publicImages))
    rmSync(publicImages, { recursive: true, force: true });
  mkdirSync(publicImages, { recursive: true });

  // Root-level images/ (legacy flat layout)
  const rootImages = join(contentPath, "images");
  if (existsSync(rootImages)) {
    cpSync(rootImages, publicImages, { recursive: true });
  }

  // Per-workshop subdirectory: CONTENT_PATH/<workshopDir>/images/ → public/images/<workshopDir>/
  for (const entry of readdirSync(contentPath)) {
    const abs = join(contentPath, entry);
    if (!statSync(abs).isDirectory()) continue;
    const imgSrc = join(abs, "images");
    if (!existsSync(imgSrc)) continue;
    const imgDst = join(publicImages, entry);
    mkdirSync(imgDst, { recursive: true });
    cpSync(imgSrc, imgDst, { recursive: true });
  }
}
