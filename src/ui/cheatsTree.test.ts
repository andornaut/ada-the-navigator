import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { cheatsTree } from "./cheatsTree.ts";

it("builds separate typed slots for the equal grant pair and footer", () => {
  const tree = cheatsTree("Back", [
    { id: "selectiveReset", label: "Selective" },
    { id: "addOre", label: "Add ore" },
    { id: "addStardust", label: "Add Stardust" },
  ]);
  validateLayoutTree(
    {
      action: [],
      column: ["rows"],
      footer: [],
      grants: ["buttons"],
      layout: ["columns", "footer"],
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
