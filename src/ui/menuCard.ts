import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { presentAdaButton } from "./buttonPresentation.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import {
  type MenuAction,
  type MenuContext,
  type MenuControlAction,
  type MenuLayoutSchema,
  menuTree,
} from "./menuTree.ts";
import { createCard } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { retainModalUnderlay } from "./modalUnderlay.ts";

export { type MenuAction, menuActions, type MenuContext } from "./menuTree.ts";

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
  const treeData = (context: MenuContext) => ({
    ...options,
    context,
  });
  const initialTree = menuTree(treeData("nonplay"));
  const card = createCard(initialTree.props);
  card.card.dataset.dialog = "menu";
  const actions = document.createElement("div");
  actions.className = "ada-actions ada-stack";
  card.body.append(actions);
  modal.append(card.frame);
  const audit = () => {
    assertAdaActionMetadata(modal);
    if (modal.isConnected) {
      assertAdaActionBindings(modal);
    }
  };
  let context: MenuContext = "nonplay";
  let origin: HTMLElement | undefined;
  let returnAction: MenuAction | undefined;
  let disposed = false;
  let releaseUnderlay: (() => void) | undefined;
  let layout: ReturnType<typeof mountLayout<MenuLayoutSchema>> | undefined;
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
    releaseUnderlay?.();
    releaseUnderlay = undefined;
    if (opener) {
      origin = opener;
    }
    root.append(modal);
    modal.hidden = false;
    layout?.dispose();
    layout = mountLayout<MenuLayoutSchema>(
      {
        components: {
          ...ports.components,
          menu: {
            create() {
              return { dispose() {}, element: card.frame, slots: { actions }, update() {} };
            },
            slots: ["actions"],
          },
        },
        host: modal,
      },
      menuTree(treeData(context)),
    );
    try {
      audit();
    } catch (error) {
      modal.hidden = true;
      layout.dispose();
      layout = undefined;
      throw error;
    }
    const focus =
      actions.querySelector<HTMLButtonElement>(`[data-action="menu-${returnAction ?? "close"}"]`) ??
      actions.querySelector<HTMLButtonElement>('[data-action="menu-close"]')!;
    card.fit();
    layer = createModalLayer(modal);
    leave = layer.open({ close, focus }, card.frame);
    options.onOpenChange(true);
  };
  const choose = (action: MenuAction) => {
    if (disposed || modal.hidden) {
      return;
    }
    returnAction = action;
    if (action !== "backToTitle") {
      releaseUnderlay?.();
      releaseUnderlay = retainModalUnderlay(modal);
    }
    hide(false);
    try {
      options.onAction(action, () => open());
    } finally {
      options.onOpenChange(false);
    }
  };
  const ports = createAdaLayoutPorts<MenuControlAction>({
    actions: new Map<MenuControlAction, () => void>([
      ["close-menu", close],
      ["menu-close", close],
      ["menu-achievements", () => choose("achievements")],
      ["menu-settings", () => choose("settings")],
      ["menu-backToTitle", () => choose("backToTitle")],
    ]),
    availability: () => (disposed || modal.hidden ? { kind: "omitted" } : { kind: "available" }),
    presentButton: presentAdaButton,
  });
  const fixedBindings = [register(card.close, close)];
  try {
    assertAdaActionMetadata(modal);
    root.append(modal);
    if (modal.isConnected) {
      assertAdaActionBindings(modal);
    }
  } catch (error) {
    for (const binding of fixedBindings) {
      binding.dispose();
    }
    card.dispose();
    modal.remove();
    throw error;
  }
  return {
    close,
    dispose() {
      releaseUnderlay?.();
      releaseUnderlay = undefined;
      hide();
      disposed = true;
      layout?.dispose();
      for (const binding of fixedBindings) {
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
