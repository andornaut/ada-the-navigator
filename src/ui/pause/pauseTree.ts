import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { BUTTON_GAP, STACK_BUTTON_GAP } from "../layout/tokens.ts";
import { PAUSE_RIGHT_ACTIONS, type PauseActionView } from "../pause.ts";

export interface PauseTreeAction extends PauseActionView {
  readonly hidden: boolean;
  readonly label: string;
}

export interface PauseTreeData {
  readonly actions: readonly PauseTreeAction[];
  readonly closeLabel: string;
  readonly title: string;
}

export type PauseLayoutSchema = {
  pause: {
    props: {
      readonly closeAction: "close-pause";
      readonly closeLabel: string;
      readonly size: "medium";
      readonly title: string;
    };
    slots: "actions";
  };
  pauseButton: { props: PauseTreeAction; slots: never };
};

/** Kit lays out the actions in two equal columns. The caller supplies order and availability. */
export function pauseTree(
  data: PauseTreeData,
): Extract<ComponentNode<PauseLayoutSchema>, { component: "pause" }> {
  return {
    component: "pause",
    key: "pause",
    kind: "component",
    props: {
      closeAction: "close-pause",
      closeLabel: data.closeLabel,
      size: "medium",
      title: data.title,
    },
    slots: {
      actions: [
        {
          children: (["left", "right"] as const).map((side) => ({
            children: data.actions
              .filter(({ id }) => PAUSE_RIGHT_ACTIONS.includes(id) === (side === "right"))
              .map((action) => ({
                component: "pauseButton",
                key: action.id,
                kind: "component",
                props: action,
              })),
            gap: STACK_BUTTON_GAP,
            key: side,
            kind: "stack",
            padding: 0,
          })),
          gap: BUTTON_GAP,
          key: "actions",
          kind: "columns",
          padding: 0,
          sizing: { mode: "equal" },
        },
      ],
    },
  };
}
