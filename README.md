# Spark

Source for the Spark workshop site. Workshops are authored in Markdown
(Obsidian-flavored: wikilinks, `up:` frontmatter, callouts) and compiled into
a static Astro site.

## Prerequisites

- Node.js ≥ 22.12
- The workshop content. The canonical source is the separate repo
  **github.com/spark-hpi/docs** (workshops live under its `res/` folder).

## Setup

```sh
bun install
git clone https://github.com/spark-hpi/docs.git ../docs
ln -s ../../docs/res ./public/res
bun run dev
```

The `public/res` folder is a symlink to the `res/` folder in the docs repo. To update the docs just pull the latest changes from the docs repo.

```
<CONTENT_PATH>/
  01 Workshop Name.md               # workshop root
  01 Workshop Name/                 # optional child-page directory
    01 Intro.md                     # child pages; need `up: "[[01 Workshop Name]]"`
    02 Setup.md
    images/                         # images referenced by this workshop's pages
      cover.png
      diagram.svg
  02 Another Workshop.md
```

Child pages without an explicit `up:` in frontmatter are auto-parented to the
workshop whose name matches their enclosing folder.

## Authoring

- **Wikilinks:** `[[Other Workshop]]`, `[[Other Workshop|alias]]`,
  `[[Other Workshop#Heading]]`. Broken links render as muted strikethrough.
- **Images:** standard Markdown `![alt](images/foo.png)`. Images in
  `<workshop>/images/` are copied into `public/images/<workshop>/` at build
  time.
- **Callouts:** Obsidian-style. Supported types: `note`, `info`, `tip`,
  `success`, `warning`, `failure`, `danger`, `bug`, `example`, `quote`,
  `abstract`, `todo`, `question`. Fold markers (`+` / `-`) are parsed but
  ignored — callouts always render expanded.

  ```markdown
  > [!warning] Optional title
  > Body text.
  ```

- **Frontmatter** (all fields optional):

  ```yaml
  ---
  title: Workshop Name
  description: One-line homepage tagline
  order: 2                       # controls homepage order
  cover: images/my-workshop/cover.png
  authors: [Vadim, Lina]
  date: 2026-04-12
  up: "[[Parent Workshop]]"      # child pages only
  ---
  ```

## Commands

```sh
bun run dev       # dev server at http://localhost:4321 with hot reload
bun run build     # static build into dist/
bun run preview   # preview the built site locally
bun run deploy    # build + deploy to Cloudflare Pages (project "spark")
bun test          # vitest
```

To publish the latest content, pull the latest changes in `../docs`
(`git -C ../docs pull`) and run `bun run deploy`.

## Where to look in the code

```
src/lib/load-content.ts  reads the markdown folder off disk
src/lib/hierarchy.ts     files → the workshop → chapter → subpage tree
src/lib/routes.ts        the ONE place a page's title, slug, and URL are decided
src/lib/rehype-markdown.ts  the remark/rehype plugins (markdown → HTML)
astro.config.mjs         where those plugins are registered into Astro
src/pages/               the routes (home, workshop, subpage, info, 404)
```

Every module has a header comment explaining what it owns — start there.
