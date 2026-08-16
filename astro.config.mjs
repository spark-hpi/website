// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import "dotenv/config";
import { unified } from "@astrojs/markdown-remark";
import { loadContent } from "./src/lib/load-content.ts";
import {
  buildWikiResolver,
  remarkWikilinks,
} from "./src/lib/remark-wikilinks.ts";
import rehypeCallouts from "rehype-callouts";
import {
  rehypeHeadingIds,
  rehypeWrapTables,
  rehypeImagePaths,
} from "./src/lib/rehype-markdown.ts";
import { rehypeLinkPreviewKeys } from "./src/lib/rehype-link-preview-keys.ts";
import {
  checkWikilinks,
  formatWikilinkIssues,
} from "./src/lib/wikilink-report.ts";

/*
 * astro.config.mjs — wires the native markdown pipeline + content sync.
 *
 * One config-time side effect: we build the wikilink resolver from a one-shot
 * synchronous fs scan (loadContent → hierarchy). This HAS to happen here: remark
 * plugins are registered before the content collection exists, so the resolver
 * can't read the collection. It reuses the same pure buildHierarchy as everything
 * else, so Node → url stays single-source. Trade-off: the resolver is captured
 * once at config eval; restart `astro dev` after adding/renaming pages.
 *
 * Images are NOT copied anywhere: `public/res` is a symlink to the docs checkout
 * (CONTENT_PATH), so a workshop's images ship as-is at /res/<workshop>/images/.
 *
 * markdown settings worth knowing:
 *  - remark/rehype plugins go through markdown.processor: unified({...}) since
 *    markdown.remarkPlugins/rehypePlugins are deprecated in Astro 6.
 *  - smartypants: false  — keep straight quotes/dashes (matches the old pipeline).
 *  - syntaxHighlight: shiki with BOTH github themes and defaultColor: false, so
 *    every token carries --shiki-light/--shiki-dark and global.css picks the side
 *    that matches the active theme. That replaces a hand-pasted highlight.js
 *    stylesheet; the copy button keys off `pre.astro-code > code`.
 */

const CONTENT_PATH = process.env.CONTENT_PATH;

const hierarchy = CONTENT_PATH ? loadContent(CONTENT_PATH).hierarchy : null;
const resolver = hierarchy
  ? buildWikiResolver(hierarchy)
  : () => ({ broken: "page", url: "" });

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

/*
 * Build-time wikilink check. Runs off the same one-shot fs scan as the resolver
 * (NOT off the rendered output — Astro caches rendered entries, so a plugin-side
 * report would come back falsely clean on incremental builds). Reported once at
 * config:done, so dev and build both see it; WIKILINK_STRICT=1 fails the build.
 */
function wikilinkReport() {
  return {
    name: "wikilink-report",
    hooks: {
      "astro:config:done": ({ logger }) => {
        const issues = hierarchy
          ? checkWikilinks(hierarchy.byFilename.values(), resolver)
          : [];
        if (issues.length === 0) {
          logger.info("all wikilink targets resolve");
          return;
        }
        const summary = `${issues.length} broken wikilink(s):\n${formatWikilinkIssues(issues)}`;
        if (process.env.WIKILINK_STRICT) throw new Error(summary);
        logger.warn(summary);
      },
    },
  };
}

/*
 * Obsidian callouts (`> [!warning] Title`), via rehype-callouts.
 *
 * The tags/props below pin the emitted markup to what src/styles/global.css has
 * always styled — <aside class="callout callout-TYPE" data-callout="TYPE"> with
 * a .callout-title row — so the plugin swap is invisible in the page. Indicators
 * are off because the icon is a Departure Mono glyph drawn by CSS
 * (.callout-title::before), not an inline SVG.
 *
 * A `+`/`-` fold marker now produces a real <details>; the container classes are
 * the same, so it picks up the same styling.
 */
const calloutOptions = {
  theme: "obsidian",
  showIndicator: false,
  tags: {
    nonCollapsibleContainerTagName: "aside",
    nonCollapsibleTitleTagName: "div",
    contentTagName: "div",
    titleTextTagName: "span",
  },
  props: {
    containerProps: (_node, type) => ({
      className: ["callout", `callout-${type}`],
      "data-callout": type,
    }),
    titleProps: { className: ["callout-title"] },
    titleTextProps: { className: ["callout-label"] },
    contentProps: { className: ["callout-content"] },
  },
};

// https://astro.build/config
export default defineConfig({
  site: "https://spark-hpi.de",
  integrations: [sitemap(), wikilinkReport()],
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      // No default color: emit both themes as CSS variables and let global.css
      // choose, so a theme switch needs no re-render.
      defaultColor: false,
    },
    processor: unified({
      smartypants: false,
      remarkPlugins: [[remarkWikilinks, { resolver }]],
      rehypePlugins: [
        [rehypeCallouts, calloutOptions],
        rehypeHeadingIds,
        rehypeWrapTables,
        rehypeImagePaths,
        [rehypeLinkPreviewKeys, { resolvePageBase }],
      ],
    }),
  },
});
