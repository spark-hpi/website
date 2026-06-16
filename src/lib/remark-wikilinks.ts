import type { Plugin } from "unified";
import type { Root, Text, Link, PhrasingContent } from "mdast";
import { visit, SKIP } from "unist-util-visit";
import { slugify } from "./slugify";

export interface ResolvedWiki {
  url: string;
  broken?: boolean;
}
export type WikiResolver = (name: string) => ResolvedWiki;

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
