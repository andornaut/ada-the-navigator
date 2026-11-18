import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { pauseActions } from "./pause.ts";
import { pauseTree } from "./pauseTree.ts";

describe("production Pause configuration", () => {
  it("arranges caller-provided actions without deriving policy", () => {
    const actions = pauseActions({
      backToTitle: "Back to title",
      map: "Map",
      quests: "Quests",
      resume: "Resume",
      settings: "Settings",
      ship: "Ship",
    }).map((action) => ({ ...action, hidden: action.id === "map", label: action.id }));
    const tree = pauseTree({ actions, closeLabel: "Close", title: "Paused" });
    validateLayoutTree({ actionGrid: ["buttons"], pause: ["actions"], pauseButton: [] }, tree);
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
    expect(grid.slots!.buttons!.map((node) => node.key)).toEqual([
      "map",
      "quests",
      "settings",
      "ship",
      "backToTitle",
      "resume",
    ]);
    expect(
      grid.slots!.buttons!.map((node) =>
        node.kind === "component" && node.component === "pauseButton" ? node.props : undefined,
      ),
    ).toEqual(actions);
    expect(grid.slots!.buttons!.at(-1)).toMatchObject({
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
    const button = grid.slots!.buttons![0]!;
    if (button.kind !== "component" || button.component !== "pauseButton") {
      throw Error("Expected native button");
    }
    expect(button.props).toBe(action);
  });
});
