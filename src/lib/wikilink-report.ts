/**
 * wikilink-report.ts — find broken wikilinks at BUILD time, not just in the page.
 *
 * WHY: a dead link renders as a muted <span class="broken">, which readers see
 *   and authors don't. checkWikilinks() walks every page's raw markdown once and
 *   resolves every link, so the build can list the misses (astro.config.mjs) and
 *   WIKILINK_STRICT=1 can fail on them in CI.
 * WHY NOT in the remark plugin: Astro caches rendered entries in
 *   node_modules/.astro/data-store.json, so on an incremental build the plugin
 *   never runs for unchanged pages and the report would falsely come back clean.
 *   This scan reads the same fs data loadContent() already has — no cache, no
 *   render, works in dev too.
 */
import type { WikiResolver } from "./remark-wikilinks";
import { parseWikilinks, stripCode } from "./wikilink";

export type WikiIssueReason = "page" | "heading" | "block-ref";

export interface WikiIssue {
  /** Page the link was written on (hierarchy filename). */
  file: string;
  /** The `[[...]]` source that failed. */
  raw: string;
  reason: WikiIssueReason;
}

const REASON_TEXT: Record<WikiIssueReason, string> = {
  page: "no page with that name",
  heading: "target page has no such heading",
  "block-ref": "block references (#^id) are not supported",
};

interface ScannedPage {
  filename: string;
  rawContent?: string;
}

/** Resolve every wikilink in every page; return the ones that don't land. */
export function checkWikilinks(
  pages: Iterable<ScannedPage>,
  resolver: WikiResolver,
): WikiIssue[] {
  const issues: WikiIssue[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page.rawContent) continue;
    for (const token of parseWikilinks(stripCode(page.rawContent))) {
      if (token.embed) continue;
      const { broken } = resolver({
        name: token.name,
        heading: token.heading,
        fromFilename: page.filename,
      });
      if (!broken) continue;
      const key = `${page.filename} ${token.raw} ${broken}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({ file: page.filename, raw: token.raw, reason: broken });
    }
  }
  return issues;
}

export function formatWikilinkIssues(issues: readonly WikiIssue[]): string {
  return issues
    .map((i) => `${i.file}: ${i.raw} — ${REASON_TEXT[i.reason]}`)
    .join("\n");
}
