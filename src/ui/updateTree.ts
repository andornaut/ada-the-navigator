import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "./layoutTree.ts";
import type { UpdateLabels } from "./updateDialog.ts";

export type UpdateAction = "close-update" | "cancel-update" | "accept-update";
export type UpdateSchema = AdaLayoutSchema<UpdateAction> & {
  update: { props: UpdateLabels; slots: "footer" };
};

/** Offer state and original callbacks stay outside declarative composition. */
export function updateTree(labels: UpdateLabels): LayoutNode<UpdateSchema> {
  return {
    component: "update",
    key: "update",
    kind: "component",
    props: labels,
    slots: {
      footer: [
        {
          component: "button",
          key: "cancel",
          kind: "component",
          props: { actionId: "cancel-update", label: labels.cancel, role: "secondary" },
        },
        {
          component: "button",
          key: "accept",
          kind: "component",
          props: { actionId: "accept-update", label: labels.accept, role: "primary" },
        },
      ],
    },
  };
}
