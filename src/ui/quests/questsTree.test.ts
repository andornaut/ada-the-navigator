import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { type QuestFooterData, questsTree } from "./questsTree.ts";

const dismiss: QuestFooterData["dismiss"] = {
  actionId: "quest-close",
  intent: "close",
  label: "Close",
};
describe("native Quests footer configuration", () => {
  it("retains Previous/Next/count/primary Close and the exact caller availability facts", () => {
    const tree = questsTree({
      dismiss,
      pager: {
        count: "1/3",
        next: { disabled: false, label: "Next" },
        previous: { disabled: true, label: "Previous" },
      },
    });
    validateLayoutTree({ button: [], count: [], footer: ["controls"] }, tree);
    expect(tree.slots!.controls).toEqual([
      {
        component: "button",
        key: "previous",
        kind: "component",
        props: { action: "previous", disabled: true, label: "Previous", role: "secondary" },
      },
      {
        component: "button",
        key: "next",
        kind: "component",
        props: { action: "next", disabled: false, label: "Next", role: "secondary" },
      },
      { component: "count", key: "page-count", kind: "component", props: { text: "1/3" } },
      {
        component: "button",
        key: "dismiss",
        kind: "component",
        props: { action: "dismiss", actionId: "quest-close", label: "Close", role: "primary" },
      },
    ]);
    expect(tree.props.intent).toBe("close");
  });
  it.each(["back", "close"] as const)(
    "preserves the supplied %s dismissal without deriving origin",
    (intent) => {
      const tree = questsTree({
        dismiss: {
          actionId: intent === "back" ? "quest-back" : "quest-close",
          intent,
          label: intent === "back" ? "Back" : "Close",
        },
      });
      expect(tree.slots!.controls).toHaveLength(1);
      expect(tree.props.intent).toBe(intent);
      expect(tree.slots!.controls![0]).toMatchObject({
        props: { actionId: intent === "back" ? "quest-back" : "quest-close", role: "primary" },
      });
    },
  );
  it("retains an explicitly supplied empty All quests label ahead of primary dismissal", () => {
    const tree = questsTree({ dismiss, other: { label: "" } });
    expect(tree.slots!.controls!.map((node) => node.key)).toEqual(["other", "dismiss"]);
    expect(tree.slots!.controls![0]).toMatchObject({
      props: { actionId: "quest-other", label: "" },
    });
  });
});
