import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { BUTTON_GAP, type StartAction } from "./layout/index.ts";

export interface StartActionData {
  readonly action: StartAction;
  readonly label: string;
  readonly role: "primary" | "secondary";
}
export type StartScreenSchema = {
  start: { props: Record<string, never>; slots: "content" };
  action: { props: StartActionData; slots: never };
  note: { props: string; slots: never };
};

/** Caller facts select the native action row and status note; callbacks stay outside the tree. */
export function startScreenTree(data: {
  readonly actions: readonly StartActionData[];
  readonly note?: string | null;
}): LayoutNode<StartScreenSchema> {
  return {
    component: "start",
    key: "start",
    kind: "component",
    props: {},
    slots: {
      content: [
        {
          children: data.actions.map(({ action, label, role }) => ({
            component: "action",
            key: action,
            kind: "component",
            props: { action, label, role },
          })),
          gap: BUTTON_GAP,
          key: "actions",
          kind: "row",
          padding: 0,
        },
        ...(data.note
          ? [
              {
                component: "note" as const,
                key: "note",
                kind: "component" as const,
                props: data.note,
              },
            ]
          : []),
      ],
    },
  };
}
