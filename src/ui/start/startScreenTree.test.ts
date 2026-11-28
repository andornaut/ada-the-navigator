import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { BUTTON_GAP } from "../layout/tokens.ts";
import { startScreenTree } from "./startScreenTree.ts";

it("preserves caller action facts without callbacks and places a known note after the row", () => {
  const tree = startScreenTree({
    actions: [
      { action: "restart", label: "New", role: "secondary" },
      { action: "continue", label: "Continue", role: "primary" },
    ],
    note: "Saved progress",
  });
  validateLayoutTree({ action: [], note: [], start: ["content"] }, tree);
  expect(tree).toMatchObject({
    slots: {
      content: [
        {
          children: [
            { key: "restart", props: { action: "restart", label: "New", role: "secondary" } },
            {
              key: "continue",
              props: { action: "continue", label: "Continue", role: "primary" },
            },
          ],
          gap: BUTTON_GAP,
          kind: "row",
          padding: 0,
        },
        { component: "note", key: "note", props: "Saved progress" },
      ],
    },
  });
});

it("omits absent or empty notes and keeps the native row for an empty action list", () => {
  for (const note of [undefined, null, ""]) {
    const tree = startScreenTree({ actions: [], ...(note === undefined ? {} : { note }) });
    expect(tree).toMatchObject({
      slots: { content: [{ children: [], kind: "row" }] },
    });
    if (tree.kind !== "component" || tree.component !== "start") {
      throw Error("Missing start port");
    }
    expect(tree.slots!.content).toHaveLength(1);
  }
});
