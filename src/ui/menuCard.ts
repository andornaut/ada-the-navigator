import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { createModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";

import { createButton, createCard } from "./modal.ts";

export type MenuAction = "achievements" | "settings";
export type MenuContext = "start" | "nonplay";

const MENU_ACTIONS: readonly MenuAction[] = ["achievements", "settings"];

/** Start and nonpausable story share one approved action list. */
export function menuActions(context: MenuContext): readonly MenuAction[] {
  if (context !== "start" && context !== "nonplay") {
    throw new Error("Unknown Menu context");
  }
  return MENU_ACTIONS;
}

export interface MenuOptions {
  readonly closeLabel: string;
  readonly labels: Readonly<Record<MenuAction, string>>;
  readonly onAction: (action: MenuAction, returnToMenu: () => void) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
}

/** Navigation only. No story, flight or save action is invoked to open, close or return. */
export function createMenuCard(root: HTMLElement, options: MenuOptions) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-menu",
    closeLabel: options.closeLabel,
    size: "small",
    title: options.title,
  });
  card.card.dataset.dialog = "menu";
  const actions = document.createElement("div");
  actions.className = "ada-actions ada-stack";
  card.body.append(actions);
  modal.append(card.frame);
  root.append(modal);
  const closeButton = createButton(options.closeLabel, "primary");
  closeButton.dataset.action = "menu-close";
  let context: MenuContext = "nonplay";
  let origin: HTMLElement | undefined;
  let returnAction: MenuAction | undefined;
  let disposed = false;
  let leave: (() => void) | undefined;
  let layer: ReturnType<typeof createModalLayer> | undefined;
  const hide = (notify = true) => {
    if (modal.hidden) {
      return;
    }
    leave?.();
    leave = undefined;
    layer?.dispose();
    layer = undefined;
    modal.hidden = true;
    if (notify) {
      options.onOpenChange(false);
    }
  };
  const close = () => {
    if (modal.hidden) {
      return;
    }
    hide();
    if (origin) {
      focusTarget(origin);
    }
  };
  const open = (opener?: HTMLElement) => {
    if (disposed || !modal.hidden) {
      return;
    }
    if (opener) {
      origin = opener;
    }
    root.append(modal);
    modal.hidden = false;
    actions.replaceChildren();
    let focus = closeButton;
    for (const action of menuActions(context)) {
      const button = createButton(options.labels[action]);
      button.dataset.action = `menu-${action}`;
      if (returnAction === action) {
        focus = button;
      }
      button.addEventListener("click", () => {
        if (disposed || modal.hidden) {
          return;
        }
        returnAction = action;
        hide(false);
        try {
          options.onAction(action, () => open());
        } finally {
          options.onOpenChange(false);
        }
      });
      actions.append(button);
    }
    actions.append(closeButton);
    card.fit();
    layer = createModalLayer(modal);
    leave = layer.open({ close, focus }, card.frame);
    options.onOpenChange(true);
  };
  closeButton.addEventListener("click", close);
  card.close.addEventListener("click", close);
  return {
    close,
    dispose() {
      hide();
      disposed = true;
      card.dispose();
      modal.remove();
    },
    isOpen: () => !modal.hidden,
    open,
    setContext(next: MenuContext) {
      context = next;
      card.card.dataset.menuContext = next;
    },
  };
}
