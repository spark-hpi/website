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
