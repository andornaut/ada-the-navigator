import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { dialoguePanelTree, storyPanelTree } from "./dialoguePanelTree.ts";

it("composes native copy, portrait, choices and navigation without introducing wrapper elements", () => {
  const tree = dialoguePanelTree(true);
  validateLayoutTree({ container: ["children"], native: [] }, tree);
  const shape = (node: typeof tree): unknown =>
    node.component === "native"
      ? node.props
      : [
          node.props,
          node.slots!.children!.map((child) => {
            if (child.kind !== "component") {
              throw Error("Unexpected layout wrapper");
            }
            return shape(child);
          }),
        ];
  expect(shape(tree)).toEqual([
    "frame",
    [
      [
        "card",
        [
          ["copy", [["body", ["title", ["portrait", ["face"]], "speaker", "words"]]]],
          ["column", ["choices", "controls"]],
        ],
      ],
      "skip",
      "close",
    ],
  ]);
  expect(dialoguePanelTree(false).slots?.children?.map((node) => node.key)).toEqual([
    "card",
    "close",
  ]);
});

it("keeps Storybook copy and portrait ahead of choices and Previous/Next without touching the Art host", () => {
  const tree = storyPanelTree();
  validateLayoutTree({ container: ["children"], native: [] }, tree);
  const shape = (node: typeof tree): unknown =>
    node.component === "native"
      ? node.props
      : [
          node.props,
          node.slots!.children!.map((child) => {
            if (child.kind !== "component") {
              throw Error("Unexpected wrapper");
            }
            return shape(child);
          }),
        ];
  expect(shape(tree)).toEqual([
    "card",
    [
      ["copy", [["body", ["title", ["portrait", ["face"]], "speaker", "words"]]]],
      ["column", ["choices", ["controls", ["previous", "next"]]]],
    ],
  ]);
});
