import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkWikilinks, type WikiResolver } from "./remark-wikilinks";

const resolver: WikiResolver = (name) => {
  const map: Record<string, { url: string; broken?: false }> = {
    "How To Homeserver": { url: "/how-to-homeserver" },
    "Old Hardware": { url: "/how-to-homeserver/old-hardware" },
  };
  return map[name] ?? { broken: true, url: "" };
};

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikilinks, { resolver })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

describe("remarkWikilinks", () => {
  it("rewrites a known wikilink to a link", async () => {
    const html = await render("See [[How To Homeserver]] for setup.");
    expect(html).toContain(
      '<a href="/how-to-homeserver">How To Homeserver</a>',
    );
  });

  it("supports |alias", async () => {
    const html = await render("See [[How To Homeserver|the guide]].");
    expect(html).toContain('<a href="/how-to-homeserver">the guide</a>');
  });

  it("appends #heading anchor", async () => {
    const html = await render("[[How To Homeserver#Installing Docker]]");
    expect(html).toContain('<a href="/how-to-homeserver#installing-docker">');
  });

  it("renders broken wikilinks as muted+strikethrough span", async () => {
    const html = await render("[[Existing OS]] is missing.");
    expect(html).toContain('<span class="broken">Existing OS</span>');
  });

  it("leaves text without wikilinks unchanged", async () => {
    const html = await render("Just plain text.");
    expect(html).toContain("Just plain text.");
    expect(html).not.toContain("<a");
  });
});
