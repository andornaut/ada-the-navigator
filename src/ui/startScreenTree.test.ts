import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { startScreenTree } from "./startScreenTree.ts";

it("preserves caller action facts without callbacks and places a known note after the row", () => {
  const tree = startScreenTree({
    actions: [
      { action: "restart", label: "New", role: "secondary" },
      { action: "continue", label: "Continue", role: "primary" },
    ],
    note: "Saved progress",
  });
  validateLayoutTree({ action: [], note: [], row: ["actions"], start: ["content"] }, tree);
  expect(tree).toMatchObject({
    slots: {
      content: [
        {
          component: "row",
          slots: {
            actions: [
              { key: "restart", props: { action: "restart", label: "New", role: "secondary" } },
              {
                key: "continue",
                props: { action: "continue", label: "Continue", role: "primary" },
              },
            ],
          },
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
      slots: { content: [{ component: "row", slots: { actions: [] } }] },
    });
    if (tree.kind !== "component" || tree.component !== "start") {
      throw Error("Missing start port");
    }
    expect(tree.slots!.content).toHaveLength(1);
  }
});
