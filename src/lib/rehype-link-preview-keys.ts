/**
 * rehype-link-preview-keys.ts — tag links so the hover-preview script can find them.
 *
 * Responsibility: stamp a `data-preview-key` attribute on every <a> whose target
 *   has a preview. The key is the lookup into the preview map built by
 *   extract-previews.ts: external links key by their full URL, internal links by
 *   their absolute path, and same-page `#anchor` links by `/<pageSlug>#anchor`.
 * Used by: render-workshop.ts (in the render pipeline) + the popover script in
 *   Base.astro, which reads data-preview-key on hover.
 * Gotcha: the key format here MUST match the keys extract-previews.ts generates,
 *   or the popover finds nothing and silently shows no card.
 */
import type { Plugin } from "unified";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

export interface LinkPreviewKeysOptions {
  pageSlug?: string;
}

export const rehypeLinkPreviewKeys: Plugin<[LinkPreviewKeysOptions?], Root> = (
  opts,
) => {
  const pageSlug = (opts?.pageSlug ?? "").replace(/^\/+|\/+$/g, "");
  return (tree) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !href) return;

      let key: string | null = null;
      if (/^https?:\/\//i.test(href)) {
        key = href;
      } else if (href.startsWith("/")) {
        key = href.replace(/\/$/, "") || "/";
      } else if (href.startsWith("#") && pageSlug) {
        key = `/${pageSlug}${href}`;
      }
      if (!key) return;

      node.properties = node.properties ?? {};
      node.properties["data-preview-key"] = key;
    });
  };
};
