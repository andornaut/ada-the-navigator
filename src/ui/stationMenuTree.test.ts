import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { stationMenuTree } from "./stationMenuTree.ts";

const labels = { jobs: "Jobs", nextLine: "Next", shop: "Shop", undock: "Undock" };
describe("native Station root configuration", () => {
  it("orders balance/Jobs/primary Shop and Next/Undock in the original dialogue slots", () => {
    const tree = stationMenuTree(labels);
    validateLayoutTree({ balance: [], button: [], stationMenu: ["choices", "controls"] }, tree);
    expect(tree.slots!.choices!.map((node) => node.key)).toEqual(["balance", "jobs", "shop"]);
    expect(tree.slots!.controls!.map((node) => node.key)).toEqual(["next-greeting", "undock"]);
    expect(tree.slots!.choices![2]).toMatchObject({
      props: { actionId: "open-shop", label: "Shop", role: "primary" },
    });
    expect(tree.slots!.controls![0]).toMatchObject({
      props: { id: "nextGreeting", label: "Next", role: "secondary" },
    });
    expect(tree.slots!.controls![0]).not.toHaveProperty("props.actionId");
  });
  it("keeps all stable nodes when supplied labels are empty; services remain caller-owned", () => {
    const tree = stationMenuTree({ jobs: "", nextLine: "", shop: "", undock: "" });
    expect(tree.slots!.choices).toHaveLength(3);
    expect(tree.slots!.controls).toHaveLength(2);
    expect(tree.slots!.choices![1]).toMatchObject({ props: { label: "" } });
    expect(tree.props).toEqual({});
  });
});
