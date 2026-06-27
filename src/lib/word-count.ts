/**
 * word-count.ts — approximate prose word count for the workshop hero stat.
 *
 * WHAT: counts words in raw markdown, ignoring fenced + inline code (which the
 *   old mdast-based counter also excluded). Used only for the "~X.Xk words /
 *   N min" line in WorkshopHero — a display estimate, not anything load-bearing.
 * IN → OUT: raw markdown string → word count (number).
 */
export function countWords(raw: string | undefined): number {
  if (!raw) return 0;
  const prose = raw
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[\[[^\]]*\]\]/g, " ") // wiki image embeds
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // markdown images
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, "$2$1") // wikilink → shown text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown link → text
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/[#>*_~|]/g, " "); // markup punctuation
  return prose.split(/\s+/).filter(Boolean).length;
}
