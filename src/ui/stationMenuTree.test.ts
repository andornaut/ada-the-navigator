import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { stationMenuTree } from "./stationMenuTree.ts";

const labels = { continue: "Continue", jobs: "Jobs", shop: "Shop", undock: "Undock" };
describe("native Station root configuration", () => {
  it("places balance and Jobs above the greeting or final action row", () => {
    const tree = stationMenuTree(labels);
    validateLayoutTree({ balance: [], button: [], stationMenu: ["choices", "controls"] }, tree);
    expect(tree.slots!.choices!.map((node) => node.key)).toEqual(["balance", "jobs"]);
    expect(tree.slots!.controls!.map((node) => node.key)).toEqual([
      "next-greeting",
      "undock",
      "shop",
    ]);
    expect(tree.slots!.controls![2]).toMatchObject({
      props: { actionId: "open-shop", label: "Shop", role: "primary" },
    });
    expect(tree.slots!.controls![0]).toMatchObject({
      props: { id: "nextGreeting", label: "Continue", role: "primary" },
    });
    expect(tree.slots!.controls![0]).not.toHaveProperty("props.actionId");
  });
  it("keeps all stable nodes when supplied labels are empty; services remain caller-owned", () => {
    const tree = stationMenuTree({ continue: "", jobs: "", shop: "", undock: "" });
    expect(tree.slots!.choices).toHaveLength(2);
    expect(tree.slots!.controls).toHaveLength(3);
    expect(tree.slots!.choices![1]).toMatchObject({ props: { label: "" } });
    expect(tree.props).toEqual({});
  });
});
