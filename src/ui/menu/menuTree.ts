import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { STACK_BUTTON_GAP } from "../layout/tokens.ts";
import type { AdaCardProps, AdaLayoutSchema } from "../layoutTree.ts";

export type MenuAction = "achievements" | "backToTitle" | "cheats" | "settings";
export type MenuContext = "start" | "nonplay";
export type MenuControlAction = `menu-${MenuAction}` | "menu-close" | "close-menu";

const MENU_ACTIONS: readonly MenuAction[] = ["achievements", "cheats", "settings"];
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
  readonly labels: Readonly<Record<MenuAction, string>>;
  readonly title: string;
}

export type MenuLayoutSchema = AdaLayoutSchema<MenuControlAction> & {
  menu: { props: AdaCardProps<MenuControlAction>; slots: "actions" };
};

type MenuButton = Extract<ComponentNode<MenuLayoutSchema>, { component: "button" }>;

function menuButton(
  key: string,
  actionId: MenuControlAction,
  label: string,
  role: "primary" | "secondary",
): MenuButton {
  return { component: "button", key, kind: "component", props: { actionId, label, role } };
}

/**
 * Native card/actions slots retain the approved stack geometry; callers own navigation. The
 * buttons sort by label, followed by Back to title outside Start and primary Close.
 */
export function menuTree(
  data: MenuTreeData,
): Extract<ComponentNode<MenuLayoutSchema>, { component: "menu" }> {
  const actions = menuActions(data.context);
  const sorted = actions
    .filter((action) => action !== "backToTitle")
    .map((action) => menuButton(action, `menu-${action}`, data.labels[action], "secondary"))
    .sort((a, b) => a.props.label.localeCompare(b.props.label));
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
        {
          children: [
            ...sorted,
            ...(actions.includes("backToTitle")
              ? [
                  menuButton(
                    "backToTitle",
                    "menu-backToTitle",
                    data.labels.backToTitle,
                    "secondary",
                  ),
                ]
              : []),
            menuButton("close", "menu-close", data.closeLabel, "primary"),
          ],
          gap: STACK_BUTTON_GAP,
          key: "action-stack",
          kind: "stack",
          padding: 0,
        },
      ],
    },
  };
}
