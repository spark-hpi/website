import { describe, it, expect } from "vitest";
import type { Root } from "hast";
import { extractToc } from "./extract-toc";

function el(tagName: string, props: Record<string, any>, text: string): any {
  return {
    type: "element",
    tagName,
    properties: props,
    children: [{ type: "text", value: text }],
  };
}

function root(...children: any[]): Root {
  return { type: "root", children } as Root;
}

describe("extractToc", () => {
  it("emits h1/h2/h3 with tier matching tag name", () => {
    const tree = root(
      el("h1", { id: "intro" }, "Intro"),
      el("h2", { id: "background" }, "Background"),
      el("h3", { id: "detail" }, "Detail"),
    );
    expect(extractToc(tree)).toEqual([
      { tier: "h1", id: "intro", text: "Intro" },
      { tier: "h2", id: "background", text: "Background" },
      { tier: "h3", id: "detail", text: "Detail" },
    ]);
  });

  it("marks h2.chapter-divider as tier 'chapter'", () => {
    const tree = root(
      el("h2", { id: "one", className: ["chapter-divider"] }, "01 Intro"),
      el("h2", { id: "foo" }, "Foo"),
    );
    expect(extractToc(tree)).toEqual([
      { tier: "chapter", id: "one", text: "01 Intro" },
      { tier: "h2", id: "foo", text: "Foo" },
    ]);
  });

  it("accepts className as a single string", () => {
    const tree = root(
      el("h2", { id: "x", className: "chapter-divider" }, "Chapter"),
    );
    expect(extractToc(tree)[0].tier).toBe("chapter");
  });

  it("skips headings without an id", () => {
    const tree = root(el("h2", {}, "No id"), el("h2", { id: "ok" }, "OK"));
    expect(extractToc(tree)).toEqual([{ tier: "h2", id: "ok", text: "OK" }]);
  });

  it("concatenates nested text descendants", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h2",
          properties: { id: "mixed" },
          children: [
            { type: "text", value: "Hello " },
            {
              type: "element",
              tagName: "em",
              properties: {},
              children: [{ type: "text", value: "world" }],
            },
          ],
        } as any,
      ],
    };
    expect(extractToc(tree)).toEqual([
      { tier: "h2", id: "mixed", text: "Hello world" },
    ]);
  });

  it("ignores h4+ and non-heading elements", () => {
    const tree = root(
      el("h4", { id: "skip" }, "Deep"),
      el("p", { id: "para" }, "Paragraph"),
      el("h3", { id: "keep" }, "Keep"),
    );
    expect(extractToc(tree)).toEqual([
      { tier: "h3", id: "keep", text: "Keep" },
    ]);
  });
});
