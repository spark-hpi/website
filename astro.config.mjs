// @ts-check
import { defineConfig } from "astro/config";
import "dotenv/config";
import rehypeHighlight from "rehype-highlight";
import { unified } from "@astrojs/markdown-remark";
import { copyImages } from "./src/lib/copy-images.ts";
import { loadContent } from "./src/lib/load-content.ts";
import {
  buildWikiResolver,
  remarkWikilinks,
} from "./src/lib/remark-wikilinks.ts";
import { remarkCallouts } from "./src/lib/remark-callouts.ts";
import {
  rehypeHeadingIds,
  rehypeWrapTables,
  rehypeImagePaths,
} from "./src/lib/rehype-markdown.ts";
import { rehypeLinkPreviewKeys } from "./src/lib/rehype-link-preview-keys.ts";

/*
 * astro.config.mjs — wires the native markdown pipeline + content sync.
 *
 * Two config-time side effects:
 *  1. copyImages mirrors CONTENT_PATH/<workshop>/images → public/images/<workshop>.
 *  2. We build the wikilink resolver from a one-shot synchronous fs scan
 *     (loadContent → hierarchy). This HAS to happen here: remark plugins are
 *     registered before the content collection exists, so the resolver can't read
 *     the collection. It reuses the same pure buildHierarchy as everything else,
 *     so Node → url stays single-source. Trade-off: the resolver is captured once
 *     at config eval; restart `astro dev` after adding/renaming pages.
 *
 * markdown settings worth knowing:
 *  - remark/rehype plugins go through markdown.processor: unified({...}) since
 *    markdown.remarkPlugins/rehypePlugins are deprecated in Astro 6.
 *  - smartypants: false  — keep straight quotes/dashes (matches the old pipeline).
 *  - syntaxHighlight: false + rehypeHighlight — we keep highlight.js (`.hljs`
 *    spans) so the copy button (`pre > code.hljs`) and theme CSS keep working.
 */

const CONTENT_PATH = process.env.CONTENT_PATH;
if (CONTENT_PATH) copyImages(CONTENT_PATH, process.cwd());

const hierarchy = CONTENT_PATH ? loadContent(CONTENT_PATH).hierarchy : null;
const resolver = hierarchy
  ? buildWikiResolver(hierarchy)
  : () => ({ broken: true, url: "" });

// Map an entry's absolute file path → the URL of the page it renders on, so the
// preview-keys plugin can key same-page `#anchor` links. Content is one level
// deep, so the last two path segments ARE the hierarchy filename.
function resolvePageBase(filePath) {
  if (!hierarchy || !filePath) return undefined;
  const rel = filePath.split("/").filter(Boolean).slice(-2).join("/");
  const node = hierarchy.byFilename.get(rel);
  if (!node) return undefined;
  const root = hierarchy.byFilename.get(node.workshopRootFilename);
  return node.depth === 2 ? `/${root.slug}/${node.slug}` : `/${root.slug}`;
}

// https://astro.build/config
export default defineConfig({
  site: "https://spark-hpi.de",
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkCallouts, [remarkWikilinks, { resolver }]],
      rehypePlugins: [
        rehypeHeadingIds,
        rehypeWrapTables,
        rehypeImagePaths,
        [rehypeLinkPreviewKeys, { resolvePageBase }],
        [rehypeHighlight, { detect: true }],
      ],
    }),
  },
});
