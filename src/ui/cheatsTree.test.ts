import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { cheatsTree } from "./cheatsTree.ts";
it("retains caller group and item order with stable scoped keys and presentation-only facts", () => {
  const groups = [
    {
      actions: [
        { description: "First details", id: "first", label: "First" },
        { description: "Second details", id: "second", label: "Second" },
      ],
      label: "Run",
      persistence: "This run only",
      scope: "run" as const,
    },
  ];
  const tree = cheatsTree("Close", groups);
  validateLayoutTree({ footer: [], group: ["items"], groups: ["groups"], item: [] }, tree);
  expect(tree).toEqual({
    component: "groups",
    key: "cheats",
    kind: "component",
    props: {},
    slots: {
      groups: [
        {
          component: "group",
          key: "run",
          kind: "component",
          props: { label: "Run", persistence: "This run only" },
          slots: {
            items: groups[0]!.actions.map((action) => ({
              component: "item",
              key: action.id,
              kind: "component",
              props: action,
            })),
          },
        },
        { component: "footer", key: "dismiss", kind: "component", props: { label: "Close" } },
      ],
    },
  });
  expect(cheatsTree("Close", [])).toMatchObject({
    key: "cheats",
    slots: { groups: [{ component: "footer", key: "dismiss", props: { label: "Close" } }] },
  });
});
