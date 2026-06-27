/**
 * hierarchy.ts — turn a flat list of pages into the 3-tier workshop tree.
 *
 * Responsibility: the site's structural model. It resolves each page's parent
 *   (from the `up:` frontmatter), computes its tier (Workshop=0 → Chapter=1 →
 *   Subpage=2), wires children (sorted), and — crucially — precomputes each
 *   node's displayTitle / slug / url ONCE (via routes.ts) so every other module
 *   reads those fields instead of re-deriving them.
 * Lookups it exposes: byFilename ("How to Home Server/01 Intro.md") and
 *   byBasename ("01 Intro" — used to resolve wikilinks by name).
 * Gotcha: byBasename is keyed by bare filename, so two files with the same name
 *   in different workshops collide (last one wins). Fine for today's content;
 *   revisit if the docs repo grows duplicate basenames.
 */
import { comparePages } from "./sort-key";
import { displayTitle, nodeSlug, nodeUrl } from "./routes";

export interface RawPage {
  filename: string;
  upTargets: string[];
  title?: string;
  description?: string;
  cover?: string;
  authors?: string[];
  date?: string;
  order?: number;
  rawContent?: string;
}

export interface HierNode extends RawPage {
  depth: 0 | 1 | 2;
  parent?: HierNode;
  children: HierNode[];
  workshopRootFilename: string;
  // Precomputed display strings — the single source of truth. Filled once in
  // buildHierarchy via routes.ts; every consumer reads these instead of
  // re-deriving them, so routing and wikilinks can't disagree.
  displayTitle: string;
  slug: string;
  url: string;
}

export interface Hierarchy {
  workshops: HierNode[];
  byFilename: Map<string, HierNode>;
  byBasename: Map<string, HierNode>;
}

function basename(filename: string): string {
  return filename.split("/").pop()!.replace(/\.md$/i, "");
}

export function buildHierarchy(pages: RawPage[]): Hierarchy {
  const byFilename = new Map<string, HierNode>();
  const byBasename = new Map<string, HierNode>();

  for (const p of pages) {
    const node: HierNode = {
      ...p,
      upTargets: p.upTargets ?? [],
      depth: 0,
      children: [],
      workshopRootFilename: p.filename,
      displayTitle: "",
      slug: "",
      url: "",
    };
    byFilename.set(p.filename, node);
    byBasename.set(basename(p.filename), node);
    byBasename.set(p.filename.replace(/\.md$/i, ""), node);
  }

  // Resolve parent (one hop — the parent is directly the byBasename lookup of the first upTarget)
  for (const node of byFilename.values()) {
    const upName = node.upTargets[0];
    if (!upName) continue;
    const parent = byBasename.get(upName);
    if (!parent || parent === node) continue;
    node.parent = parent;
  }

  // Compute depth from parent chain length (capped at 2)
  const computeDepth = (n: HierNode): 0 | 1 | 2 => {
    let d = 0;
    let cur: HierNode | undefined = n.parent;
    while (cur && d < 2) {
      d++;
      cur = cur.parent;
    }
    return d as 0 | 1 | 2;
  };
  for (const node of byFilename.values()) {
    node.depth = computeDepth(node);
  }

  // Compute workshop root filename (walk to depth-0 ancestor)
  for (const node of byFilename.values()) {
    let cur: HierNode = node;
    while (cur.parent) cur = cur.parent;
    node.workshopRootFilename = cur.filename;
  }

  // Wire children
  for (const node of byFilename.values()) {
    if (node.parent) node.parent.children.push(node);
  }

  // Sort children of every node
  for (const node of byFilename.values()) {
    node.children.sort(comparePages);
  }

  // Precompute display title + slug for every node, then the URL (which needs
  // the node's own slug AND its workshop root's slug). Done here, once, so
  // routes.ts is the only code that knows how a Node becomes a string.
  for (const node of byFilename.values()) {
    node.displayTitle = displayTitle(node);
    node.slug = nodeSlug(node);
  }
  for (const node of byFilename.values()) {
    const root = byFilename.get(node.workshopRootFilename)!;
    node.url = nodeUrl(node, root.slug);
  }

  // Collect workshops (depth-0 nodes), sorted
  const workshops = [...byFilename.values()]
    .filter((n) => n.depth === 0)
    .sort(comparePages);

  return { workshops, byFilename, byBasename };
}
