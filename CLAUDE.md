# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # astro dev — http://localhost:4321
npm run build        # static build into dist/
npm run preview      # serve the built site
npm run sync-content # git pull (or clone) the workshop content into ./content
npm run deploy       # sync-content + build + wrangler pages deploy (Cloudflare Pages, project "spark")
npm test             # vitest run --passWithNoTests
npm run test:watch   # vitest in watch mode
npx vitest run path/to/file.test.ts                  # single test file
npx vitest run -t "pattern"                          # filter by test name
npm run generate-link-previews                        # fetch OG metadata for new/stale external links, update src/data/link-previews.json
npm run refresh-link-previews                         # wipe src/data/link-previews.json, then regenerate it from scratch
```

Requires Node ≥ 22.12 and a `.env` with `CONTENT_PATH` pointing at the workshop Markdown folder. The canonical content is the separate repo **github.com/spark-hpi/docs**; `npm run sync-content` clones/pulls it into `./content` (gitignored), and `.env` sets `CONTENT_PATH=./content/res`. Without `CONTENT_PATH`, `loadContent()` throws and the site cannot build.

## Architecture

This is a static Astro site that compiles a folder of Obsidian-flavored Markdown into a workshop site. The Markdown source lives **outside** the repo at `CONTENT_PATH`; the repo only contains the build pipeline.

### Content pipeline

1. **`astro.config.mjs`** — at config evaluation time, calls `copyImages(CONTENT_PATH, cwd)` (`src/lib/copy-images.ts`) which mirrors `<CONTENT_PATH>/<workshop>/images/` into `public/images/<workshop>/`. Editing `astro.config.mjs` re-runs this.
2. **`src/lib/load-content.ts`** scans `CONTENT_PATH` for `.md` files at root and one level deep. It parses frontmatter (`src/lib/frontmatter.ts`) and produces `RawPage`s. Pages in a workshop subdirectory with no explicit `up:` are **auto-parented** to the workshop whose name matches the enclosing folder.
3. **`src/lib/hierarchy.ts`** turns `RawPage[]` into a 3-tier `Hierarchy` (`depth: 0 | 1 | 2`). Lookups: `byFilename` (relpath, e.g. `"01 Foo/02 Bar.md"`) and `byBasename` (filename without extension, used by wikilink resolution). Children are sorted via `comparePages` in `src/lib/sort-key.ts` (numeric prefix → order frontmatter → title).
4. **`src/content.config.ts`** declares the `docs` content collection: a `glob()` loader over every `.md` file under `CONTENT_PATH`, with `generateId: ({entry}) => entry` so an entry's `id` equals its hierarchy `filename` (e.g. `"How to Home Server/Proxmox.md"`). Pages render **through this collection** — the route files look up the entry by `node.filename` and call Astro's `render(entry)` → `<Content/>` + `headings[]`. The *structure* (parent/tier/slug/url) still comes from `load-content.ts` + `hierarchy.ts` (the synchronous fs scan), NOT the collection; the collection is purely the render provider.

### Markdown rendering

Rendering is **native Astro** — there is no hand-rolled `unified` processor. Markdown is parsed and rendered by Astro's `render(entry)`, and the project's remark/rehype plugins are registered in **`astro.config.mjs`** under `markdown: { remarkPlugins, rehypePlugins }`. `smartypants: false` keeps straight quotes/dashes; `syntaxHighlight: false` + `rehypeHighlight` keeps highlight.js (`.hljs` spans) so the copy button and theme CSS keep working. Astro's built-in GFM runs around these plugins.

Pipeline order (after Astro's parse + GFM):
`remarkCallouts → remarkWikilinks → [Astro mdast→hast] → rehypeHeadingIds → rehypeWrapTables → rehypeImagePaths → rehypeLinkPreviewKeys → rehypeHighlight`

- **`rehype-markdown.ts`** holds three small rehype plugins: `rehypeHeadingIds` forces a `slugify()` id on every h1–h6 (overriding Astro's github-slugger, so all ids come from the single slugger); `rehypeWrapTables` wraps `<table>` for horizontal scroll; `rehypeImagePaths` rewrites `images/foo.png` → `/images/<workshopDir>/foo.png` (workshop dir = last two segments of the entry path), treats a numeric `title` as a max-width, and promotes lone-image paragraphs into `<figure class="md-figure">` with `alt` as caption (unless `alt` looks like a filename).
- **`remark-wikilinks.ts`** turns `[[Name]]`, `[[Name|alias]]`, `[[Name#Heading]]`, and image embeds `![[file.png|200|caption]]` into mdast links/images. Resolution is via the `WikiResolver` built from the hierarchy by `buildWikiResolver` (also in this file), called once at config time in `astro.config.mjs`. Unresolved names render as `<span class="broken">` (muted strikethrough).
- **`remark-callouts.ts`** parses Obsidian `> [!type] Title` callouts. Fold markers (`+`/`-`) parse but are ignored.
- **`toc.ts`** builds the sidebar TOC from Astro's `headings[]` (`headingsToToc` recomputes each id as `slugify(heading.text)`, ignoring Astro's own `headings[].slug`, so the TOC ids match the DOM ids by construction). The two route files feed the result to `TocRail.astro` + `ScrollSpy.astro`. Wiki-linked sub-pages are merged in under their parent chapter; glossary pages (title `/^glossary$/i`) are split out. The `Footnotes` heading is filtered out of the TOC.

**Single-slugger invariant:** every heading id, every `[[Page#Heading]]` wikilink anchor, every link-preview heading key, and the TOC's `data-toc-link` all come from the same `slugify()`. If you swap the heading-id generator you must swap the others, or in-page anchors silently 404.

### Link previews (hover popovers)

`src/lib/previews.ts` exports two entry points. `buildPreviewMap` (memoized) runs at build time inside `Base.astro`: it walks every node to register internal preview entries (workshop / chapter / subpage / heading-anchored) and reads external-link metadata from the committed cache — it never touches the network, so `astro dev`/`astro build` startup isn't blocked on OpenGraph fetches. `generateLinkPreviews` does the actual fetching: it's invoked by `scripts/generate-link-previews.ts` (`npm run generate-link-previews`), which walks the same hierarchy, fetches OpenGraph metadata for any external `https?://` link not already cached (or whose cached failure is stale), and writes `src/data/link-previews.json`. Failed fetches are remembered for 7 days. `npm run refresh-link-previews` wipes the cache and re-runs the generator.

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
