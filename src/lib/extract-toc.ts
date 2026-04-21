import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

export interface TocItem {
  tier: "chapter" | "h1" | "h2" | "h3";
  id: string;
  text: string;
  // Optional absolute href override (used for linked subpages that live on
  // their own URL rather than as a heading on the current page).
  href?: string;
  // Optional child entries (used for linked subpages' own headings).
  children?: TocItem[];
}

const HEADING_TAGS = new Set(["h1", "h2", "h3"]);

export function extractToc(tree: Root): TocItem[] {
  const out: TocItem[] = [];
  visit(tree, "element", (node: Element) => {
    if (!HEADING_TAGS.has(node.tagName)) return;
    const id = node.properties?.id;
    if (typeof id !== "string" || id.length === 0) return;
    const text = collectText(node);
    const tier = classifyTier(node);
    out.push({ tier, id, text });
  });
  return out;
}

function classifyTier(node: Element): TocItem["tier"] {
  if (node.tagName === "h2") {
    const cls = node.properties?.className;
    const classes = Array.isArray(cls) ? cls : cls ? [cls] : [];
    if (classes.includes("chapter-divider")) return "chapter";
  }
  return node.tagName as "h1" | "h2" | "h3";
}

function collectText(node: any): string {
  if (node.type === "text") return node.value as string;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(collectText).join("");
}
