import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { bindAdaAction } from "./actionBinding.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, createCard } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";

export type MenuAction = "achievements" | "backToTitle" | "settings";
export type MenuContext = "start" | "nonplay";

const MENU_ACTIONS: readonly MenuAction[] = ["achievements", "settings"];
const NONPLAY_ACTIONS: readonly MenuAction[] = [...MENU_ACTIONS, "backToTitle"];

/** Nonplay navigation returns to title before its primary dismissal; Start omits that action. */
export function menuActions(context: MenuContext): readonly MenuAction[] {
  if (context !== "start" && context !== "nonplay") {
    throw new Error("Unknown Menu context");
  }
  return context === "start" ? MENU_ACTIONS : NONPLAY_ACTIONS;
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
  const generatedBindings: ReturnType<typeof bindAdaAction>[] = [];
  const register = (element: HTMLElement, run: () => void) =>
    bindAdaAction(
      {
        click: { availability: () => ({ kind: "available" }), run },
        current: () => !disposed,
        slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
      },
      element,
    );
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
    for (const binding of generatedBindings) {
      binding.dispose();
    }
    generatedBindings.length = 0;
    actions.replaceChildren();
    let focus = closeButton;
    for (const action of menuActions(context)) {
      const button = createButton(options.labels[action]);
      button.dataset.action = `menu-${action}`;
      if (returnAction === action) {
        focus = button;
      }
      generatedBindings.push(
        register(button, () => {
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
        }),
      );
      actions.append(button);
    }
    actions.append(closeButton);
    card.fit();
    layer = createModalLayer(modal);
    leave = layer.open({ close, focus }, card.frame);
    options.onOpenChange(true);
  };
  const fixedBindings = [register(closeButton, close), register(card.close, close)];
  return {
    close,
    dispose() {
      hide();
      disposed = true;
      for (const binding of [...generatedBindings, ...fixedBindings]) {
        binding.dispose();
      }
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
