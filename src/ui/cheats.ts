import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { SETTINGS_STATE_LABELS } from "../data/settingsCopy.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { type CheatAction, cheatsAllowed, runCheatAction } from "./cheatActions.ts";
import { type CheatRowData, type CheatsSchema, cheatsTree } from "./cheatsTree.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import {
  createActions,
  createButton,
  createCard,
  createSwitchRow,
  setFooterAction,
  setScrollGroup,
} from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";

export interface CheatLabels {
  readonly close: string;
  readonly open: string;
  readonly title: string;
}

/** The FPS counter's switch row: a display toggle, not part of the save. */
export interface CheatSwitch {
  readonly id: string;
  readonly label: string;
  readonly on: () => boolean;
  readonly set: (on: boolean) => void;
}

interface CheatOptions {
  /** The rows top to bottom: cheats, Show tips again, the FPS counter and Reset save. */
  readonly rows: readonly (CheatAction | CheatSwitch)[];
  readonly beforeOpen: () => void;
  readonly labels: CheatLabels;
  readonly onOpenChange: (open: boolean) => void;
  readonly restoreFocus: () => void;
}

function isSwitch(row: CheatAction | CheatSwitch): row is CheatSwitch {
  return "set" in row;
}

/**
 * The browser-tab-only Cheats modal (gameplay/cheats.md): a Small card of full-width rows whose
 * body scrolls, with Close as its bottom primary. The app-window check runs at open and at each
 * action.
 */
export function createCheats(
  parent: HTMLElement,
  launcherActions: HTMLElement,
  options: CheatOptions,
) {
  const allowed = () => !disposed && cheatsAllowed(window);
  const launcher = createButton(options.labels.open);
  launcher.dataset.action = "cheats";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");
  launcherActions.prepend(launcher);
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const parts = createCard({
    closeAction: "close-cheats",
    closeLabel: options.labels.close,
    size: "small",
    title: options.labels.title,
  });
  const { body, card, close, frame } = parts;
  const dismiss = createButton(options.labels.close, "primary");
  dismiss.dataset.action = "dismiss-cheats";
  const footer = createActions([{ button: dismiss, role: "primary" }]);
  setFooterAction("close", footer);
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
  const switches: (() => void)[] = [];
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
            const button = createButton(data.label);
            button.dataset.cheat = data.id;
            const update = (next: CheatsSchema["action"]["props"]) => {
              button.textContent = next.label;
            };
            const binding = bindRow(
              button,
              () => {
                if (open && !button.disabled) {
                  runCheatAction(window, action);
                  refresh();
                }
              },
              // The app-window check runs in runCheatAction, at the press itself.
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
        list: {
          create() {
            body.append(items);
            setScrollGroup(parts, items);
            return {
              dispose() {},
              element: body,
              slots: { footer: body, rows: items },
              update() {},
            };
          },
          slots: ["rows", "footer"],
        },
        switch: {
          create(data) {
            const toggle = rows.get(data.id) as CheatSwitch;
            const icon = document.createElement("span");
            icon.className = "ada-icon";
            icon.setAttribute("aria-hidden", "true");
            const { row, show } = createSwitchRow({
              align: "center",
              icon,
              id: data.id,
              label: data.label,
            });
            row.dataset.cheat = data.id;
            const state = document.createElement("span");
            state.className = "ada-setting-state";
            state.setAttribute("aria-hidden", "true");
            const stack = document.createElement("span");
            stack.className = "ada-setting-toggle";
            stack.append(row.lastElementChild!, state);
            row.append(stack);
            const paint = () => {
              show(toggle.on());
              state.textContent = toggle.on()
                ? SETTINGS_STATE_LABELS.on
                : SETTINGS_STATE_LABELS.off;
            };
            paint();
            switches.push(paint);
            const binding = bindRow(
              row,
              () => {
                toggle.set(!toggle.on());
                paint();
              },
              () => true,
            );
            return {
              dispose() {
                binding.dispose();
                switches.splice(switches.indexOf(paint), 1);
              },
              element: row,
              slots: {},
              update() {},
            };
          },
          slots: [],
        },
      },
      host: card,
    },
    cheatsTree(
      options.labels.close,
      options.rows.map((row): CheatRowData => ({
        id: row.id,
        kind: isSwitch(row) ? "switch" : "action",
        label: row.label,
      })),
    ),
  );
  modal.append(frame);
  parent.append(modal);
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  let open = false;
  let disposed = false;
  let previousFocus: HTMLElement | null = null;
  const audit = () => {
    for (const scope of [launcher, modal]) {
      assertAdaActionMetadata(scope);
      if (scope.isConnected) {
        assertAdaActionBindings(scope);
      }
    }
  };
  const setOpen = (value: boolean): void => {
    if (disposed || (value && !allowed()) || value === open) {
      return;
    }
    if (value) {
      audit();
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      options.beforeOpen();
    }
    open = value;
    modal.hidden = !value;
    if (value) {
      parts.fit();
    }
    launcher.setAttribute("aria-expanded", String(value));
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
    } else if (previousFocus?.isConnected && previousFocus.getClientRects().length > 0) {
      focusTarget(previousFocus);
    } else {
      options.restoreFocus();
    }
  };
  function refresh(): void {
    const eligible = allowed();
    launcher.hidden = !eligible;
    if (!eligible) {
      setOpen(false);
    }
    for (const [button, action] of buttons) {
      button.disabled = !eligible || !action.available();
    }
    for (const paint of switches) {
      paint();
    }
  }
  const launcherBinding = bindAdaAction(
    {
      click: {
        availability: () =>
          allowed() && !launcher.hidden ? { kind: "available" } : { kind: "omitted" },
        run: () => {
          setOpen(true);
          refresh();
        },
      },
      current: () => !disposed && launcher.isConnected && inCurrentView(parent, launcher),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(launcher),
    },
    launcher,
  );
  try {
    audit();
  } catch (error) {
    disposed = true;
    launcherBinding.dispose();
    for (const binding of closeBindings) {
      binding.dispose();
    }
    mounted.dispose();
    parts.dispose();
    modal.remove();
    launcher.remove();
    throw error;
  }
  modal.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (event.target === modal) {
      event.preventDefault();
      focusTarget(close);
    }
  });
  const media = window.matchMedia(
    "(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui)",
  );
  media.addEventListener("change", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", refresh);
  refresh();
  return {
    close: dismissAction,
    dispose(): void {
      if (disposed) {
        return;
      }
      setOpen(false);
      disposed = true;
      launcherBinding.dispose();
      media.removeEventListener("change", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
      layer?.dispose();
      for (const binding of closeBindings) {
        binding.dispose();
      }
      mounted.dispose();
      parts.dispose();
      modal.remove();
      launcher.remove();
    },
    isOpen: () => open,
    refresh,
  };
}
