import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "./layoutTree.ts";
import type { RestartLabels } from "./restartCard.ts";

/** The confirm cards: Restart on the start screen and Reset save in the Cheats modal. */
export type ConfirmKind = "reset-save" | "restart";

export type ConfirmAction<K extends ConfirmKind = ConfirmKind> =
  `close-${K}` | `${K}-cancel` | `${K}-confirm`;

export type RestartAction = ConfirmAction<"restart">;

/** Runtime and component fixtures consume the same confirmation data. */
export function restartTree<K extends ConfirmKind = "restart">(
  labels: RestartLabels,
  kind: K = "restart" as K,
): LayoutNode<AdaLayoutSchema<ConfirmAction<K>>> {
  return {
    component: "card",
    key: kind,
    kind: "component",
    props: {
      body: false,
      closeAction: `close-${kind}`,
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
          props: { actionId: `${kind}-cancel`, label: labels.cancel, role: "secondary" },
        },
        {
          component: "button",
          key: "confirm",
          kind: "component",
          props: { actionId: `${kind}-confirm`, label: labels.restart, role: "primary" },
        },
      ],
    },
  };
}
