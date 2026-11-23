import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { pauseActions } from "./pause.ts";
import { pauseTree } from "./pauseTree.ts";

describe("production Pause configuration", () => {
  it("arranges caller-provided actions without deriving policy", () => {
    const actions = pauseActions({
      achievements: "Achievements",
      backToTitle: "Back to title",
      cheats: "Cheats",
      map: "Map",
      quests: "Quests",
      resume: "Resume",
      settings: "Settings",
      ship: "Ship",
    }).map((action) => ({ ...action, hidden: action.id === "map", label: action.id }));
    const tree = pauseTree({ actions, closeLabel: "Close", title: "Paused" });
    validateLayoutTree(
      { actionColumn: ["buttons"], actionGrid: ["columns"], pause: ["actions"], pauseButton: [] },
      tree,
    );
    expect(tree.props).toEqual({
      closeAction: "close-pause",
      closeLabel: "Close",
      size: "medium",
      title: "Paused",
    });
    const grid = tree.slots!.actions![0]!;
    if (grid.kind !== "component" || grid.component !== "actionGrid") {
      throw Error("Expected native grid");
    }
    expect(grid.props).toEqual({});
    const [left, right] = grid.slots!.columns!;
    expect(left).toMatchObject({ component: "actionColumn", props: { side: "left" } });
    expect(right).toMatchObject({ component: "actionColumn", props: { side: "right" } });
    if (
      left?.kind !== "component" ||
      left.component !== "actionColumn" ||
      right?.kind !== "component" ||
      right.component !== "actionColumn"
    ) {
      throw Error("Expected both native columns");
    }
    expect(left.slots!.buttons!.map((node) => node.key)).toEqual([
      "cheats",
      "map",
      "quests",
      "ship",
    ]);
    expect(right.slots!.buttons!.map((node) => node.key)).toEqual([
      "achievements",
      "settings",
      "backToTitle",
      "resume",
    ]);
    expect(
      [...left.slots!.buttons!, ...right.slots!.buttons!].map((node) =>
        node.kind === "component" && node.component === "pauseButton" ? node.props : undefined,
      ),
    ).toEqual(actions);
    expect(right.slots!.buttons!.at(-1)).toMatchObject({
      props: { id: "resume", role: "primary" },
    });
  });
  it("retains the exact supplied omission/availability/label facts, including empty labels", () => {
    const action = {
      available: false,
      hidden: true,
      id: "map" as const,
      label: "",
      role: "secondary" as const,
    };
    const tree = pauseTree({
      actions: [action],
      closeLabel: "Close",
      title: "Paused",
    });
    const grid = tree.slots!.actions![0]!;
    if (grid.kind !== "component" || grid.component !== "actionGrid") {
      throw Error("Expected grid");
    }
    const left = grid.slots!.columns![0]!;
    if (left.kind !== "component" || left.component !== "actionColumn") {
      throw Error("Expected left column");
    }
    const button = left.slots!.buttons![0]!;
    if (button.kind !== "component" || button.component !== "pauseButton") {
      throw Error("Expected native button");
    }
    expect(button.props).toBe(action);
  });
});
