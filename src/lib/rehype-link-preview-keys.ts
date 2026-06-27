/**
 * rehype-link-preview-keys.ts — tag links so the hover-preview script can find them.
 *
 * WHAT: a rehype plugin that stamps `data-preview-key` on every <a> whose target
 *   has an entry in the preview map (previews via extract-previews.ts). The key is
 *   the lookup string: external links key by full URL, internal links by absolute
 *   path, and same-page `#anchor` links by `<pageBase>#anchor`.
 * WHY pageBase comes from a resolver: the plugin runs inside Astro's per-entry
 *   markdown pipeline, so it learns which page it's on from the entry's file path
 *   (the `file` arg) via the `resolvePageBase` function built in astro.config.mjs
 *   from the hierarchy. (A workshop's chapters all resolve to the workshop's URL.)
 * WHERE: registered in astro.config.mjs `rehypePlugins`; the keys it writes are
 *   read by the popover script in Base.astro on hover.
 * GOTCHA: the key format here MUST match the keys extract-previews.ts generates,
 *   or the popover finds nothing and silently shows no card. The Base.astro
 *   listener only fires for `a[data-preview-key]`, so a same-page anchor with no
 *   key gets no popover — which is why we must stamp `#anchor` links here.
 */
import type { Plugin } from "unified";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

export interface LinkPreviewKeysOptions {
  /** Maps an entry's file path → the absolute URL of the page it renders on. */
  resolvePageBase?: (filePath: string | undefined) => string | undefined;
}

export const rehypeLinkPreviewKeys: Plugin<[LinkPreviewKeysOptions?], Root> = (
  opts,
) => {
  const resolvePageBase = opts?.resolvePageBase;
  return (tree, file: any) => {
    const pageBase = resolvePageBase?.(file?.path ?? file?.history?.[0]);
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !href) return;

      let key: string | null = null;
      if (/^https?:\/\//i.test(href)) {
        key = href;
      } else if (href.startsWith("/")) {
        key = href.replace(/\/$/, "") || "/";
      } else if (href.startsWith("#") && pageBase) {
        key = `${pageBase}${href}`;
      }
      if (!key) return;

      node.properties = node.properties ?? {};
      node.properties["data-preview-key"] = key;
    });
  };
};
