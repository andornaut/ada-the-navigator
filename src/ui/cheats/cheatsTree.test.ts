import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { cheatsTree } from "./cheatsTree.ts";

it("builds the grant pair as equal columns and keeps the footer in its own slot", () => {
  const tree = cheatsTree("Back", [
    { id: "selectiveReset", label: "Selective" },
    { id: "maxWeaponLevels", label: "Maximize weapon levels" },
    { id: "unlockAllWeapons", label: "Unlock all weapons" },
    { id: "unlockAllEquipment", label: "Unlock all equipment" },
    { id: "unlockAllGalaxies", label: "Unlock all galaxies" },
    { id: "addOre", label: "Add ore" },
    { id: "addStardust", label: "Add Stardust" },
  ]);
  validateLayoutTree(
    {
      action: [],
      column: ["rows"],
      footer: [],
      layout: ["columns", "footer"],
    },
    tree,
  );
  expect(tree).toMatchObject({
    component: "layout",
    slots: {
      columns: [
        {
          component: "column",
          key: "progression",
          slots: {
            rows: [
              { key: "unlockAllEquipment" },
              { key: "unlockAllGalaxies" },
              { key: "unlockAllWeapons" },
            ],
          },
        },
        {
          component: "column",
          key: "tools",
          slots: {
            rows: [
              {
                children: [{ key: "addStardust" }, { key: "addOre" }],
                gap: 8,
                key: "grants",
                kind: "columns",
                padding: 0,
                sizing: { mode: "equal" },
              },
              { component: "action", key: "maxWeaponLevels" },
              { component: "action", key: "selectiveReset" },
            ],
          },
        },
      ],
      footer: [{ component: "footer", key: "dismiss", props: { label: "Back" } }],
    },
  });
});
