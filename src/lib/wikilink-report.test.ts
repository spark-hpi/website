import { describe, it, expect } from "vitest";
import { buildWikiResolver } from "./remark-wikilinks";
import { checkWikilinks, formatWikilinkIssues } from "./wikilink-report";

const home = {
  filename: "ws/Home.md",
  url: "/ws",
  rawContent: [
    "## Setup",
    "See [[Other Page]] and [[Nope]] and [[Other Page#Missing]].",
    "Also [[#Setup]] and [[#Gone]] and [[Other Page#^blk]].",
    "```",
    "[[Fenced Link]]",
    "```",
    "![[img.png]]",
  ].join("\n"),
};
const other = {
  filename: "ws/Other Page.md",
  url: "/ws/other-page",
  rawContent: "## Details\n",
};

const hierarchy = {
  byBasename: new Map([
    ["Home", home],
    ["Other Page", other],
  ]),
  byFilename: new Map([
    [home.filename, home],
    [other.filename, other],
  ]),
};

describe("checkWikilinks", () => {
  const issues = checkWikilinks(
    hierarchy.byFilename.values(),
    buildWikiResolver(hierarchy),
  );

  it("reports missing pages, missing headings and block refs", () => {
    expect(issues).toEqual([
      { file: "ws/Home.md", raw: "[[Nope]]", reason: "page" },
      { file: "ws/Home.md", raw: "[[Other Page#Missing]]", reason: "heading" },
      { file: "ws/Home.md", raw: "[[#Gone]]", reason: "heading" },
      { file: "ws/Home.md", raw: "[[Other Page#^blk]]", reason: "block-ref" },
    ]);
  });

  it("ignores embeds, code blocks and links that resolve", () => {
    const raws = issues.map((i) => i.raw).join(" ");
    expect(raws).not.toContain("Fenced Link");
    expect(raws).not.toContain("img.png");
    expect(raws).not.toContain("[[Other Page]]");
    expect(raws).not.toContain("[[#Setup]]");
  });

  it("formats one line per issue", () => {
    expect(formatWikilinkIssues(issues).split("\n")).toHaveLength(4);
    expect(formatWikilinkIssues(issues)).toContain(
      "ws/Home.md: [[Nope]] — no page with that name",
    );
  });
});
