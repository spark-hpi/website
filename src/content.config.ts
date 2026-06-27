/**
 * content.config.ts — the one place workshop markdown enters Astro.
 *
 * WHAT: declares the `docs` content collection: a glob() loader over every
 *   `.md` file under CONTENT_PATH, so each file becomes a renderable Astro entry
 *   (`render(entry)` → <Content/> + headings[]). This is what makes the markdown
 *   pipeline *native* — the remark/rehype plugins in astro.config.mjs process
 *   these entries.
 * WHY: replaces the hand-rolled unified processor the project used to run by
 *   hand. Astro now owns parsing, plugin application, and code highlighting; the
 *   remark/rehype plugins are registered in astro.config.mjs.
 * CONTRACT: an entry's `id` is its path relative to CONTENT_PATH, *with* the .md
 *   extension (e.g. "How to Home Server/Proxmox.md"). That id is identical to a
 *   hierarchy Node's `filename`, so the routes map Node → entry by `node.filename`.
 * GOTCHA: the *structure* (parent/tier/slug/url) still comes from load-content.ts
 *   + hierarchy.ts (a synchronous fs scan), NOT from this collection — because
 *   astro.config needs the hierarchy at config time, before collections exist.
 *   This collection is purely the render provider. The fs scan and the glob read
 *   the same files; that duplication is intentional and bounded.
 */
import "dotenv/config";
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const CONTENT_PATH = process.env.CONTENT_PATH ?? "./content/res";

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: CONTENT_PATH,
    // id === path relative to base, e.g. "How to Home Server/Proxmox.md".
    // Keep it equal to hierarchy Node.filename so routes can map between them.
    generateId: ({ entry }) => entry,
  }),
  // Permissive: the structural fields are read by load-content.ts off disk, so
  // here we only need to accept the messy real-world frontmatter without failing
  // (e.g. `up:` is sometimes a string, sometimes a list, sometimes has a null
  // entry). passthrough() keeps anything we don't name.
  schema: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      order: z.number().optional(),
      cover: z.string().optional(),
      authors: z.array(z.string()).optional(),
      date: z.union([z.string(), z.date()]).optional(),
      up: z.any().optional(),
    })
    .passthrough(),
});

export const collections = { docs };
