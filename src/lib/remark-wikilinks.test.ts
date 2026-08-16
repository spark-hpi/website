import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import {
  buildWikiResolver,
  remarkWikilinks,
  type WikiResolver,
} from "./remark-wikilinks";

const pages = {
  "How To Homeserver": {
    url: "/how-to-homeserver",
    rawContent: "# Intro\n## Installing Docker\n",
  },
  "Old Hardware": {
    url: "/how-to-homeserver/old-hardware",
    rawContent: "## Reuse\n",
  },
};

const hierarchy = {
  byBasename: new Map(Object.entries(pages)),
  byFilename: new Map([["ws/How To Homeserver.md", pages["How To Homeserver"]]]),
};

const resolver: WikiResolver = buildWikiResolver(hierarchy);

async function render(md: string, path?: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikilinks, { resolver })
    // No allowDangerousHtml: the plugin must emit mdast only.
    .use(remarkRehype)
    .use(rehypeStringify)
    .process({ value: md, path });
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

  it("supports an escaped pipe alias (tables)", async () => {
    const html = await render("[[How To Homeserver\\|the guide]]");
    expect(html).toContain('<a href="/how-to-homeserver">the guide</a>');
  });

  it("appends #heading anchor", async () => {
    const html = await render("[[How To Homeserver#Installing Docker]]");
    expect(html).toContain('<a href="/how-to-homeserver#installing-docker">');
  });

  it("links [[#Heading]] to an anchor on the current page", async () => {
    const html = await render(
      "[[#Installing Docker]]",
      "/content/ws/How To Homeserver.md",
    );
    expect(html).toContain('<a href="#installing-docker">');
  });

  it("renders broken wikilinks as a span, without raw HTML", async () => {
    const html = await render("[[Existing OS]] is missing.");
    expect(html).toContain('<span class="broken">Existing OS</span>');
  });

  it("drops a dead #heading anchor but keeps the page link", async () => {
    expect(await render("[[How To Homeserver#Nope]]")).toContain(
      '<a href="/how-to-homeserver">',
    );
  });

  it("drops Obsidian block references", async () => {
    expect(await render("[[Old Hardware#^abc123]]")).toContain(
      '<a href="/how-to-homeserver/old-hardware">',
    );
  });

  it("renders a dead same-page anchor as broken", async () => {
    const html = await render("[[#Nope]]", "/content/ws/How To Homeserver.md");
    expect(html).toContain('<span class="broken">#Nope</span>');
  });

  it("renders image embeds with width and caption", async () => {
    const html = await render("![[img.png|200|A caption]]");
    expect(html).toContain('src="img.png"');
    expect(html).toContain('alt="A caption"');
    expect(html).toContain('title="200"');
  });

  it("leaves text without wikilinks unchanged", async () => {
    const html = await render("Just plain text.");
    expect(html).toContain("Just plain text.");
    expect(html).not.toContain("<a");
  });

  it("ignores wikilinks inside code spans", async () => {
    const html = await render("`[[How To Homeserver]]`");
    expect(html).toContain("<code>[[How To Homeserver]]</code>");
  });
});
