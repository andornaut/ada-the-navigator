import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { stationMenuTree } from "./stationMenuTree.ts";

it("orders the three Station sections before primary Undock", () => {
  const tree = stationMenuTree({
    exchange: "Exchange",
    jobsProjects: "Jobs & Projects",
    shop: "Shop",
    undock: "Undock",
  });
  validateLayoutTree({ button: [], stationMenu: ["controls"] }, tree);
  expect(tree.slots!.controls!.map(({ props }) => props)).toEqual([
    { actionId: "open-shop", id: "shop", label: "Shop", role: "secondary" },
    { actionId: "open-jobs", id: "jobs", label: "Jobs & Projects", role: "secondary" },
    { actionId: "open-exchange", id: "exchange", label: "Exchange", role: "secondary" },
    { actionId: "undock", id: "undock", label: "Undock", role: "primary" },
  ]);
});
