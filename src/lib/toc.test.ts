import { describe, it, expect } from "vitest";
import {
  headingsToToc,
  buildWorkshopToc,
  extractSubheadings,
} from "./toc";

describe("headingsToToc", () => {
  it("maps render() headings to tiers, using slugify(text) for the id", () => {
    expect(
      headingsToToc([
        { depth: 1, slug: "ignored", text: "Intro" },
        { depth: 2, slug: "ignored", text: "01 Background" },
        { depth: 3, slug: "ignored", text: "Detail" },
      ]),
    ).toEqual([
      { tier: "h1", id: "intro", text: "Intro" },
      // numeric prefix stripped by slugify — the whole point of the single slugger
      { tier: "h2", id: "background", text: "01 Background" },
      { tier: "h3", id: "detail", text: "Detail" },
    ]);
  });

  it("drops h4+ headings", () => {
    expect(headingsToToc([{ depth: 4, slug: "x", text: "Deep" }])).toEqual([]);
  });
});

describe("buildWorkshopToc", () => {
  it("stacks own headings then a chapter divider + that chapter's headings", () => {
    const toc = buildWorkshopToc(
      [{ depth: 2, slug: "", text: "Overview" }],
      [
        {
          title: "Setup",
          slug: "setup",
          headings: [{ depth: 2, slug: "", text: "Install" }],
        },
      ],
    );
    expect(toc).toEqual([
      { tier: "h2", id: "overview", text: "Overview" },
      { tier: "chapter", id: "setup", text: "Setup" },
      { tier: "h2", id: "install", text: "Install" },
    ]);
  });
});

describe("extractSubheadings", () => {
  it("reads ## headings from raw markdown and builds anchored hrefs", () => {
    const raw = "## First\nbody\n### Second\n";
    expect(extractSubheadings(raw, "/ws/page")).toEqual([
      { tier: "h2", id: "", text: "First", href: "/ws/page#first" },
      { tier: "h3", id: "", text: "Second", href: "/ws/page#second" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const raw = "## Real\n```\n## NotAHeading\n```\n";
    expect(extractSubheadings(raw, "/ws/p").map((h) => h.text)).toEqual(["Real"]);
  });
});
