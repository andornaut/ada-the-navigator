import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { presentAdaButton } from "./buttonPresentation.ts";
import { CARD_CONTENT, SCROLL } from "./layout/contentCard.ts";
import { units } from "./layout/css.ts";
import { SPACING, STACK_BUTTON_GAP } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
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
  const view = root.ownerDocument.defaultView;
  const fitActionStack = () => {
    if (modal.hidden) {
      return;
    }
    actions.style.rowGap = "";
    card.body.style.rowGap = "";
    const overflow = card.body.scrollHeight - card.body.clientHeight;
    const gaps = actions.childElementCount - 1;
    if (overflow <= 0 || gaps <= 0) {
      return;
    }
    // Fit complete native faces first, using compact gaps before reducing the trailing space.
    const shortage = Math.ceil(overflow / readViewUnit(actions));
    const savedPerGap = Math.min(STACK_BUTTON_GAP - SPACING.rowGap, Math.ceil(shortage / gaps));
    actions.style.rowGap = units(STACK_BUTTON_GAP - savedPerGap);
    const tailSavings = Math.max(0, shortage - savedPerGap * gaps);
    if (tailSavings > 0) {
      card.body.style.rowGap = units(Math.max(0, CARD_CONTENT.gap - tailSavings));
    }
  };
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
    releaseUnderlay?.();
    releaseUnderlay = undefined;
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
    fitActionStack();
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
      ["menu-cheats", () => choose("cheats")],
    ]),
    availability: () => (disposed || modal.hidden ? { kind: "omitted" } : { kind: "available" }),
    presentButton: presentAdaButton,
    standardButtons: {
      actionIds: [
        "menu-achievements",
        "menu-cheats",
        "menu-settings",
        "menu-backToTitle",
        "menu-close",
      ],
      root,
    },
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
  view?.addEventListener("resize", fitActionStack);
  view?.addEventListener(VIEW_SCALE_EVENT, fitActionStack);
  return {
    close,
    dispose() {
      releaseUnderlay?.();
      releaseUnderlay = undefined;
      hide();
      disposed = true;
      view?.removeEventListener("resize", fitActionStack);
      view?.removeEventListener(VIEW_SCALE_EVENT, fitActionStack);
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
