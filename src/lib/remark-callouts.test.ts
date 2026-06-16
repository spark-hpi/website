import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkCallouts } from "./remark-callouts";

async function toMdast(md: string) {
  const proc = unified().use(remarkParse).use(remarkGfm).use(remarkCallouts);
  return proc.run(proc.parse(md));
}

describe("remarkCallouts", () => {
  it("recognizes [!note] and annotates blockquote with hName/hProperties", async () => {
    const tree: any = await toMdast("> [!note]\n> Body line.");
    const bq = tree.children[0];
    expect(bq.type).toBe("blockquote");
    expect(bq.data?.hName).toBe("aside");
    expect(bq.data?.hProperties?.className).toEqual([
      "callout",
      "callout-note",
    ]);
    expect(bq.data?.hProperties?.["data-callout"]).toBe("note");
  });

  it("extracts inline title after the type", async () => {
    const tree: any = await toMdast("> [!warning] Be careful\n> Body.");
    const bq = tree.children[0];
    const titleNode = bq.children[0];
    expect(titleNode.data?.hName).toBe("div");
    expect(titleNode.data?.hProperties?.className).toEqual(["callout-title"]);
    const label = titleNode.data?.hChildren?.[1];
    expect(label?.children?.[0]?.value).toBe("Be careful");
  });

  it("defaults the label to uppercase type name when title omitted", async () => {
    const tree: any = await toMdast("> [!tip]\n> Body.");
    const titleNode = tree.children[0].children[0];
    const label = titleNode.data?.hChildren?.[1];
    expect(label?.children?.[0]?.value).toBe("TIP");
  });

  it("ignores fold suffix (+ and -) but still parses the type", async () => {
    const tree: any = await toMdast("> [!note]-\n> Body.");
    const bq = tree.children[0];
    expect(bq.data?.hProperties?.["data-callout"]).toBe("note");
  });

  it("preserves body content below the callout marker", async () => {
    const tree: any = await toMdast(
      "> [!note] Title\n> Paragraph one.\n>\n> Paragraph two.",
    );
    const bq = tree.children[0];
    // children[0] is the synthetic title row; 1..n is body
    expect(bq.children.length).toBeGreaterThanOrEqual(2);
    const bodyFirst = bq.children[1];
    expect(bodyFirst.type).toBe("paragraph");
    const txt = bodyFirst.children.map((c: any) => c.value ?? "").join("");
    expect(txt).toContain("Paragraph one.");
  });

  it("falls back to 'note' styling for unknown types but keeps the original label", async () => {
    const tree: any = await toMdast("> [!xyzzy]\n> Body.");
    const bq = tree.children[0];
    expect(bq.data?.hProperties?.className).toEqual([
      "callout",
      "callout-note",
    ]);
    expect(bq.data?.hProperties?.["data-callout"]).toBe("xyzzy");
    const label = bq.children[0].data?.hChildren?.[1];
    expect(label?.children?.[0]?.value).toBe("XYZZY");
  });

  it("leaves non-callout blockquotes untouched", async () => {
    const tree: any = await toMdast("> just a quote\n> nothing special");
    const bq = tree.children[0];
    expect(bq.data).toBeUndefined();
  });

  it("is case-insensitive on the type", async () => {
    const tree: any = await toMdast("> [!WARNING] mixed\n> Body.");
    const bq = tree.children[0];
    expect(bq.data?.hProperties?.className).toEqual([
      "callout",
      "callout-warning",
    ]);
    expect(bq.data?.hProperties?.["data-callout"]).toBe("warning");
  });
});
