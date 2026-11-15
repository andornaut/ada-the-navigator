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

export interface ResourceLayoutData extends ResourceFooterData {
  readonly title: string;
  readonly description: string;
  readonly quantity?: string;
}

export type ResourceLayoutSchema = AdaLayoutSchema<ResourceAction> & {
  resource: { props: ResourceLayoutData; slots: "footer" };
};

/** The caller's native card/content port keeps its existing nodes and icon ownership. */
export function resourceTree(data: ResourceLayoutData): LayoutNode<ResourceLayoutSchema> {
  return {
    component: "resource",
    key: "resource",
    kind: "component",
    props: data,
    slots: {
      // Keep the hidden contextual button keyed across openings, as the native card does.
      footer: resourceFooterTree({ ...data, questsLabel: data.questsLabel ?? "" }),
    },
  };
}
