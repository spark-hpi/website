import "dotenv/config";
import { defineCollection, z } from "astro:content";
import { loadContent } from "./lib/load-content";
import { slugify, stripNumericPrefix, shortName } from "./lib/slugify";

const workshops = defineCollection({
  loader: {
    name: "spark-workshops",
    load: async ({ store, parseData, generateDigest, renderMarkdown }) => {
      const { hierarchy } = loadContent();
      store.clear();
      for (const node of hierarchy.byFilename.values()) {
        const baseTitle =
          node.title ?? stripNumericPrefix(shortName(node.filename));
        const slug = slugify(baseTitle);
        const rootNode = hierarchy.byFilename.get(node.workshopRootFilename)!;
        const workshopSlug = slugify(
          rootNode.title ??
            stripNumericPrefix(shortName(node.workshopRootFilename)),
        );
        const body = node.rawContent ?? "";
        const rawData = {
          filename: node.filename,
          title: baseTitle,
          slug,
          workshopSlug,
          depth: node.depth,
          order: node.order ?? null,
          upTargets: node.upTargets,
          children: node.children.map((c) => c.filename),
        };
        const data = await parseData({ id: node.filename, data: rawData });
        const rendered = await renderMarkdown(body);
        store.set({
          id: node.filename,
          data,
          body,
          rendered,
          digest: generateDigest(body),
        });
      }
    },
  },
  schema: z.object({
    filename: z.string(),
    title: z.string(),
    slug: z.string(),
    workshopSlug: z.string(),
    depth: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    order: z.number().nullable(),
    upTargets: z.array(z.string()),
    children: z.array(z.string()),
  }),
});

export const collections = { workshops };
