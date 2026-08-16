/**
 * links.ts — the wikilink cross-reference graph, as it feeds the TOC.
 *
 * WHAT: finds the pages a workshop/subpage links to with `[[Wikilinks]]`, turns
 *   them into LinkedPage entries (title + url + the page's own sub-headings),
 *   splits out glossary pages, and merges the rest into the TOC under the chapter
 *   that referenced them (TocRail shows these as the "Options" sub-tree).
 * WHY bespoke: this is the site's signature cross-referencing — a chapter can
 *   pull sibling pages (e.g. "Proxmox", "Debian") into its own contents list.
 *   Astro has no native equivalent.
 * IN → OUT: raw markdown sources + the Hierarchy → LinkedPage[] / merged TocItem[].
 * WHERE: called by the route files after the per-page TOC is built (toc.ts).
 * GOTCHA: resolution is by bare basename via hierarchy.byBasename (see its
 *   collision note). A linked page whose parent chapter title isn't found is
 *   appended at the end rather than dropped.
 * PARSING: shares parseWikilinks() with the renderer (wikilink.ts), and strips
 *   code first — a [[Page]] inside a fenced block is not a real link.
 */
import type { Hierarchy } from "./hierarchy";
import { extractSubheadings, type TocItem } from "./toc";
import { parseWikilinks, stripCode } from "./wikilink";

export interface LinkedPage {
  title: string;
  url: string;
  parentTitle?: string;
  headings: TocItem[];
}

const GLOSSARY_RE = /^glossary$/i;

export function collectLinkedPages(
  sources: Array<string | undefined>,
  excludeFilenames: Set<string>,
  hierarchy: Hierarchy,
): LinkedPage[] {
  const seen = new Set<string>();
  const out: LinkedPage[] = [];
  for (const raw of sources) {
    if (!raw) continue;
    for (const token of parseWikilinks(stripCode(raw))) {
      // Embeds are images, and a bare [[#Heading]] points at the current page.
      if (token.embed || !token.name) continue;
      const target = hierarchy.byBasename.get(token.name);
      if (!target) continue;
      if (excludeFilenames.has(target.filename)) continue;
      if (seen.has(target.filename)) continue;
      seen.add(target.filename);
      out.push({
        title: target.displayTitle,
        url: target.url,
        parentTitle: target.parent?.displayTitle,
        headings: extractSubheadings(target.rawContent, target.url),
      });
    }
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

/** Split linked pages into glossary (title === "glossary") and the rest. */
export function splitGlossary(linked: LinkedPage[]): {
  glossary: LinkedPage[];
  regular: LinkedPage[];
} {
  return {
    glossary: linked.filter((p) => GLOSSARY_RE.test(p.title)),
    regular: linked.filter((p) => !GLOSSARY_RE.test(p.title)),
  };
}

/** Merge linked pages into the TOC beneath the chapter heading that referenced them. */
export function integrateLinkedIntoToc(
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
  const asItem = (p: LinkedPage): TocItem => ({
    tier: "h1",
    id: "",
    text: p.title,
    href: p.url,
    children: p.headings,
  });

  const out: TocItem[] = [];
  let currentChapter: string | null = null;
  const flush = () => {
    if (!currentChapter) return;
    const pages = byChapter.get(currentChapter);
    if (!pages) return;
    for (const p of pages) out.push(asItem(p));
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
  // Linked pages whose parent chapter heading wasn't found: append at the end.
  for (const pages of byChapter.values()) {
    for (const p of pages) out.push(asItem(p));
  }
  for (const p of trailing) {
    out.push({ tier: "h1", id: "", text: p.title, href: p.url });
  }
  return out;
}
