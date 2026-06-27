/**
 * remark-wikilinks.ts — render Obsidian wikilinks inside markdown.
 *
 * Responsibility: a remark plugin that rewrites the four Obsidian forms into
 *   real links/images:
 *     [[Page]]                → link to that page
 *     [[Page|shown text]]     → link with alias text
 *     [[Page#Heading]]        → link to a heading anchor on that page
 *     ![[image.png|200|cap]]  → image embed (optional width + caption)
 *   Page targets are resolved by a WikiResolver (built by buildWikiResolver in
 *   this file from the hierarchy, at config time in astro.config.mjs).
 *   Unresolved names render as <span class="broken">.
 * Gotcha: the "#Heading" anchor is slugified with the same slugify() used for
 *   heading ids — keep those two in sync (see slugify.ts).
 */
import type { Plugin } from "unified";
import type { Root, Text, Link, PhrasingContent } from "mdast";
import { visit, SKIP } from "unist-util-visit";
import { slugify } from "./slugify";

export interface ResolvedWiki {
  url: string;
  broken?: boolean;
}
export type WikiResolver = (name: string) => ResolvedWiki;

/**
 * Build the resolver from the hierarchy: a wikilink name → that Node's precomputed
 * url (routes.ts is the only thing that knows how a Node becomes a url). Unknown
 * names render as <span class="broken">. The plugin appends any #heading itself.
 */
export function buildWikiResolver(hierarchy: {
  byBasename: Map<string, { url: string }>;
}): WikiResolver {
  return (name: string) => {
    const node = hierarchy.byBasename.get(name);
    return node ? { url: node.url } : { broken: true, url: "" };
  };
}

const WIKI_RE = /(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

export const remarkWikilinks: Plugin<[{ resolver: WikiResolver }], Root> = (
  opts,
) => {
  const { resolver } = opts;

  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const value = node.value;
      WIKI_RE.lastIndex = 0;
      if (!WIKI_RE.test(value)) return;
      WIKI_RE.lastIndex = 0;

      const out: PhrasingContent[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WIKI_RE.exec(value)) !== null) {
        const [whole, bang, name, heading, alias] = match;
        const start = match.index;
        if (start > lastIndex) {
          out.push({ type: "text", value: value.slice(lastIndex, start) });
        }
        const trimmedName = name.trim();
        // Image embed. Supported alias forms:
        //   ![[file.png]]                  → filename as alt (accessibility only)
        //   ![[file.png|200]]              → width=200
        //   ![[file.png|My caption]]       → caption="My caption"
        //   ![[file.png|200|My caption]]   → both (order-agnostic)
        if (bang === "!") {
          let width: string | undefined;
          let caption: string | undefined;
          const aliasRaw = alias?.trim() ?? "";
          if (aliasRaw) {
            for (const part of aliasRaw
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)) {
              if (!width && /^\d+$/.test(part)) {
                width = part;
                continue;
              }
              if (!caption) caption = part;
            }
          }
          out.push({
            type: "image",
            url: `images/${trimmedName}`,
            alt: caption ?? trimmedName,
            title: width ?? null,
          } as any);
        } else {
          const resolved = resolver(trimmedName);
          const display = (alias ?? trimmedName).trim();
          if (resolved.broken) {
            out.push({
              type: "html",
              value: `<span class="broken">${escapeHtml(display)}</span>`,
            });
          } else {
            let url = resolved.url;
            if (heading) url += `#${slugify(heading.trim())}`;
            const link: Link = {
              type: "link",
              url,
              children: [{ type: "text", value: display }],
            };
            out.push(link);
          }
        }
        lastIndex = start + whole.length;
      }
      if (lastIndex < value.length) {
        out.push({ type: "text", value: value.slice(lastIndex) });
      }
      (parent.children as PhrasingContent[]).splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
