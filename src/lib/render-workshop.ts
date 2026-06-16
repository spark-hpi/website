import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root as MdastRoot, Heading } from "mdast";
import { remarkWikilinks, type WikiResolver } from "./remark-wikilinks";
import { remarkCallouts } from "./remark-callouts";
import { rehypeLinkPreviewKeys } from "./rehype-link-preview-keys";
import { slugify, stripNumericPrefix, shortName } from "./slugify";
import type { HierNode, Hierarchy } from "./hierarchy";
import { extractToc, type TocItem } from "./extract-toc";

export function buildWikiResolver(hierarchy: Hierarchy): WikiResolver {
  return (name: string) => {
    const node = hierarchy.byBasename.get(name);
    if (!node) return { broken: true, url: "" };
    const root = hierarchy.byFilename.get(node.workshopRootFilename)!;
    const workshopSlug = slugify(
      root.title ?? stripNumericPrefix(shortName(root.filename)),
    );
    if (node.depth === 0) return { url: `/${workshopSlug}` };
    if (node.depth === 1) {
      const childSlug = slugify(
        node.title ?? stripNumericPrefix(shortName(node.filename)),
      );
      return { url: `/${workshopSlug}#${childSlug}` };
    }
    const subSlug = slugify(
      node.title ?? stripNumericPrefix(shortName(node.filename)),
    );
    return { url: `/${workshopSlug}/${subSlug}` };
  };
}

function parseMarkdown(md: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as MdastRoot;
}

function chapterHeading(title: string): Heading {
  return {
    type: "heading",
    depth: 2,
    children: [{ type: "text", value: title }],
    data: {
      hProperties: { className: ["chapter-divider"] },
    },
  };
}

function assembleWorkshopTree(workshop: HierNode): MdastRoot {
  const rootTree = parseMarkdown(workshop.rawContent ?? "");
  for (const child of workshop.children) {
    const title = child.title ?? stripNumericPrefix(shortName(child.filename));
    const childTree = parseMarkdown(child.rawContent ?? "");
    rootTree.children.push(chapterHeading(title));
    rootTree.children.push(...childTree.children);
  }
  return rootTree;
}

function countWordsInTree(tree: MdastRoot): number {
  let n = 0;
  const walk = (node: any) => {
    if (node.type === "text" && typeof node.value === "string") {
      n += node.value.split(/\s+/).filter(Boolean).length;
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  return n;
}

function wrapTables() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index: number, parent: any) => {
      if (
        node.tagName !== "table" ||
        !parent ||
        parent.properties?.className?.includes("table-wrap")
      )
        return;
      const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrap"] },
        children: [node],
      };
      parent.children.splice(index, 1, wrapper);
    });
  };
}

const FILENAME_RE = /^[^\s]+\.(png|jpe?g|gif|webp|avif|svg)$/i;

function transformImages(workshopDir: string | undefined) {
  return (tree: any) => {
    // Pass 1: normalize img nodes (src + width style from title attribute).
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "img") return;
      const src: string = node.properties?.src ?? "";
      if (workshopDir && src.startsWith("images/")) {
        node.properties.src = `/images/${encodeURIComponent(workshopDir)}/${src.slice("images/".length)}`;
      }
      const title: string | undefined = node.properties?.title;
      if (title && /^\d+$/.test(title)) {
        const width = Number(title);
        if (width > 0)
          node.properties.style = `max-width:${width}px;width:100%`;
        delete node.properties.title;
      }
    });

    // Pass 2: promote paragraphs containing only an image to <figure> with optional caption.
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
      const frame = {
        type: "element",
        tagName: "span",
        properties: { className: ["md-img-frame"] },
        children: [img],
      };
      const children: any[] = [frame];
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

function addHeadingIds() {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (!node.tagName || !["h1", "h2", "h3"].includes(node.tagName)) return;
      const text = (node.children ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.value)
        .join("");
      node.properties = node.properties ?? {};
      if (!node.properties.id) {
        node.properties.id = slugify(text);
      }
    });
  };
}

export interface LinkedPage {
  title: string;
  url: string;
  parentTitle?: string;
  headings: TocItem[];
}

export interface RenderedWorkshop {
  html: string;
  toc: TocItem[];
  glossary: LinkedPage[];
  wordCount: number;
  pageCount: number;
}

const WIKI_NAME_RE = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const GLOSSARY_RE = /^glossary$/i;
const HEADING_LINE_RE = /^(#{1,3})\s+(.+?)\s*$/;

function extractSubheadings(
  raw: string | undefined,
  baseUrl: string,
): TocItem[] {
  if (!raw) return [];
  const out: TocItem[] = [];
  let inFence = false;
  for (const line of raw.split("\n")) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_LINE_RE.exec(line);
    if (!m) continue;
    const depth = m[1].length;
    const text = m[2].replace(/\s*#+\s*$/, "").trim();
    if (!text) continue;
    out.push({
      tier: `h${depth}` as "h1" | "h2" | "h3",
      id: "",
      text,
      href: `${baseUrl}#${slugify(text)}`,
    });
  }
  return out;
}

function nodeUrl(target: HierNode, hierarchy: Hierarchy): string {
  const root = hierarchy.byFilename.get(target.workshopRootFilename)!;
  const rootSlug = slugify(
    root.title ?? stripNumericPrefix(shortName(root.filename)),
  );
  const targetSlug = slugify(
    target.title ?? stripNumericPrefix(shortName(target.filename)),
  );
  if (target.depth === 0) return `/${rootSlug}`;
  if (target.depth === 1) return `/${rootSlug}#${targetSlug}`;
  return `/${rootSlug}/${targetSlug}`;
}

function collectLinkedPages(
  sources: Array<string | undefined>,
  excludeFilenames: Set<string>,
  hierarchy: Hierarchy,
): LinkedPage[] {
  const seen = new Set<string>();
  const out: LinkedPage[] = [];
  for (const raw of sources) {
    if (!raw) continue;
    WIKI_NAME_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKI_NAME_RE.exec(raw)) !== null) {
      const name = m[1].trim();
      const target = hierarchy.byBasename.get(name);
      if (!target) continue;
      if (excludeFilenames.has(target.filename)) continue;
      if (seen.has(target.filename)) continue;
      seen.add(target.filename);
      const title =
        target.title ?? stripNumericPrefix(shortName(target.filename));
      const parent = target.parent;
      const parentTitle = parent
        ? (parent.title ?? stripNumericPrefix(shortName(parent.filename)))
        : undefined;
      const url = nodeUrl(target, hierarchy);
      const headings = extractSubheadings(target.rawContent, url);
      out.push({ title, url, parentTitle, headings });
    }
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

function integrateLinkedIntoToc(
  toc: TocItem[],
  linked: LinkedPage[],
): TocItem[] {
  if (linked.length === 0) return toc;
  const byChapter = new Map<string, LinkedPage[]>();
  const trailing: LinkedPage[] = [];
  for (const p of linked) {
    if (p.parentTitle) {
      const arr = byChapter.get(p.parentTitle) ?? [];
      arr.push(p);
      byChapter.set(p.parentTitle, arr);
    } else {
      trailing.push(p);
    }
  }
  const out: TocItem[] = [];
  let currentChapter: string | null = null;
  const flush = () => {
    if (!currentChapter) return;
    const pages = byChapter.get(currentChapter);
    if (!pages) return;
    for (const p of pages) {
      out.push({
        tier: "h1",
        id: "",
        text: p.title,
        href: p.url,
        children: p.headings,
      });
    }
    byChapter.delete(currentChapter);
  };
  for (const item of toc) {
    if (item.tier === "chapter") {
      flush();
      currentChapter = item.text;
    }
    out.push(item);
  }
  flush();
  // Any linked pages whose parent didn't match a chapter heading: append.
  for (const pages of byChapter.values()) {
    for (const p of pages) {
      out.push({
        tier: "h1",
        id: "",
        text: p.title,
        href: p.url,
        children: p.headings,
      });
    }
  }
  for (const p of trailing) {
    out.push({ tier: "h1", id: "", text: p.title, href: p.url });
  }
  return out;
}

function workshopDir(filename: string): string | undefined {
  const slash = filename.indexOf("/");
  return slash !== -1 ? filename.slice(0, slash) : undefined;
}

export async function renderWorkshop(
  workshop: HierNode,
  hierarchy: Hierarchy,
): Promise<RenderedWorkshop> {
  const resolver = buildWikiResolver(hierarchy);
  const dir = workshopDir(workshop.filename);
  const tree = assembleWorkshopTree(workshop);
  const pageSlug = slugify(
    workshop.title ?? stripNumericPrefix(shortName(workshop.filename)),
  );

  const processor = unified()
    .use(remarkGfm)
    .use(remarkCallouts)
    .use(remarkWikilinks, { resolver })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(addHeadingIds)
    .use(wrapTables)
    .use(transformImages, dir)
    .use(rehypeLinkPreviewKeys, { pageSlug })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const hast = await processor.run(tree as any);
  const html = processor.stringify(hast) as string;
  const rawToc = extractToc(hast as any);
  const wordCount = countWordsInTree(tree);
  const pageCount = 1 + workshop.children.length;
  // Exclude the workshop itself and its direct chapter children (those are
  // already inlined as chapters in the body). Grandchildren (depth-2
  // subpages like "proxmox") live at their own URLs and flow into the TOC
  // beneath their parent chapter.
  const exclude = new Set<string>([workshop.filename]);
  for (const c of workshop.children) exclude.add(c.filename);
  const linkedPages = collectLinkedPages(
    [workshop.rawContent, ...workshop.children.map((c) => c.rawContent)],
    exclude,
    hierarchy,
  );
  const glossary = linkedPages.filter((p) => GLOSSARY_RE.test(p.title));
  const regular = linkedPages.filter((p) => !GLOSSARY_RE.test(p.title));
  const toc = integrateLinkedIntoToc(rawToc, regular);
  return { html, toc, glossary, wordCount, pageCount };
}

export async function renderSubpage(
  page: HierNode,
  hierarchy: Hierarchy,
): Promise<RenderedWorkshop> {
  const resolver = buildWikiResolver(hierarchy);
  const md = page.rawContent ?? "";
  const dir = workshopDir(page.filename);
  const tree = parseMarkdown(md);
  const root = hierarchy.byFilename.get(page.workshopRootFilename)!;
  const wsSlug = slugify(
    root.title ?? stripNumericPrefix(shortName(root.filename)),
  );
  const subSlug = slugify(
    page.title ?? stripNumericPrefix(shortName(page.filename)),
  );
  const pageSlug = `${wsSlug}/${subSlug}`;

  const processor = unified()
    .use(remarkGfm)
    .use(remarkCallouts)
    .use(remarkWikilinks, { resolver })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(addHeadingIds)
    .use(wrapTables)
    .use(transformImages, dir)
    .use(rehypeLinkPreviewKeys, { pageSlug })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const hast = await processor.run(tree as any);
  const html = processor.stringify(hast) as string;
  const rawToc = extractToc(hast as any);
  const linkedPages = collectLinkedPages(
    [page.rawContent],
    new Set<string>([page.filename]),
    hierarchy,
  );
  const glossary = linkedPages.filter((p) => GLOSSARY_RE.test(p.title));
  const regular = linkedPages.filter((p) => !GLOSSARY_RE.test(p.title));
  const toc = integrateLinkedIntoToc(rawToc, regular);
  return {
    html,
    toc,
    glossary,
    wordCount: countWordsInTree(tree),
    pageCount: 1,
  };
}
