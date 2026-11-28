import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { BUTTON_GAP, STACK_BUTTON_GAP } from "../layout/tokens.ts";
import { pauseActions } from "../pause.ts";
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
    validateLayoutTree({ pause: ["actions"], pauseButton: [] }, tree);
    expect(tree.props).toEqual({
      closeAction: "close-pause",
      closeLabel: "Close",
      size: "medium",
      title: "Paused",
    });
    const grid = tree.slots!.actions![0]!;
    if (grid.kind !== "columns") {
      throw Error("Expected structural columns");
    }
    expect(grid).toMatchObject({ gap: BUTTON_GAP, padding: 0, sizing: { mode: "equal" } });
    const [left, right] = grid.children;
    if (left?.kind !== "stack" || right?.kind !== "stack") {
      throw Error("Expected both structural stacks");
    }
    expect(left).toMatchObject({ gap: STACK_BUTTON_GAP, key: "left", padding: 0 });
    expect(right).toMatchObject({ gap: STACK_BUTTON_GAP, key: "right", padding: 0 });
    expect(left.children.map((node) => node.key)).toEqual(["cheats", "map", "quests", "ship"]);
    expect(right.children.map((node) => node.key)).toEqual([
      "achievements",
      "settings",
      "backToTitle",
      "resume",
    ]);
    expect(
      [...left.children, ...right.children].map((node) =>
        node.kind === "component" && node.component === "pauseButton" ? node.props : undefined,
      ),
    ).toEqual(actions);
    expect(right.children.at(-1)).toMatchObject({
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
    if (grid.kind !== "columns") {
      throw Error("Expected structural columns");
    }
    const left = grid.children[0]!;
    if (left.kind !== "stack") {
      throw Error("Expected left stack");
    }
    const button = left.children[0]!;
    if (button.kind !== "component" || button.component !== "pauseButton") {
      throw Error("Expected native button");
    }
    expect(button.props).toBe(action);
  });
});
