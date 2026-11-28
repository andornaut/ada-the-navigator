import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import { REFUSAL_ATTRIBUTES } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import { CHEAT_COPY } from "../../data/cheatCopy.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  inCurrentView,
} from "../actions/index.ts";
import { type CheatAction, runCheatAction } from "../cheatActions.ts";
import { SCROLL } from "../layout/index.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "../layoutDom/index.ts";
import { createActions, createCard, setFooterAction } from "../modal.ts";
import { createStandardCloseAction } from "../modalClose.ts";
import { createModalLayer } from "../modalLayer.ts";
import { refuse } from "../refusal.ts";
import { createStandardTextAction } from "../standardTextAction.ts";
import { type CheatRowData, type CheatsSchema, cheatsTree } from "./cheatsTree.ts";

export interface CheatLabels {
  readonly back: string;
  readonly close: string;
  readonly title: string;
}

interface CheatOptions {
  readonly rows: readonly CheatAction[];
  readonly labels: CheatLabels;
  readonly onOpenChange: (open: boolean) => void;
  readonly reducedMotion: () => boolean;
}

/** The Cheats card owns its actions. Navigation owns the entry and return focus. */
export function createCheats(parent: HTMLElement, options: CheatOptions) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const dismissAction = () => setOpen(false);
  const current = (element: HTMLElement) => !disposed && open && inCurrentView(parent, element);
  const closeBinding = createStandardCloseAction(parent, "close-cheats", options.labels.close, {
    current,
    run: dismissAction,
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const parts = createCard({
    close: closeBinding.element,
    size: "large",
    title: options.labels.title,
  });
  const { body, card, close, fit, frame } = parts;
  card.className += " ada-cheats-card";
  const dismissButton = createStandardTextAction(parent, options.labels.back, {
    availability: () => ({ kind: "available" }),
    current: () => current(dismissButton.element),
    run: dismissAction,
  });
  const dismiss = dismissButton.element;
  dismiss.classList.add("ada-primary");
  setButtonRole("primary", dismiss);
  dismiss.dataset.action = "dismiss-cheats";
  const footer = createActions([{ button: dismiss, role: "primary" }]);
  setFooterAction("back", footer);
  const closeBindings = [closeBinding, dismissButton];
  const rows = new Map(options.rows.map((row) => [row.id, row]));
  const actions = new Set<ReturnType<typeof createStandardTextAction>>();
  const items = document.createElement("div");
  items.className = "ada-cheat-items";
  const mounted = mountLayout<CheatsSchema>(
    {
      components: {
        action: {
          create(data) {
            const action = rows.get(data.id) as CheatAction;
            const resource =
              action.id === "addStardust" ? "stardust" : action.id === "addOre" ? "ore" : null;
            let stopRefusal: (() => void) | undefined;
            const run = () => {
              if (open && !button.disabled) {
                runCheatAction(action);
                refresh();
              }
            };
            const textAction = createStandardTextAction(
              parent,
              resource ? CHEAT_COPY.amount : data.label,
              {
                availability: () => {
                  if (action.available()) {
                    return { kind: "available" };
                  }
                  const reason = action.refusalReason?.();
                  return reason ? { kind: "unavailable", reason } : { kind: "disabled" };
                },
                current: () => current(button),
                ...(action.refusalReason
                  ? {
                      refuse: () => {
                        if (
                          !button.hasAttribute(REFUSAL_ATTRIBUTES.red) &&
                          !button.hasAttribute(REFUSAL_ATTRIBUTES.shake)
                        ) {
                          stopRefusal = refuse(button, options.reducedMotion());
                        }
                      },
                    }
                  : {}),
                run,
              },
            );
            const button: HTMLButtonElement = textAction.element;
            setButtonRole("secondary", button);
            button.dataset.cheat = data.id;
            const update = (next: CheatsSchema["action"]["props"]) => {
              if (resource) {
                button.setAttribute("aria-label", next.label);
              } else {
                textAction.setLabel(next.label);
              }
            };
            if (resource) {
              // Keep the art decorative without dimming it as an icon-only button on focus.
              const decoration = document.createElement("span");
              decoration.style.display = "flex";
              const icon = document.createElement("span");
              icon.className = "ada-cheat-resource-icon";
              icon.setAttribute("aria-hidden", "true");
              icon.style.backgroundImage = `url('${uiIconUrl(`icon-${resource}-20`)}')`;
              decoration.append(icon);
              button.append(decoration);
            }
            update(data);
            actions.add(textAction);
            return {
              dispose() {
                textAction.dispose();
                stopRefusal?.();
                actions.delete(textAction);
              },
              element: button,
              slots: {},
              update,
            };
          },
          slots: [],
        },
        column: {
          create() {
            const element = document.createElement("div");
            element.className = "ada-cheat-column";
            const rows = document.createElement("div");
            rows.className = "ada-cheat-rows";
            element.append(rows);
            return { dispose() {}, element, slots: { rows }, update() {} };
          },
          slots: ["rows"],
        },
        footer: {
          create(data) {
            const update = (next: CheatsSchema["footer"]["props"]) => {
              dismissButton.setLabel(next.label);
            };
            update(data);
            return { dispose() {}, element: footer, slots: {}, update };
          },
          slots: [],
        },
        layout: {
          create() {
            body.append(items);
            return {
              dispose() {},
              element: body,
              slots: { columns: items, footer: body },
              update() {},
            };
          },
          slots: ["columns", "footer"],
        },
      },
      host: card,
    },
    cheatsTree(
      options.labels.back,
      options.rows.map((row): CheatRowData => ({
        id: row.id,
        label: row.label,
      })),
    ),
  );
  modal.append(frame);
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  let open = false;
  let disposed = false;
  const audit = () => {
    assertAdaActionMetadata(modal);
    if (modal.isConnected) {
      assertAdaActionBindings(modal);
    }
  };
  const setOpen = (value: boolean): void => {
    if (disposed || value === open) {
      return;
    }
    if (value) {
      audit();
      refresh();
    }
    open = value;
    modal.hidden = !value;
    if (value) {
      fit();
    }
    if (!value) {
      leaveLayer?.();
      leaveLayer = undefined;
      layer?.dispose();
      layer = undefined;
    }
    options.onOpenChange(value);
    if (value) {
      layer = createModalLayer(modal);
      leaveLayer = layer.open({ close: dismissAction, focus: close, live: [close] }, card);
    }
  };
  function refresh(): void {
    for (const action of actions) {
      action.refresh();
    }
  }
  try {
    audit();
    parent.append(modal);
    audit();
  } catch (error) {
    disposed = true;
    for (const binding of closeBindings) {
      binding.dispose();
    }
    mounted.dispose();
    parts.dispose();
    modal.remove();
    throw error;
  }
  modal.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (event.target === modal) {
      event.preventDefault();
      focusTarget(close);
    }
  });
  window.addEventListener("resize", fit);
  window.addEventListener(VIEW_SCALE_EVENT, fit);
  refresh();
  return {
    close: dismissAction,
    dispose(): void {
      if (disposed) {
        return;
      }
      setOpen(false);
      disposed = true;
      window.removeEventListener("resize", fit);
      window.removeEventListener(VIEW_SCALE_EVENT, fit);
      layer?.dispose();
      for (const binding of closeBindings) {
        binding.dispose();
      }
      mounted.dispose();
      parts.dispose();
      modal.remove();
    },
    isOpen: () => open,
    open: () => setOpen(true),
    refresh,
  };
}
