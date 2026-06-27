/**
 * routes.ts — the ONE place a Node turns into a string (title, slug, URL).
 *
 * Responsibility: map a hierarchy Node to its human title, its URL slug, and its
 *   absolute site URL. Every page link and every wikilink target is derived from
 *   here, so routing and cross-references can never drift apart.
 * Used by: hierarchy.ts (which precomputes node.displayTitle/slug/url onto each
 *   Node at build time) and, through those fields, the route files in src/pages
 *   and the wikilink resolver.
 * In  → out: a Node-shaped object → a string.
 * Gotcha: prefer reading the precomputed node.displayTitle/slug/url fields. Call
 *   these functions only at build time (e.g. inside buildHierarchy), not per render.
 */
import { slugify, stripNumericPrefix, shortName } from "./slugify";

/** Fields these helpers need — kept structural so callers don't fight types. */
type TitledFile = { title?: string; filename: string };

/**
 * A node's human-facing title: the explicit frontmatter `title`, or else the
 * filename with its numeric ordering prefix stripped ("01 Setup.md" → "Setup").
 */
export function displayTitle(node: TitledFile): string {
  return node.title ?? stripNumericPrefix(shortName(node.filename));
}

/** A node's URL slug, derived from its display title. */
export function nodeSlug(node: TitledFile): string {
  return slugify(displayTitle(node));
}

/**
 * A node's absolute site URL, given the slug of the workshop it belongs to:
 *   Workshop (tier 0) → /workshop
 *   Chapter  (tier 1) → /workshop#chapter   (chapters render inline on the workshop page)
 *   Subpage  (tier 2) → /workshop/subpage
 */
export function nodeUrl(
  node: { depth: 0 | 1 | 2; slug: string },
  workshopSlug: string,
): string {
  if (node.depth === 0) return `/${workshopSlug}`;
  if (node.depth === 1) return `/${workshopSlug}#${node.slug}`;
  return `/${workshopSlug}/${node.slug}`;
}
