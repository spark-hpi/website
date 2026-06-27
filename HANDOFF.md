# Rework Handoff — maintainable-architecture branch

Status snapshot for resuming the "Spark Web — Rework for Human Maintainability"
plan. Branch: `rework/maintainable-architecture`. Delete this file when the
rework is finished (it's scratch, not a durable doc).

## Phase status

| Phase | What | State |
|------|------|-------|
| 0 | Content switch to spark-hpi/docs + sync script + baseline | ✅ done, committed |
| 1 | Single source of truth (routes/hierarchy) + prose CSS dedup | ✅ done (SSOT was pre-existing; prose dedup committed) |
| 2 | Footer → SiteFooter + settings/{SettingsPanel,ColorEditor,VoxelControls} | ✅ done (pre-existing commit) |
| 3 | Collapse the three heading extractors | ✅ **subsumed by Phase 4** (one path now: toc.ts) |
| 4 | Native Astro `render()` pipeline | ✅ done, committed, browser-verified |
| 5 | Shiki swap (drop rehype-highlight) | ⏸️ **DEFERRED by user ("for now")** — keep rehype-highlight; see below |
| 6 | Docs/naming pass + README + delete CLAUDE.md/AUDIT.md | ✅ done (CLAUDE.md kept + refreshed to post-Phase-4 reality; AUDIT.md already gone) |

## Commits made this session (on top of the branch)

1. `phase 0+1: content switch to spark-hpi/docs; dedupe prose CSS into Prose.astro`
2. `phase 3+4: native Astro render() pipeline; delete hand-rolled unified processor`

Everything below Phase 4 is uncommitted/not started. Working tree is clean as of
the last commit (Phase 5 not yet touched).

## Verification harness (use this every phase)

- **Baseline HTML** (pre-rework dist) saved at:
  `/private/tmp/claude-502/-Users-vadim-Developer-Spark-Web/d02b7341-45c7-45d0-b3a9-4ad1850b44b1/scratchpad/baseline/`
  (9 pages). **This may be wiped when context clears / session ends** — if gone,
  regenerate by `git stash`-ing to a pre-Phase-4 state, building, copying dist
  `*.html`, then unstashing. Simpler: trust the committed Phase 4 as the new
  baseline and diff Phase 5/6 against a fresh `dist` snapshot taken before each.
- **Body-diff script** (normalizes scope hashes, boolean-attr serialization,
  whitespace, prose-variant class): I ran it inline via `python3` in Bash — it
  reads `<body>` up to the `<script type="application/json">` preview blob and
  unified-diffs against baseline. Re-author from the git history of this session
  if needed.
- `npm test` → 17 files / 80 tests green.
- `npm run build` → 9 pages. **First page takes ~50s**: that's `buildPreviewMap`
  fetching external OpenGraph metadata (Base.astro). Cached in
  `src/data/link-previews.json`. Not a hang.
- Preview server was running in background on http://localhost:4321 (may be dead
  after context clear — restart `npm run preview`).
- Browser checks used **Playwright MCP** (the claude-in-chrome extension was not
  connected). Workshop + proxmox subpage verified: chapter dividers, callouts,
  26 code-copy hooks, 19 images (0 broken), scroll-spy active-state, TOC
  grouping, hover-preview keys — all working, 0 console errors.

## PHASE 5 — the open decision (stopped here)

Plan: drop `rehype-highlight`, enable Astro's default **Shiki**, delete the ~121
lines of hand-maintained highlight.js theme CSS in `src/styles/global.css`
(lines ~62–147 light + a dark block starting ~149), and update the copy-button
selector in `src/layouts/Base.astro` from `pre > code.hljs` to Shiki's output
(`pre.astro-code`).

**Why I paused (ponytail concern — get user's call):**
- The current hljs CSS is **theme-aware**: there's a `:root[data-theme="dark"]
  .hljs-*` block (global.css ~149+) that recolors code for dark mode, and the
  site has a light/dark toggle + custom color editor.
- Shiki bakes colors as **inline styles** → they do NOT follow the site's
  `data-theme` toggle unless you configure Shiki **dual themes**
  (`markdown.shikiConfig.themes: { light, dark }`), which emit CSS variables that
  switch on a `.shiki` / `html.dark` selector. Astro's dual-theme default keys
  off `.dark` class, but this site uses `data-theme="dark"` on `<html>` — so the
  CSS-var switch selector must be customized (`defaultColor: false` +
  `wrap`/custom CSS) or it won't react to the toggle.
- Net: Shiki deletes 121 stable, isolated CSS lines BUT (a) **visibly recolors
  code blocks** (Shiki theme ≠ current GitHub-light/dark palette) and (b) risks
  breaking code-block theming on toggle. Goal is "same look and feel."

**Recommendation:** either (A) **skip Phase 5** — keep rehype-highlight; the 121
CSS lines are isolated and the plan itself calls Shiki "later, its own visually-
diffed phase"; or (B) do it but pick Shiki themes `github-light`/`github-dark`
(matches current palette closely) with dual-theme CSS vars wired to
`data-theme`, and visually diff every code block. Ask the user which.

If doing (B), the steps are: `astro.config` → remove `rehypeHighlight` import +
its rehypePlugins entry, set `markdown.shikiConfig: { themes: { light:
'github-light', dark: 'github-dark' }, defaultColor: false }` (and drop
`syntaxHighlight: false`); add a tiny CSS rule mapping `--shiki-light/-dark` vars
to `data-theme`; delete the hljs block in global.css; change Base.astro copy hook
selector to `pre.astro-code` (and the `.code-block` wrap guard still works).
Then rebuild + browser-diff code blocks in light AND dark.

## PHASE 6 — remaining (not started)

- Top-of-file doc comments: most durable modules already have them (pre-existing
  commit + the new Phase-4 modules I wrote: content.config.ts, toc.ts, links.ts,
  rehype-markdown.ts, word-count.ts, ChapterDivider.astro, Prose.astro all have
  headers). Audit any module still missing one.
- **Stale comment references to fix** (point at deleted `render-workshop.ts` /
  `extract-toc.ts`): `src/lib/remark-wikilinks.ts` (doc comment says resolver
  built "in render-workshop.ts"), `src/lib/slugify.ts` (mentions addHeadingIds in
  render-workshop.ts), `src/lib/rehype-link-preview-keys.ts` (mentions
  render-workshop.ts). Update to point at astro.config / rehype-markdown.ts.
- Rename `extract-previews.ts` → `previews.ts` (plan target name); update import
  in `src/layouts/Base.astro`. It still uses `slugify` for heading-anchor preview
  keys — correct, matches the single-slugger DOM ids.
- Consider rename `ProgressRuler.astro` → `ScrollSpy.astro` (plan suggestion;
  update import in both route files).
- Write the tiny `README.md`. Document the Cloudflare Pages **build command**
  (`npm run sync-content && npm run build`) — it's dashboard config, not in repo.
- Delete `AUDIT.md` and `CLAUDE.md` (plan decision #2). NOTE: CLAUDE.md currently
  carries project instructions Claude reads each session — confirm with user
  before deleting, or migrate the still-true bits into README + in-code comments.

## Key architecture facts / gotchas discovered (don't relearn these)

- **`.env` now points `CONTENT_PATH=./content/res`** (was the local Obsidian
  folder). `./content` is a real clone of github.com/spark-hpi/docs (3 workshops:
  "How to Home Server", "The (Digital) Maker Map" → renders as
  "the-digital-maker-landscape", "TRMNL"). `npm run sync-content` clones/pulls it.
- **`.claude/` is now gitignored** (was accidentally swept into a commit, fixed).
- **Single slugger invariant (the big Risk-1 fix):** all heading ids come from
  `slugify` via `rehypeHeadingIds` in `src/lib/rehype-markdown.ts` (forces ids on
  h1–h6, overriding Astro's github-slugger). The TOC builder (`toc.ts`
  `headingsToToc`) computes ids as `slugify(heading.text)` and **ignores**
  Astro's `headings[].slug`. So DOM ids, `[[Page#Heading]]` wikilink anchors,
  preview keys, and scroll-spy `data-toc-link` all agree by construction.
- **Config-time wikilink resolver:** `astro.config.mjs` builds the resolver +
  `resolvePageBase` from a synchronous `loadContent()` fs scan, because remark
  plugins are registered before the content collection exists. Restart `astro
  dev` after adding/renaming pages (resolver captured once at config eval).
- **`entry.id === Node.filename`**: the glob loader uses
  `generateId: ({entry}) => entry`, so a collection entry's id equals the
  hierarchy filename (e.g. `"How to Home Server/Proxmox.md"`). Routes map
  Node→entry by this. Structure still comes from `load-content.ts` (fs scan), NOT
  the collection — the collection is only the render provider. Intentional, bounded.
- **Workshop dir derivation:** `rehype-markdown.ts` image-path rewrite + the
  preview pageBase use the **last two path segments** of the entry file path as
  the relative filename (content is exactly one level deep).
- **GFM footnotes quirk (accepted):** Astro synthesizes the footnotes section
  AFTER user rehype plugins run, so `rehypeHeadingIds` never sees it. Result: the
  footnotes label heading gets Astro's id `footnotes` while the refs'
  `aria-describedby="footnote-label"` dangles — this is Astro-default behavior we
  can't reach from a rehype plugin. The footnotes heading is filtered out of the
  TOC in `toc.ts` (`text !== "Footnotes"`).
- **Accepted, understood diffs from the pre-rework baseline** (only 9 non-cosmetic
  body lines total across all pages): (1) proxmox footnote heading id
  `footnote-label`→`footnotes` + its TOC entry removed; (2) `the-digital-maker`
  h4 headings now have slugify ids (baseline had none — single-slugger applies to
  h4–h6). Both invisible/intentional. Everything else is identical.
- **Word count** for the hero is approximate now (`src/lib/word-count.ts`, regex
  strip of code+markup). It matches baseline at display precision (e.g. 2.1k).
- **Module map after Phase 4:** new — content.config.ts, lib/{toc,links,
  rehype-markdown,word-count}.ts, components/{ChapterDivider,Prose}.astro.
  deleted — lib/{render-workshop,extract-toc}.ts + extract-toc.test.ts.
  `buildWikiResolver` now lives in `lib/remark-wikilinks.ts`.

## How to resume

1. `npm run build && npm test` to confirm green.
2. Restart `npm run preview` for browser checks.
3. Decide Phase 5 (skip vs Shiki-with-github-themes) — ask user.
4. Do Phase 6 (docs/naming/README/deletions), confirming the CLAUDE.md deletion.
