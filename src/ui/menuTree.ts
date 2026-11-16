import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaCardProps, AdaLayoutSchema } from "./layoutTree.ts";

export type MenuAction = "achievements" | "backToTitle" | "settings";
export type MenuContext = "start" | "nonplay";
export type MenuControlAction = `menu-${MenuAction}` | "menu-close" | "close-menu" | "menu-exit";

const MENU_ACTIONS: readonly MenuAction[] = ["achievements", "settings"];
const NONPLAY_ACTIONS: readonly MenuAction[] = [...MENU_ACTIONS, "backToTitle"];

/** Nonplay navigation returns to title before its primary dismissal; Start omits that action. */
export function menuActions(context: MenuContext): readonly MenuAction[] {
  if (context !== "start" && context !== "nonplay") {
    throw new Error("Unknown Menu context");
  }
  return context === "start" ? MENU_ACTIONS : NONPLAY_ACTIONS;
}

export interface MenuTreeData {
  readonly closeLabel: string;
  readonly context: MenuContext;
  readonly exitLabel?: string;
  readonly labels: Readonly<Record<MenuAction, string>>;
  readonly title: string;
}

export type MenuLayoutSchema = AdaLayoutSchema<MenuControlAction> & {
  menu: { props: AdaCardProps<MenuControlAction>; slots: "actions" };
};

/** Native card/actions slots retain the approved stack geometry; callers own navigation. */
export function menuTree(
  data: MenuTreeData,
): Extract<ComponentNode<MenuLayoutSchema>, { component: "menu" }> {
  return {
    component: "menu",
    key: "menu",
    kind: "component",
    props: {
      closeAction: "close-menu",
      closeLabel: data.closeLabel,
      footerAction: "close",
      size: "small",
      title: data.title,
    },
    slots: {
      actions: [
        ...menuActions(data.context).map((action) => ({
          component: "button" as const,
          key: action,
          kind: "component" as const,
          props: {
            actionId: `menu-${action}` as const,
            label: data.labels[action],
            role: "secondary" as const,
          },
        })),
        ...(data.context === "start" && data.exitLabel !== undefined
          ? [
              {
                component: "button" as const,
                key: "exit",
                kind: "component" as const,
                props: {
                  actionId: "menu-exit" as const,
                  label: data.exitLabel,
                  role: "secondary" as const,
                },
              },
            ]
          : []),
        {
          component: "button",
          key: "close",
          kind: "component",
          props: { actionId: "menu-close", label: data.closeLabel, role: "primary" },
        },
      ],
    },
  };
}
