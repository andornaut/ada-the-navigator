import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { bindAdaAction } from "./actionBinding.ts";
import { type CheatAction, cheatGroups, createCheatSession } from "./cheatActions.ts";
import { type CheatsSchema, cheatsTree } from "./cheatsTree.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, setFooterAction } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";

export interface CheatLabels {
  readonly close: string;
  readonly open: string;
  readonly runGroup: string;
  readonly runPersistence: string;
  readonly saveGroup: string;
  readonly savePersistence: string;
  readonly title: string;
}

interface CheatOptions {
  readonly actions: readonly CheatAction[];
  readonly beforeOpen: () => void;
  readonly canExecute: () => boolean;
  readonly labels: CheatLabels;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: () => void;
  readonly run: () => object | null;
  readonly restoreFocus: () => void;
}

/** Browser-tab-only modal; the session also guards dispatch and deferred commits. */
export function createCheats(
  parent: HTMLElement,
  launcherActions: HTMLElement,
  options: CheatOptions,
) {
  const session = createCheatSession({
    ...options,
    canExecute: () => open && options.canExecute(),
    host: window,
  });
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
    size: "medium",
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
  const buttons: HTMLButtonElement[] = [];
  const mounted = mountLayout<CheatsSchema>(
    {
      components: {
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
        group: {
          create(data) {
            const section = document.createElement("section");
            section.className = "ada-cheat-section";
            const heading = document.createElement("h3");
            const persistence = document.createElement("p");
            persistence.className = "ada-prose";
            const items = document.createElement("div");
            items.className = "ada-cheat-items";
            section.append(heading, persistence, items);
            const update = (next: CheatsSchema["group"]["props"]) => {
              heading.textContent = next.label;
              persistence.textContent = next.persistence;
              section.setAttribute("aria-label", next.label);
            };
            update(data);
            return { dispose() {}, element: section, slots: { items }, update };
          },
          slots: ["items"],
        },
        groups: {
          create() {
            return {
              dispose() {},
              element: body,
              slots: { groups: body },
              update() {},
            };
          },
          slots: ["groups"],
        },
        item: {
          create(data) {
            let current = data;
            const button = createButton(data.label);
            const description = document.createElement("p");
            description.className = "ada-prose";
            const update = (next: CheatsSchema["item"]["props"]) => {
              current = next;
              button.textContent = next.label;
              button.dataset.cheat = next.id;
              description.textContent = next.description;
              description.id = `cheat-description-${next.id}`;
              button.setAttribute("aria-describedby", description.id);
            };
            update(data);
            const activate = () => {
              if (!open || !session.available() || button.disabled) {
                return;
              }
              button.disabled = true;
              void session
                .execute(current.id)
                .catch((error: unknown) => window.reportError(error))
                .finally(refresh);
            };
            button.addEventListener("click", activate);
            const item = document.createElement("div");
            item.className = "ada-cheat-item";
            item.append(button, description);
            buttons.push(button);
            return {
              dispose() {
                button.removeEventListener("click", activate);
                buttons.splice(buttons.indexOf(button), 1);
              },
              element: item,
              slots: {},
              update,
            };
          },
          slots: [],
        },
      },
      host: card,
    },
    cheatsTree(
      options.labels.close,
      cheatGroups(options.actions).map((scope) => ({
        actions: options.actions
          .filter((action) => action.scope === scope)
          .map(({ description, id, label }) => ({ description, id, label })),
        label: scope === "save" ? options.labels.saveGroup : options.labels.runGroup,
        persistence:
          scope === "save" ? options.labels.savePersistence : options.labels.runPersistence,
        scope,
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
  const setOpen = (value: boolean): void => {
    if (disposed || (value && !session.eligible()) || value === open) {
      return;
    }
    if (value) {
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
  let currentRun = options.run();
  function refresh(): void {
    const nextRun = options.run();
    if (currentRun !== null && currentRun !== nextRun) {
      setOpen(false);
    }
    currentRun = nextRun;
    const eligible = session.eligible();
    launcher.hidden = !eligible;
    if (!eligible) {
      setOpen(false);
    }
    for (const button of buttons) {
      button.disabled = session.busy() || !session.available();
    }
  }
  launcher.addEventListener("click", () => {
    setOpen(true);
    refresh();
  });
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
      session.dispose();
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
