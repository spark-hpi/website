/**
 * previews.ts — build the hover-card preview map at build time.
 *
 * WHAT: `buildPreviewMap(hierarchy)` walks every workshop/chapter/subpage/heading
 *   and registers an internal Preview entry for each, then fetches OpenGraph
 *   metadata for every external https? link found in the content. Returns a
 *   PreviewMap keyed by the same lookup strings rehype-link-preview-keys.ts
 *   stamps onto <a data-preview-key> (external → full URL, internal → absolute
 *   path, same-page → `<pageBase>#anchor`). Base.astro serializes the map into a
 *   <script type="application/json"> tag the hover script reads.
 * WHY a committed cache: external OG fetches are slow and rate-limited, so results
 *   are persisted to src/data/link-previews.json and reused across builds; failed
 *   fetches are remembered for 7 days. `npm run refresh-link-previews` wipes it.
 * GOTCHA: heading-anchor keys are slugify()'d — same slugger as the DOM ids, so
 *   `<pageBase>#anchor` keys line up with real heading ids by construction.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "./slugify";
import type { Hierarchy } from "./hierarchy";

export type PreviewKind =
  | "workshop"
  | "subpage"
  | "chapter"
  | "external"
  | "external-fallback";

export interface Preview {
  kind: PreviewKind;
  tag: string;
  title: string;
  excerpt?: string;
  image?: string;
  href?: string;
}

export type PreviewMap = Record<string, Preview>;

interface CacheEntry {
  title?: string;
  description?: string;
  image?: string;
  failed?: boolean;
  fetchedAt: number;
}
type Cache = Record<string, CacheEntry>;

const CACHE_URL = new URL("../data/link-previews.json", import.meta.url);
const EXCERPT_MAX = 180;
const STALE_FAILED_MS = 7 * 24 * 3600 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let memo: Promise<PreviewMap> | null = null;

export function buildPreviewMap(hierarchy: Hierarchy): Promise<PreviewMap> {
  if (!memo) memo = doBuild(hierarchy);
  return memo;
}

async function doBuild(hierarchy: Hierarchy): Promise<PreviewMap> {
  const out: PreviewMap = {};
  const externalUrls = new Set<string>();

  for (const node of hierarchy.byFilename.values()) {
    const root = hierarchy.byFilename.get(node.workshopRootFilename)!;
    const wsTitle = root.displayTitle;
    const wsSlug = root.slug;
    const nodeTitle = node.displayTitle;
    const tree = parse(node.rawContent ?? "");

    if (node.depth === 0) {
      out[`/${wsSlug}`] = {
        kind: "workshop",
        tag: "WORKSHOP",
        title: wsTitle,
        excerpt:
          (node.description && node.description.trim()) || firstParagraph(tree),
        image: node.cover,
      };
      for (const h of headingsWithExcerpts(tree)) {
        out[`/${wsSlug}#${slugify(h.text)}`] = {
          kind: "chapter",
          tag: "CHAPTER",
          title: h.text,
          excerpt: h.excerpt,
        };
      }
    } else if (node.depth === 1) {
      const chapterSlug = node.slug;
      out[`/${wsSlug}#${chapterSlug}`] = {
        kind: "chapter",
        tag: "CHAPTER",
        title: nodeTitle,
        excerpt: firstParagraph(tree),
      };
      for (const h of headingsWithExcerpts(tree)) {
        out[`/${wsSlug}#${slugify(h.text)}`] = {
          kind: "chapter",
          tag: "CHAPTER",
          title: h.text,
          excerpt: h.excerpt,
        };
      }
    } else {
      const subSlug = node.slug;
      out[`/${wsSlug}/${subSlug}`] = {
        kind: "subpage",
        tag: "PAGE",
        title: nodeTitle,
        excerpt: firstParagraph(tree),
      };
      for (const h of headingsWithExcerpts(tree)) {
        out[`/${wsSlug}/${subSlug}#${slugify(h.text)}`] = {
          kind: "chapter",
          tag: "CHAPTER",
          title: h.text,
          excerpt: h.excerpt,
        };
      }
    }

    collectExternalUrls(tree, externalUrls);
  }

  const cache = loadCache();
  const now = Date.now();
  let dirty = false;

  for (const url of externalUrls) {
    const entry = cache[url];
    const stale =
      entry?.failed && now - (entry.fetchedAt ?? 0) > STALE_FAILED_MS;
    if (!entry || stale) {
      try {
        const fetched = await fetchOg(url);
        if (fetched.title || fetched.description || fetched.image) {
          cache[url] = { ...fetched, fetchedAt: now };
        } else {
          cache[url] = { failed: true, fetchedAt: now };
        }
        dirty = true;
      } catch (err: any) {
        const name = err?.name ?? "";
        const msg = err?.message ?? "";
        const networkError =
          name === "AbortError" ||
          name === "TypeError" ||
          /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(msg);
        if (!networkError) {
          cache[url] = { failed: true, fetchedAt: now };
          dirty = true;
        }
      }
    }
  }

  if (dirty) saveCache(cache);

  for (const url of externalUrls) {
    const e = cache[url];
    if (e && !e.failed && (e.title || e.description)) {
      out[url] = {
        kind: "external",
        tag: "EXTERNAL",
        title: e.title || hostnameOf(url),
        excerpt: truncate(cleanWhitespace(e.description ?? ""), EXCERPT_MAX),
        image: e.image,
        href: url,
      };
    } else {
      out[url] = {
        kind: "external-fallback",
        tag: "EXTERNAL",
        title: hostnameOf(url),
        href: url,
      };
    }
  }

  return out;
}

function parse(md: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as Root;
}

function nodeToText(node: any): string {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") {
    return typeof node.value === "string" ? node.value : "";
  }
  if (node.type === "code" || node.type === "html") return "";
  if (!Array.isArray(node.children)) return "";
  return node.children.map(nodeToText).join("");
}

function cleanExcerpt(s: string): string {
  return cleanWhitespace(
    s
      .replace(/!\[\[[^\]]+\]\]/g, "")
      .replace(
        /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
        (_, name: string, alias?: string) => (alias ?? name).trim(),
      ),
  );
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.trim() + "…";
}

function firstParagraph(tree: Root): string {
  for (const child of tree.children) {
    if (child.type === "paragraph") {
      const text = cleanExcerpt(nodeToText(child));
      if (text) return truncate(text, EXCERPT_MAX);
    }
  }
  return "";
}

function headingsWithExcerpts(
  tree: Root,
): Array<{ text: string; excerpt: string }> {
  const out: Array<{ text: string; excerpt: string }> = [];
  const children = tree.children;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type !== "heading") continue;
    const text = cleanExcerpt(nodeToText(c));
    if (!text) continue;
    let excerpt = "";
    for (let j = i + 1; j < children.length; j++) {
      const n = children[j];
      if (n.type === "heading") break;
      if (n.type === "paragraph") {
        excerpt = truncate(cleanExcerpt(nodeToText(n)), EXCERPT_MAX);
        break;
      }
    }
    out.push({ text, excerpt });
  }
  return out;
}

function collectExternalUrls(tree: Root, out: Set<string>): void {
  visit(tree as any, "link", (node: any) => {
    const url = node.url;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) out.add(url);
  });
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchOg(
  url: string,
): Promise<{ title?: string; description?: string; image?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SparkLinkPreviewBot/1.0; +https://spark.example)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = (await res.text()).slice(0, 64 * 1024);
    const title = pickMeta(html, "og:title") ?? pickTitleTag(html);
    const description =
      pickMeta(html, "og:description") ?? pickMeta(html, "description");
    const imageRaw = pickMeta(html, "og:image");
    const image = imageRaw ? resolveUrl(imageRaw, url) : undefined;
    return { title, description, image };
  } finally {
    clearTimeout(timer);
  }
}

function pickMeta(html: string, name: string): string | undefined {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+?(?:property|name)\\s*=\\s*["']${esc}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+?content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${esc}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtml(m[1]).trim();
  }
  return undefined;
}

function pickTitleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtml(m[1]).trim() : undefined;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, c) =>
      String.fromCodePoint(parseInt(c, 16)),
    )
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)));
}

function resolveUrl(ref: string, base: string): string | undefined {
  try {
    return new URL(ref, base).toString();
  } catch {
    return undefined;
  }
}

function cachePath(): string {
  return fileURLToPath(CACHE_URL);
}

function loadCache(): Cache {
  const p = cachePath();
  if (!existsSync(p)) return {};
  try {
    const raw = readFileSync(p, "utf8");
    return raw.trim() ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  const p = cachePath();
  mkdirSync(dirname(p), { recursive: true });
  const keys = Object.keys(cache).sort();
  const sorted: Cache = {};
  for (const k of keys) sorted[k] = cache[k];
  writeFileSync(p, JSON.stringify(sorted, null, 2) + "\n");
}
