/**
 * remark-callouts.ts — render Obsidian callouts.
 *
 * Responsibility: a remark plugin that turns a blockquote beginning with
 *   `> [!note] Optional title` into <aside class="callout callout-note"> with a
 *   title row. Unknown types fall back to "note". Example:
 *     > [!warning] Heads up      →   <aside class="callout callout-warning">…
 *     > body text
 * Gotcha: Obsidian fold markers (`[!note]+` / `[!note]-`) parse but are ignored;
 *   callouts are always expanded. (A maintained alternative is the rehype-callouts
 *   package if this ever needs nesting/fold support.)
 */
import type { Plugin } from "unified";
import type { Root, Blockquote, Paragraph, Text } from "mdast";
import { visit } from "unist-util-visit";

const CALLOUT_RE = /^\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/;

const KNOWN_TYPES = new Set([
  "note",
  "info",
  "tip",
  "success",
  "warning",
  "failure",
  "danger",
  "bug",
  "example",
  "quote",
  "abstract",
  "todo",
  "question",
]);

export const remarkCallouts: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, "blockquote", (node: Blockquote) => {
    const first = node.children[0];
    if (!first || first.type !== "paragraph") return;
    const firstText = first.children[0] as Text | undefined;
    if (!firstText || firstText.type !== "text") return;

    const value = firstText.value;
    const newlineIdx = value.indexOf("\n");
    const firstLine = newlineIdx === -1 ? value : value.slice(0, newlineIdx);
    const rest = newlineIdx === -1 ? "" : value.slice(newlineIdx + 1);

    const m = CALLOUT_RE.exec(firstLine);
    if (!m) return;

    const typeRaw = m[1].toLowerCase();
    const type = KNOWN_TYPES.has(typeRaw) ? typeRaw : "note";
    const title = m[3].trim();
    const labelText = title.length > 0 ? title : typeRaw.toUpperCase();

    // Strip the marker line from the first text node.
    if (rest.length > 0) {
      firstText.value = rest;
    } else {
      first.children.shift();
      if (first.children.length === 0) {
        node.children.shift();
      }
    }

    const titleNode: Paragraph = {
      type: "paragraph",
      children: [],
      data: {
        hName: "div",
        hProperties: { className: ["callout-title"] },
        hChildren: [
          {
            type: "element",
            tagName: "span",
            properties: {
              className: ["callout-icon"],
              "aria-hidden": "true",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "span",
            properties: { className: ["callout-label"] },
            children: [{ type: "text", value: labelText }],
          },
        ],
      },
    };
    node.children.unshift(titleNode);

    node.data = {
      ...(node.data ?? {}),
      hName: "aside",
      hProperties: {
        className: ["callout", `callout-${type}`],
        "data-callout": typeRaw,
      },
    };
  });
};
