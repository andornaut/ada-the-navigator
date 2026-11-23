import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CHEAT_COPY } from "../data/cheatCopy.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { type CheatAction, runCheatAction } from "./cheatActions.ts";
import { type CheatRowData, type CheatsSchema, cheatsTree } from "./cheatsTree.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, setFooterAction } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";

export interface CheatLabels {
  readonly back: string;
  readonly close: string;
  readonly title: string;
}

interface CheatOptions {
  readonly rows: readonly CheatAction[];
  readonly labels: CheatLabels;
  readonly onOpenChange: (open: boolean) => void;
}

/** The Cheats card owns its actions. Navigation owns the entry and return focus. */
export function createCheats(parent: HTMLElement, options: CheatOptions) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const parts = createCard({
    closeAction: "close-cheats",
    closeLabel: options.labels.close,
    size: "large",
    title: options.labels.title,
  });
  const { body, card, close, fit, frame } = parts;
  card.className += " ada-cheats-card";
  const dismiss = createButton(options.labels.back, "primary");
  dismiss.dataset.action = "dismiss-cheats";
  const footer = createActions([{ button: dismiss, role: "primary" }]);
  setFooterAction("back", footer);
  const dismissAction = () => setOpen(false);
  const closeBindings = [close, dismiss].map((element) =>
    bindAdaAction(
      {
        click: {
          availability: () => (open ? { kind: "available" } : { kind: "omitted" }),
          run: dismissAction,
        },
        current: () => !disposed && open && inCurrentView(parent, element),
        slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
      },
      element,
    ),
  );
  const rows = new Map(options.rows.map((row) => [row.id, row]));
  const buttons = new Map<HTMLButtonElement, CheatAction>();
  const bindRow = (element: HTMLButtonElement, run: () => void, enabled: () => boolean) =>
    bindAdaAction(
      {
        click: {
          availability: () => (open && enabled() ? { kind: "available" } : { kind: "omitted" }),
          run,
        },
        current: () => !disposed && open && element.isConnected && inCurrentView(parent, element),
        slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
      },
      element,
    );
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
            const button = createButton(resource ? CHEAT_COPY.amount : data.label);
            button.dataset.cheat = data.id;
            const update = (next: CheatsSchema["action"]["props"]) => {
              if (resource) {
                button.setAttribute("aria-label", next.label);
              } else {
                button.textContent = next.label;
              }
            };
            if (resource) {
              const icon = document.createElement("span");
              icon.className = "ada-cheat-resource-icon";
              icon.setAttribute("aria-hidden", "true");
              icon.style.backgroundImage = `url('/art/ui/icons/icon-${resource}-20.svg')`;
              button.append(icon);
            }
            update(data);
            const binding = bindRow(
              button,
              () => {
                if (open && !button.disabled) {
                  runCheatAction(action);
                  refresh();
                }
              },
              () => !button.disabled,
            );
            buttons.set(button, action);
            return {
              dispose() {
                binding.dispose();
                buttons.delete(button);
              },
              element: button,
              slots: {},
              update,
            };
          },
          slots: [],
        },
        column: {
          create({ title }) {
            const element = document.createElement("section");
            element.className = "ada-cheat-column";
            const heading = document.createElement("h3");
            heading.textContent = title;
            element.append(heading);
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
              dismiss.textContent = next.label;
            };
            update(data);
            return { dispose() {}, element: footer, slots: {}, update };
          },
          slots: [],
        },
        grants: {
          create() {
            const element = document.createElement("div");
            element.className = "ada-cheat-grants";
            return { dispose() {}, element, slots: { buttons: element }, update() {} };
          },
          slots: ["buttons"],
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
    for (const [button, action] of buttons) {
      button.disabled = !action.available();
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
