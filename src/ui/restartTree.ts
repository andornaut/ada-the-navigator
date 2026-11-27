import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "./layoutTree.ts";
import type { RestartLabels } from "./restartCard.ts";

/** Start confirmations and the selective campaign rewind in Cheats. */
export type ConfirmKind = "restart" | "rewind-quests" | "exit-prompt";

export type ConfirmAction<K extends ConfirmKind = ConfirmKind> =
  `close-${K}` | `${K}-cancel` | `${K}-confirm`;

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
      body: Boolean(labels.body),
      closeAction: `close-${kind}`,
      closeLabel: labels.close,
      footerAction: "close",
      size: "small",
      title: labels.title,
    },
    slots: {
      ...(labels.body
        ? {
            body: [
              { component: "text", key: "body", kind: "component", props: { text: labels.body } },
            ],
          }
        : {}),
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
