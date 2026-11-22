import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { cheatsTree } from "./cheatsTree.ts";

it("builds separate typed slots for the equal grant pair and footer", () => {
  const tree = cheatsTree("Back", [
    { id: "selectiveReset", kind: "action", label: "Selective" },
    { id: "addOre", kind: "action", label: "Add ore" },
    { id: "fpsCounter", kind: "switch", label: "FPS counter" },
    { id: "addStardust", kind: "action", label: "Add Stardust" },
  ]);
  validateLayoutTree(
    {
      action: [],
      column: ["rows"],
      footer: [],
      grants: ["buttons"],
      layout: ["columns", "footer"],
      switch: [],
    },
    tree,
  );
  expect(tree).toMatchObject({
    component: "layout",
    slots: {
      columns: [
        { component: "column", key: "progression" },
        {
          component: "column",
          key: "tools",
          slots: {
            rows: [
              { component: "switch", key: "fpsCounter" },
              {
                component: "grants",
                slots: { buttons: [{ key: "addStardust" }, { key: "addOre" }] },
              },
              { component: "action", key: "selectiveReset" },
            ],
          },
        },
      ],
      footer: [{ component: "footer", key: "dismiss", props: { label: "Back" } }],
    },
  });
});
