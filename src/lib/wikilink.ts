/**
 * wikilink.ts — the ONE wikilink parser (syntax only, no rendering, no resolution).
 *
 * Responsibility: turn raw markdown text into WikiToken[]. Every consumer that
 *   needs to know "which [[wikilinks]] does this text contain" goes through here:
 *   remark-wikilinks.ts (rendering) and links.ts (the TOC cross-reference graph).
 *   Two parsers drifted apart once already — don't add a third regex.
 * Forms handled:
 *     [[Page]] [[Page|alias]] [[Page#Heading]] [[#Heading]] (same page)
 *     ![[image.png]] ![[image.png|200]] ![[image.png|200|caption]]
 *     [[Page\|alias]] — Obsidian's escaped pipe (needed inside tables)
 * Also here: stripCode() (so raw-markdown scanners ignore code blocks, like the
 *   renderer does) and headingSlugs() (the anchor set a [[Page#Heading]] link is
 *   validated against — same slugify() as the heading ids).
 */
import { slugify } from "./slugify";

export interface WikiToken {
  /** The full `[[...]]` source, for reporting and for re-emitting as text. */
  raw: string;
  /** Offset of `raw` inside the scanned string. */
  index: number;
  /** `![[...]]` — an image embed rather than a link. */
  embed: boolean;
  /** Target page name; "" means a same-page `[[#Heading]]` link. */
  name: string;
  /** Heading anchor text, without the leading `#`. */
  heading?: string;
  /** `|`-separated trailing parts: alias for links, width/caption for embeds. */
  aliasParts: string[];
}

// Inner text is anything but `]`, with backslash escapes allowed (`\|`, `\]`).
const WIKI_RE = /(!?)\[\[((?:\\.|[^\\\]])*)\]\]/g;

/**
 * Split on `|`, unescaping `\x` → `x` as we go. `\|` also splits: Obsidian
 * escapes the pipe when a wikilink sits inside a table cell, and it still means
 * "alias separator" there.
 */
function splitUnescaped(input: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "\\" && i + 1 < input.length && input[i + 1] !== "|") {
      cur += input[i + 1];
      i++;
    } else if (c === "|" || (c === "\\" && input[i + 1] === "|")) {
      if (c === "\\") i++;
      parts.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts;
}

export function parseWikilinks(text: string): WikiToken[] {
  const tokens: WikiToken[] = [];
  WIKI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RE.exec(text)) !== null) {
    const [raw, bang, inner] = m;
    const [target, ...aliasParts] = splitUnescaped(inner);
    const hash = target.indexOf("#");
    const name = (hash === -1 ? target : target.slice(0, hash)).trim();
    const heading =
      hash === -1 ? undefined : target.slice(hash + 1).trim() || undefined;
    // `[[]]` / `[[#]]` / `[[|x]]` are not links — leave them as literal text.
    if (!name && !heading) continue;
    tokens.push({
      raw,
      index: m.index,
      embed: bang === "!",
      name,
      heading,
      aliasParts: aliasParts.map((p) => p.trim()).filter(Boolean),
    });
  }
  return tokens;
}

/**
 * Blank out fenced blocks and inline code, so scanners of *raw* markdown match
 * the renderer (which never sees wikilinks inside code).
 */
export function stripCode(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      if (m && m[1].startsWith(fence[0])) fence = null;
      continue;
    }
    if (m) {
      fence = m[1];
      continue;
    }
    out.push(line.replace(/`[^`\n]*`/g, ""));
  }
  return out.join("\n");
}

const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;

/** Every anchor id a page exposes — the target set for `[[Page#Heading]]`. */
export function headingSlugs(markdown: string): Set<string> {
  const slugs = new Set<string>();
  for (const line of stripCode(markdown).split("\n")) {
    const m = HEADING_RE.exec(line);
    if (!m) continue;
    const slug = slugify(m[1]);
    if (slug) slugs.add(slug);
  }
  return slugs;
}
