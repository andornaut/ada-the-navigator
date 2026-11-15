import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "./layoutTree.ts";

export type ResourceAction = "close-resource" | "resource-quests" | "dismiss-resource";

export interface ResourceFooterData {
  readonly closeLabel: string;
  readonly questsLabel?: string;
}

/** The optional contextual action precedes the primary dismissal; callbacks remain caller-owned. */
export function resourceFooterTree(
  data: ResourceFooterData,
): readonly LayoutNode<AdaLayoutSchema<ResourceAction>>[] {
  return [
    ...(data.questsLabel === undefined
      ? []
      : [
          {
            component: "button" as const,
            key: "quests",
            kind: "component" as const,
            props: {
              actionId: "resource-quests" as const,
              label: data.questsLabel,
              role: "secondary" as const,
            },
          },
        ]),
    {
      component: "button",
      key: "dismiss",
      kind: "component",
      props: { actionId: "dismiss-resource", label: data.closeLabel, role: "primary" },
    },
  ];
}
