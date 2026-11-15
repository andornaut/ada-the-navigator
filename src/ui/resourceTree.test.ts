import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { resourceFooterTree } from "./resourceTree.ts";

const slots = { button: [], card: ["header", "body", "footer"], text: [] } as const;

describe("resource detail footer configuration", () => {
  it("omits an absent contextual action and retains primary Close without a placeholder", () => {
    const nodes = resourceFooterTree({ closeLabel: "Close" });
    expect(nodes).toEqual([
      {
        component: "button",
        key: "dismiss",
        kind: "component",
        props: { actionId: "dismiss-resource", label: "Close", role: "primary" },
      },
    ]);
    for (const node of nodes) {
      validateLayoutTree(slots, node);
    }
  });

  it("keeps current authored labels, secondary Quests first and stable identities on update", () => {
    const nodes = resourceFooterTree({ closeLabel: "Close", questsLabel: "Quests" });
    expect(nodes).toEqual([
      {
        component: "button",
        key: "quests",
        kind: "component",
        props: { actionId: "resource-quests", label: "Quests", role: "secondary" },
      },
      {
        component: "button",
        key: "dismiss",
        kind: "component",
        props: { actionId: "dismiss-resource", label: "Close", role: "primary" },
      },
    ]);
    const updated = resourceFooterTree({ closeLabel: "Dismiss", questsLabel: "" });
    expect(updated.map((node) => node.key)).toEqual(nodes.map((node) => node.key));
    expect(updated[0]).toMatchObject({ props: { actionId: "resource-quests", label: "" } });
    expect(updated[1]).toMatchObject({ props: { actionId: "dismiss-resource", label: "Dismiss" } });
    for (const node of updated) {
      validateLayoutTree(slots, node);
    }
  });
});
