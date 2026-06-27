/**
 * toc.ts — build the "On this page" table of contents.
 *
 * WHAT: turns the headings Astro's render() reports for each entry into a flat
 *   TocItem[] that TocRail groups into chapters. For a workshop page it stacks:
 *   the workshop's own headings, then per chapter a `chapter`-tier divider item
 *   (no href) followed by that chapter's headings.
 * WHY single slugger: a TocItem's `id` is slugify(heading.text) — the SAME value
 *   rehype-markdown.ts stamps as the DOM heading id and that wikilinks/preview
 *   keys use. So every TOC anchor resolves and the scroll-spy lines up. We ignore
 *   Astro's headings[].slug (github-slugger) on purpose.
 * IN → OUT: AstroHeading[] (+ chapter Nodes) → TocItem[].
 * WHERE: called by the two route files; the result feeds TocRail + ScrollSpy.
 *   Linked-page and glossary integration lives in links.ts and runs on top.
 * CONTRACT (with TocRail): a chapter heading is `tier:"chapter"` with no href; an
 *   item with an href is a linked sub-page; nested headings go in `children`.
 */
import { slugify } from "./slugify";

export interface TocItem {
  tier: "chapter" | "h1" | "h2" | "h3";
  id: string;
  text: string;
  href?: string;
  children?: TocItem[];
}

/** The shape Astro's render() returns in `headings`. */
export interface AstroHeading {
  depth: number;
  slug: string;
  text: string;
}

/** Map render()'s headings to TocItems, clamping depth to h1–h3 and using our slugger. */
export function headingsToToc(headings: AstroHeading[]): TocItem[] {
  return headings
    .filter((h) => h.depth >= 1 && h.depth <= 3)
    // Drop GFM's auto-generated footnotes heading — it's machinery, not a section.
    .filter((h) => h.text !== "Footnotes")
    .map((h) => ({
      tier: `h${h.depth}` as "h1" | "h2" | "h3",
      id: slugify(h.text),
      text: h.text,
    }));
}

/**
 * Workshop page TOC: the workshop's own headings, then for each chapter a
 * divider item followed by that chapter's headings.
 */
export function buildWorkshopToc(
  ownHeadings: AstroHeading[],
  chapters: Array<{ title: string; slug: string; headings: AstroHeading[] }>,
): TocItem[] {
  const out: TocItem[] = headingsToToc(ownHeadings);
  for (const ch of chapters) {
    out.push({ tier: "chapter", id: ch.slug, text: ch.title });
    out.push(...headingsToToc(ch.headings));
  }
  return out;
}

const HEADING_LINE_RE = /^(#{1,3})\s+(.+?)\s*$/;

/**
 * Sub-headings of a *linked* page (one we don't render here, only link to). We
 * have no rendered headings[] for it, so scan its raw markdown. ids use the same
 * slugify() so the anchors land on that page's real heading ids.
 */
export function extractSubheadings(
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
    const text = m[2].replace(/\s*#+\s*$/, "").trim();
    if (!text) continue;
    out.push({
      tier: `h${m[1].length}` as "h1" | "h2" | "h3",
      id: "",
      text,
      href: `${baseUrl}#${slugify(text)}`,
    });
  }
  return out;
}
