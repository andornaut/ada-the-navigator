import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "./layoutTree.ts";
import type { RestartLabels } from "./restartCard.ts";

export type RestartAction = "close-restart" | "restart-cancel" | "restart-confirm";

/** Runtime and component fixtures consume the same confirmation data. */
export function restartTree(labels: RestartLabels): LayoutNode<AdaLayoutSchema<RestartAction>> {
  return {
    component: "card",
    key: "restart",
    kind: "component",
    props: {
      body: false,
      closeAction: "close-restart",
      closeLabel: labels.close,
      footerAction: "close",
      size: "small",
      title: labels.title,
    },
    slots: {
      footer: [
        {
          component: "button",
          key: "cancel",
          kind: "component",
          props: { actionId: "restart-cancel", label: labels.cancel, role: "secondary" },
        },
        {
          component: "button",
          key: "confirm",
          kind: "component",
          props: { actionId: "restart-confirm", label: labels.restart, role: "primary" },
        },
      ],
    },
  };
}
