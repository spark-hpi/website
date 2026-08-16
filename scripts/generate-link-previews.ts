/**
 * generate-link-previews.ts — fetch OpenGraph metadata for external links and
 * update the committed src/data/link-previews.json cache.
 *
 * Run via `bun run generate-link-previews`. This is deliberately kept out of
 * dev/build (src/lib/previews.ts's buildPreviewMap is cache-only) so `astro dev`
 * and `astro build` never block on network requests.
 */
import "dotenv/config";
import { loadContent } from "../src/lib/load-content";
import { generateLinkPreviews } from "../src/lib/previews";

const { hierarchy } = loadContent();
await generateLinkPreviews(hierarchy);
console.log("Updated src/data/link-previews.json");
