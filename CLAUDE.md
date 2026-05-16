# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # astro dev — http://localhost:4321
npm run build        # static build into dist/
npm run preview      # serve the built site
npm run deploy       # build + wrangler pages deploy (Cloudflare Pages, project "spark")
npm test             # vitest run --passWithNoTests
npm run test:watch   # vitest in watch mode
npx vitest run path/to/file.test.ts                  # single test file
npx vitest run -t "pattern"                          # filter by test name
npm run refresh-link-previews                        # wipe src/data/link-previews.json so external OG metadata is re-fetched on next build
```

Requires Node ≥ 22.12 and a `.env` with `CONTENT_PATH=<absolute path>` pointing at the workshop Markdown folder. Without it, `loadContent()` throws and the site cannot build.

## Architecture

This is a static Astro site that compiles a folder of Obsidian-flavored Markdown into a workshop site. The Markdown source lives **outside** the repo at `CONTENT_PATH`; the repo only contains the build pipeline.

### Content pipeline

1. **`astro.config.mjs`** — at config evaluation time, calls `copyImages(CONTENT_PATH, cwd)` (`src/lib/copy-images.ts`) which mirrors `<CONTENT_PATH>/<workshop>/images/` into `public/images/<workshop>/`. Editing `astro.config.mjs` re-runs this.
2. **`src/lib/load-content.ts`** scans `CONTENT_PATH` for `.md` files at root and one level deep. It parses frontmatter (`src/lib/frontmatter.ts`) and produces `RawPage`s. Pages in a workshop subdirectory with no explicit `up:` are **auto-parented** to the workshop whose name matches the enclosing folder.
3. **`src/lib/hierarchy.ts`** turns `RawPage[]` into a 3-tier `Hierarchy` (`depth: 0 | 1 | 2`). Lookups: `byFilename` (relpath, e.g. `"01 Foo/02 Bar.md"`) and `byBasename` (filename without extension, used by wikilink resolution). Children are sorted via `comparePages` in `src/lib/sort-key.ts` (numeric prefix → order frontmatter → title).
4. **`src/content.config.ts`** wraps the hierarchy as an Astro content collection (`workshops`) using a custom loader. Each `HierNode` becomes one entry. This is mostly for Astro plumbing — pages render directly from `loadContent()` rather than via `getCollection()`.

### Markdown rendering

`src/lib/render-workshop.ts` exports `renderWorkshop` (workshop root: inlines all depth-1 children as chapter sections separated by `<h2 class="chapter-divider">`) and `renderSubpage` (depth-2). Both use the same `unified` pipeline:

`remarkGfm → remarkCallouts → remarkWikilinks → remarkRehype → addHeadingIds → wrapTables → transformImages → rehypeLinkPreviewKeys → rehypeHighlight → rehypeStringify`

- **`remark-wikilinks.ts`** turns `[[Name]]`, `[[Name|alias]]`, `[[Name#Heading]]`, and image embeds `![[file.png|200|caption]]` into mdast links/images. Resolution is via the `WikiResolver` built from the hierarchy in `buildWikiResolver`. Unresolved names render as `<span class="broken">` (muted strikethrough).
- **`remark-callouts.ts`** parses Obsidian `> [!type] Title` callouts. Fold markers (`+`/`-`) parse but are ignored.
- **`transformImages`** (in `render-workshop.ts`): rewrites `images/foo.png` → `/images/<workshopDir>/foo.png`, treats a numeric `title` attribute as a max-width, and promotes lone-image paragraphs into `<figure class="md-figure">` with the `alt` becoming a caption (unless `alt` looks like a filename).
- **`extract-toc.ts`** scans the rendered hast for h1/h2/h3 plus chapter-divider markers; `integrateLinkedIntoToc` merges in wiki-linked pages under their parent chapter. Glossary pages (title matching `/^glossary$/i`) are split out for separate rendering.

### Link previews (hover popovers)

`src/lib/extract-previews.ts` runs at build time inside `Base.astro` (memoized via `buildPreviewMap`). It walks every node to register internal preview entries (workshop / chapter / subpage / heading-anchored), then fetches OpenGraph metadata for any external `https?://` link. The cache is committed at `src/data/link-previews.json` — entries are reused on subsequent builds; `npm run refresh-link-previews` resets it. Failed fetches are remembered for 7 days.

The preview map is serialized into a `<script type="application/json" id="link-previews">` tag in `Base.astro`; an inline script wires hover behavior. Anchor keys come from `rehype-link-preview-keys.ts`, which adds `data-preview-key` attributes during rendering.

### Routing

- `src/pages/index.astro` — homepage with workshop cards
- `src/pages/[workshop]/index.astro` — workshop page; `getStaticPaths` lists every depth-0 node
- `src/pages/[workshop]/[subpage].astro` — depth-2 subpages
- Slugs: `slugify(stripNumericPrefix(title || shortName(filename)))` — so `"01 My Workshop.md"` → `/my-workshop`. The wiki resolver and route generation MUST use the same slug rules.

### Voxel hero (`src/components/voxel/`)

The animated star on the homepage is a Three.js voxel system, loaded only on capable devices via dynamic import in `VoxelStar.astro`.

- **`index.ts`** is the entry: rasterizes `/star_monocolor.svg` to a mask (`rasterize.ts`), voxelizes (`voxelize.ts`), creates `InstancedMesh`es (`skin-solid.ts`), runs a fixed-step physics loop (`physics.ts`) and a per-mode force function.
- **Modes** (`modes/{explode,repel,magnet,tilt,gravity}.ts`) implement the `Mode` interface and self-register via `modes/index.ts`. Mobile (`hover: none` + `pointer: coarse`) is forced to `explode`. `prefers-reduced-motion` forces `idle: still` unless overridden by `localStorage["spark-voxel-idle-override"]`.
- **`settings.ts`** owns the `VoxelSettings` shape, `RANGES` (clamps), localStorage key `spark-voxel-settings`, and emits a `SETTINGS_EVENT` (`spark:voxel-settings`) custom event that `init()` subscribes to for live updates.
- **`theme.ts`** watches `--fg` so the voxel re-colors with theme switches.
- Disable via `?voxel=off` query param or by setting `enabled: false` in saved settings.

### Theming

`src/layouts/Base.astro` runs an inline pre-paint script that reads `localStorage["spark-theme"]` (`light`/`dark`) and per-theme color overrides (`spark-colors-light` / `spark-colors-dark`) to set `data-theme` and `--bg`/`--fg`/`--link` before first paint, avoiding flash. CSS variables live in `src/styles/global.css`.

## Conventions

- Tests live alongside source as `*.test.ts` and run in node (`vitest.config.ts`). Pure logic modules (slugify, sort-key, hierarchy, frontmatter, remark plugins, voxel math) have unit tests; rendering/Astro layers don't.
- TypeScript is `astro/tsconfigs/strict`. No build-time TS check beyond what Astro runs.
- The repo uses Astro v6 with no integrations configured.
- Do not add a `Co-Authored-By: Claude` trailer to commits — the user wants human-only attribution.
