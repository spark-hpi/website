/**
 * remark-wikilinks.ts — render Obsidian wikilinks inside markdown.
 *
 * Responsibility: a remark plugin that rewrites every wikilink form (parsed by
 *   wikilink.ts — the one parser) into real mdast links/images:
 *     [[Page]] [[Page|alias]] [[Page#Heading]] [[#Heading]] (same page)
 *     ![[image.png|200|caption]] image embed (optional width + caption)
 *   Targets resolve through a WikiResolver built by buildWikiResolver from the
 *   hierarchy, at config time in astro.config.mjs.
 * Validation: the resolver flags an unknown page, an unknown #heading, and
 *   Obsidian block refs (#^id). A dead page renders as <span class="broken">; a
 *   dead anchor still links to the page, minus the anchor. Listing those misses
 *   for authors is wikilink-report.ts's job — it re-runs the same resolver over
 *   the raw markdown, because Astro caches rendered entries and this plugin does
 *   not re-run for unchanged pages.
 * No raw HTML: the broken span is an mdast node with data.hName/hProperties, so
 *   nothing here depends on allowDangerousHtml.
 * Gotcha: "#Heading" is slugified with the same slugify() as the heading ids —
 *   keep those in sync (see slugify.ts).
 */
import type { Plugin } from "unified";
import type { Root, Text, PhrasingContent } from "mdast";
import type { VFile } from "vfile";
import { visit, SKIP } from "unist-util-visit";
import { slugify } from "./slugify";
import { headingSlugs, parseWikilinks, type WikiToken } from "./wikilink";
import type { WikiIssueReason } from "./wikilink-report";

export interface WikiTarget {
  /** Page name; "" for a same-page `[[#Heading]]` link. */
  name: string;
  heading?: string;
  /** Hierarchy filename of the page being rendered (resolves same-page links). */
  fromFilename?: string;
}

export interface ResolvedWiki {
  /** Page url, or "" for same-page / unresolved. */
  url: string;
  /** Set when the target is bad; url still points at the best fallback. */
  broken?: WikiIssueReason;
}

export type WikiResolver = (target: WikiTarget) => ResolvedWiki;

interface WikiNodeLike {
  url: string;
  rawContent?: string;
}

/**
 * Build the resolver from the hierarchy: a wikilink name → that Node's
 * precomputed url (routes.ts is the only thing that knows how a Node becomes a
 * url), plus the node's heading set so `#Heading` can be validated.
 */
export function buildWikiResolver(hierarchy: {
  byBasename: Map<string, WikiNodeLike>;
  byFilename?: Map<string, WikiNodeLike>;
}): WikiResolver {
  const headingCache = new WeakMap<WikiNodeLike, Set<string>>();
  const headingsOf = (node: WikiNodeLike): Set<string> | undefined => {
    if (node.rawContent === undefined) return undefined;
    let slugs = headingCache.get(node);
    if (!slugs) {
      slugs = headingSlugs(node.rawContent);
      headingCache.set(node, slugs);
    }
    return slugs;
  };

  return ({ name, heading, fromFilename }) => {
    const node = name
      ? hierarchy.byBasename.get(name)
      : fromFilename
        ? hierarchy.byFilename?.get(fromFilename)
        : undefined;
    if (name && !node) return { url: "", broken: "page" };
    // Same-page links get an empty base, so the anchor stays relative.
    const url = name ? node!.url : "";
    if (!heading) return { url };
    if (heading.startsWith("^")) return { url, broken: "block-ref" };
    const slugs = node ? headingsOf(node) : undefined;
    if (slugs && !slugs.has(slugify(heading))) return { url, broken: "heading" };
    return { url: `${url}#${slugify(heading)}` };
  };
}

function brokenSpan(text: string): PhrasingContent {
  return {
    type: "emphasis",
    data: { hName: "span", hProperties: { className: ["broken"] } },
    children: [{ type: "text", value: text }],
  };
}

/** ![[file.png|200|caption]] — width and caption are order-agnostic. */
function embedNode(token: WikiToken): PhrasingContent {
  let width: string | undefined;
  let caption: string | undefined;
  for (const part of token.aliasParts) {
    if (!width && /^\d+$/.test(part)) width = part;
    else if (!caption) caption = part;
  }
  return {
    type: "image",
    url: token.name,
    alt: caption ?? token.name,
    title: width ?? null,
  };
}

function linkNode(token: WikiToken, resolved: ResolvedWiki): PhrasingContent {
  const display = token.aliasParts.join("|") || token.name || `#${token.heading}`;
  // No page to fall back to (unknown page, or a dead anchor on this page).
  if (resolved.broken === "page" || (resolved.broken && !resolved.url)) {
    return brokenSpan(display);
  }
  return {
    type: "link",
    url: resolved.url,
    children: [{ type: "text", value: display }],
  };
}

export interface WikilinkOptions {
  resolver: WikiResolver;
}

/** Content is one level deep, so the last two path segments ARE the filename. */
function filenameOf(file: VFile): string | undefined {
  const path = file.path ?? file.history[0];
  if (!path) return undefined;
  return path.split("/").filter(Boolean).slice(-2).join("/");
}

export const remarkWikilinks: Plugin<[WikilinkOptions], Root> = (opts) => {
  const { resolver } = opts;

  return (tree: Root, file: VFile) => {
    const fromFilename = filenameOf(file);

    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const tokens = parseWikilinks(node.value);
      if (tokens.length === 0) return;

      const out: PhrasingContent[] = [];
      let cursor = 0;
      for (const token of tokens) {
        if (token.index > cursor) {
          out.push({
            type: "text",
            value: node.value.slice(cursor, token.index),
          });
        }
        if (token.embed) {
          out.push(embedNode(token));
        } else {
          out.push(
            linkNode(
              token,
              resolver({
                name: token.name,
                heading: token.heading,
                fromFilename,
              }),
            ),
          );
        }
        cursor = token.index + token.raw.length;
      }
      if (cursor < node.value.length) {
        out.push({ type: "text", value: node.value.slice(cursor) });
      }

      (parent.children as PhrasingContent[]).splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
};
