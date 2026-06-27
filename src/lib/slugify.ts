/**
 * slugify.ts — turn human text into URL-safe slugs.
 *
 * Responsibility: the project's ONE slugger, used for two things that must stay
 *   in lockstep: (1) page slugs — "01 How to Home Server" → "how-to-home-server"
 *   (via routes.ts), and (2) heading anchor ids — the `#some-heading` targets
 *   produced by addHeadingIds in render-workshop.ts and by wikilink "#heading"
 *   links in remark-wikilinks.ts.
 * Gotcha: because both heading ids and the wikilink "#heading" anchors call this
 *   same function, they agree by construction. If you ever swap the heading-id
 *   generator (e.g. to github-slugger), you must swap the wikilink + link-preview
 *   "#heading" generators too, or in-page anchors will silently 404.
 */
const NUMERIC_PREFIX_RE = /^\d+[\s\-_]+/;

export function shortName(filename: string): string {
  return filename.split("/").pop()!.replace(/\.md$/i, "");
}

export function stripNumericPrefix(input: string): string {
  return input.replace(NUMERIC_PREFIX_RE, "");
}

export function slugify(input: string): string {
  return stripNumericPrefix(input)
    .toLowerCase()
    .replace(/['’]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
