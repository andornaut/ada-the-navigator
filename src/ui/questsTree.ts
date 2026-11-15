import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type QuestFooterAction = "dismiss" | "other" | "previous" | "next";
export interface QuestFooterData {
  readonly dismiss: {
    readonly actionId: "quest-back" | "quest-close";
    readonly intent: "back" | "close";
    readonly label: string;
  };
  readonly other?: { readonly label: string };
  readonly pager?: {
    readonly count: string;
    readonly next: { readonly disabled: boolean; readonly label: string };
    readonly previous: { readonly disabled: boolean; readonly label: string };
  };
}
export type QuestsFooterSchema = {
  button: {
    props: {
      readonly action: QuestFooterAction;
      readonly actionId?: string;
      readonly disabled?: boolean;
      readonly label: string;
      readonly role: "primary" | "secondary";
    };
    slots: never;
  };
  count: { props: { readonly text: string }; slots: never };
  footer: { props: { readonly intent: "back" | "close" }; slots: "controls" };
};

/** Ordered native controls only; origin, page state and callbacks remain caller-owned. */
export function questsTree(
  data: QuestFooterData,
): Extract<ComponentNode<QuestsFooterSchema>, { component: "footer" }> {
  return {
    component: "footer",
    key: "quests-footer",
    kind: "component",
    props: { intent: data.dismiss.intent },
    slots: {
      controls: [
        ...(data.other === undefined
          ? []
          : [
              {
                component: "button" as const,
                key: "other",
                kind: "component" as const,
                props: {
                  action: "other" as const,
                  actionId: "quest-other",
                  label: data.other.label,
                  role: "secondary" as const,
                },
              },
            ]),
        ...(data.pager === undefined
          ? []
          : [
              {
                component: "button" as const,
                key: "previous",
                kind: "component" as const,
                props: {
                  action: "previous" as const,
                  ...data.pager.previous,
                  role: "secondary" as const,
                },
              },
              {
                component: "button" as const,
                key: "next",
                kind: "component" as const,
                props: { action: "next" as const, ...data.pager.next, role: "secondary" as const },
              },
              {
                component: "count" as const,
                key: "page-count",
                kind: "component" as const,
                props: { text: data.pager.count },
              },
            ]),
        {
          component: "button",
          key: "dismiss",
          kind: "component",
          props: {
            action: "dismiss",
            actionId: data.dismiss.actionId,
            label: data.dismiss.label,
            role: "primary",
          },
        },
      ],
    },
  };
}
