import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { buildHierarchy, type Hierarchy, type RawPage } from "./hierarchy";

export interface LoadedPage extends RawPage {
  absolutePath: string;
  rawContent: string;
}

export interface LoadResult {
  hierarchy: Hierarchy;
  pages: LoadedPage[];
  contentPath: string;
}

const COVER_EXTS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];

function resolveCover(
  cover: string | undefined,
  workshopDir: string | undefined,
  contentPath: string,
): string | undefined {
  if (cover) {
    if (cover.startsWith("/") || cover.startsWith("http")) return cover;
    return workshopDir
      ? `/images/${encodeURIComponent(workshopDir)}/${cover}`
      : `/images/${cover}`;
  }
  // Auto-detect cover.* in the workshop's images folder
  if (!workshopDir) return undefined;
  const imgDir = join(contentPath, workshopDir, "images");
  if (!existsSync(imgDir)) return undefined;
  for (const ext of COVER_EXTS) {
    if (existsSync(join(imgDir, `cover.${ext}`))) {
      return `/images/${encodeURIComponent(workshopDir)}/cover.${ext}`;
    }
  }
  return undefined;
}

function isHidden(name: string): boolean {
  return name.startsWith(".");
}

function scanFiles(
  root: string,
): { relPath: string; abs: string; workshopDir: string | undefined }[] {
  const results: {
    relPath: string;
    abs: string;
    workshopDir: string | undefined;
  }[] = [];

  for (const entry of readdirSync(root)) {
    if (isHidden(entry)) continue;
    const abs = join(root, entry);
    const stat = statSync(abs);
    if (stat.isFile() && entry.endsWith(".md")) {
      results.push({ relPath: entry, abs, workshopDir: undefined });
    } else if (stat.isDirectory()) {
      for (const child of readdirSync(abs)) {
        if (isHidden(child) || !child.endsWith(".md")) continue;
        const childAbs = join(abs, child);
        if (statSync(childAbs).isFile()) {
          results.push({
            relPath: `${entry}/${child}`,
            abs: childAbs,
            workshopDir: entry,
          });
        }
      }
    }
  }

  return results;
}

export function loadContent(contentPath?: string): LoadResult {
  const root = contentPath ?? process.env.CONTENT_PATH;
  if (!root) {
    throw new Error(
      "CONTENT_PATH env var not set. Add it to .env (see .env.example).",
    );
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`CONTENT_PATH is not a directory: ${root}`);
  }

  const pages: LoadedPage[] = [];
  for (const { relPath, abs, workshopDir } of scanFiles(root)) {
    const source = readFileSync(abs, "utf8");
    const { data, content } = parseFrontmatter(source);
    const fileShortName = relPath.split("/").pop()!.replace(/\.md$/i, "");
    const isRootFile = workshopDir && fileShortName === workshopDir;
    // Auto-parent: non-root files in a workshop dir with no up: link → assign to dir root
    const upTargets =
      (data.upTargets ?? []).length > 0 || !workshopDir || isRootFile
        ? (data.upTargets ?? [])
        : [workshopDir];
    pages.push({
      filename: relPath,
      absolutePath: abs,
      rawContent: content,
      upTargets,
      title: data.title,
      description: data.description,
      cover: resolveCover(data.cover, workshopDir, root),
      authors: data.authors,
      date: data.date,
      order: data.order,
    });
  }

  const hierarchy = buildHierarchy(pages);
  return { hierarchy, pages, contentPath: root };
}
