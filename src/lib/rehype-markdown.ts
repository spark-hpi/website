/**
 * rehype-markdown.ts — the small rehype transforms Astro's pipeline doesn't do.
 *
 * WHAT: three rehype plugins, registered in astro.config.mjs, that shape the
 *   rendered HTML to this site's conventions:
 *     rehypeHeadingIds  — set every h1/h2/h3 `id` to slugify(text).
 *     rehypeWrapTables  — wrap each <table> in <div class="table-wrap"> (scroll).
 *     rehypeImagePaths  — rewrite `images/foo.png` → `/res/<workshop>/images/foo.png`,
 *                         turn a numeric image `title` into a max-width, and
 *                         promote a lone-image paragraph into <figure class="md-figure">.
 * WHY single slugger (the important one): Astro would otherwise id headings with
 *   github-slugger, which keeps numeric prefixes and dedupes with -1/-2 — drifting
 *   from this repo's slugify(), which wikilinks, preview keys and the scroll-spy
 *   all rely on. rehypeHeadingIds FORCES slugify() ids (overwriting any Astro set),
 *   so DOM ids, `[[Page#Heading]]` anchors and `data-preview-key`s all agree. The
 *   TOC builder mirrors this by computing ids as slugify(heading.text).
 * WHERE: src/lib/rehype-markdown.ts → astro.config.mjs `markdown.rehypePlugins`.
 *   rehypeImagePaths derives the workshop folder from the entry's file path
 *   (the second `file` arg unified passes), so it needs no per-entry option.
 */
import type { Root } from "hast";
import { visit } from "unist-util-visit";
import { slugify } from "./slugify";

export function rehypeHeadingIds() {
  return (tree: Root) => {
    visit(tree, "element", (node: any) => {
      if (!["h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName)) return;
      const text = collectText(node);
      node.properties = node.properties ?? {};
      // NOTE: GFM's footnotes section is synthesized by Astro AFTER user rehype
      // plugins run, so we never see its heading here — its id is Astro's default.
      // Unconditional: override whatever Astro's default slugger assigned so the
      // one slugger (slugify) wins. Chapter dividers keep their own id (set in
      // ChapterDivider.astro) — they're not produced here.
      node.properties.id = slugify(text);
    });
  };
}

export function rehypeWrapTables() {
  return (tree: Root) => {
    visit(tree, "element", (node: any, index: number | undefined, parent: any) => {
      if (
        node.tagName !== "table" ||
        !parent ||
        index == null ||
        parent.properties?.className?.includes("table-wrap")
      )
        return;
      parent.children.splice(index, 1, {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrap"] },
        children: [node],
      });
    });
  };
}

const FILENAME_RE = /^[^\s]+\.(png|jpe?g|gif|webp|avif|svg)$/i;

export function rehypeImagePaths() {
  return (tree: Root, file: any) => {
    const dir = workshopDirOf(file?.path ?? file?.history?.[0]);

    // Pass 1: normalize <img> src + numeric-title → max-width.
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "img") return;
      const src: string = node.properties?.src ?? "";
      if (dir && src.startsWith("images/")) {
        // public/res is a symlink to CONTENT_PATH, so the workshop's own images/
        // folder is served verbatim — no copy step.
        node.properties.src = `/res/${encodeURIComponent(dir)}/images/${src.slice("images/".length)}`;
      }
      const title: string | undefined = node.properties?.title;
      if (title && /^\d+$/.test(title)) {
        const width = Number(title);
        if (width > 0) node.properties.style = `max-width:${width}px;width:100%`;
        delete node.properties.title;
      }
    });

    // Pass 2: a paragraph that holds only an image → <figure> + optional caption.
    visit(tree, "element", (node: any, index: any, parent: any) => {
      if (node.tagName !== "p" || !parent || index == null) return;
      const kids = (node.children ?? []).filter(
        (c: any) => !(c.type === "text" && /^\s*$/.test(c.value)),
      );
      if (kids.length !== 1) return;
      const img = kids[0];
      if (img.type !== "element" || img.tagName !== "img") return;

      const alt: string = (img.properties?.alt ?? "").trim();
      const caption = alt && !FILENAME_RE.test(alt) ? alt : "";
      const children: any[] = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["md-img-frame"] },
          children: [img],
        },
      ];
      if (caption) {
        children.push({
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption }],
        });
      }
      parent.children[index] = {
        type: "element",
        tagName: "figure",
        properties: { className: ["md-figure"] },
        children,
      };
    });
  };
}

/** The workshop folder name = the immediate parent directory of the md file. */
function workshopDirOf(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const parts = filePath.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

function collectText(node: any): string {
  if (node.type === "text") return node.value as string;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(collectText).join("");
}
