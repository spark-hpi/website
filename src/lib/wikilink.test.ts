import { describe, it, expect } from "vitest";
import { headingSlugs, parseWikilinks, stripCode } from "./wikilink";

describe("parseWikilinks", () => {
  it("parses a bare link", () => {
    expect(parseWikilinks("see [[Page]] now")).toEqual([
      {
        raw: "[[Page]]",
        index: 4,
        embed: false,
        name: "Page",
        heading: undefined,
        aliasParts: [],
      },
    ]);
  });

  it("parses alias, heading, and both", () => {
    const [alias] = parseWikilinks("[[Page|shown]]");
    expect(alias.aliasParts).toEqual(["shown"]);
    const [heading] = parseWikilinks("[[Page#Some Heading]]");
    expect(heading).toMatchObject({ name: "Page", heading: "Some Heading" });
    const [both] = parseWikilinks("[[Page#Head|shown]]");
    expect(both).toMatchObject({
      name: "Page",
      heading: "Head",
      aliasParts: ["shown"],
    });
  });

  it("parses a same-page [[#Heading]] link", () => {
    expect(parseWikilinks("[[#Linux (Debian / Proxmox)]]")).toMatchObject([
      { name: "", heading: "Linux (Debian / Proxmox)" },
    ]);
  });

  it("parses an escaped pipe as part of the alias", () => {
    expect(parseWikilinks("[[Page\\|alias]]")).toMatchObject([
      { name: "Page", aliasParts: ["alias"] },
    ]);
  });

  it("parses embeds with width and caption", () => {
    expect(parseWikilinks("![[img.png|200|A caption]]")).toMatchObject([
      { embed: true, name: "img.png", aliasParts: ["200", "A caption"] },
    ]);
  });

  it("ignores empty targets", () => {
    expect(parseWikilinks("[[]] [[#]] [[|x]]")).toEqual([]);
  });

  it("finds several links in one string", () => {
    expect(parseWikilinks("[[A]] and [[B]]").map((t) => t.name)).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("stripCode", () => {
  it("drops fenced blocks and inline code", () => {
    const md = ["[[Keep]]", "```sh", "[[Fenced]]", "```", "`[[Inline]]`"].join(
      "\n",
    );
    const out = stripCode(md);
    expect(out).toContain("[[Keep]]");
    expect(out).not.toContain("[[Fenced]]");
    expect(out).not.toContain("[[Inline]]");
  });
});

describe("headingSlugs", () => {
  it("collects h1–h6 slugs and skips code", () => {
    const md = ["# Top", "### Deep One", "```", "# Not A Heading", "```"].join(
      "\n",
    );
    expect([...headingSlugs(md)]).toEqual(["top", "deep-one"]);
  });

  it("ignores trailing closing hashes", () => {
    expect([...headingSlugs("## Setup ##")]).toEqual(["setup"]);
  });
});
