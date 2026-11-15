import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { PauseActionView, PausePlace } from "./pause.ts";

export interface PauseTreeAction extends PauseActionView {
  readonly hidden: boolean;
  readonly label: string;
}

export interface PauseTreeData {
  readonly actions: readonly PauseTreeAction[];
  readonly closeLabel: string;
  readonly place: PausePlace;
  readonly title: string;
}

export type PauseLayoutSchema = {
  actionGrid: { props: { readonly place: PausePlace }; slots: "buttons" };
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

/** Native stack/grid slots keep their geometry; the caller supplies order and availability. */
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
          component: "actionGrid",
          key: "actions",
          kind: "component",
          props: { place: data.place },
          slots: {
            buttons: data.actions.map((action) => ({
              component: "pauseButton",
              key: action.id,
              kind: "component",
              props: action,
            })),
          },
        },
      ],
    },
  };
}
