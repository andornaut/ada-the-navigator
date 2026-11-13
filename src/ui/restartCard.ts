import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";

export interface RestartLabels {
  readonly cancel: string;
  readonly close: string;
  readonly restart: string;
  readonly title: string;
}

// The confirm covers the start screen's panel, which sits above the controls layer.
export const RESTART_STYLE = ".ada-controls.ada-restart-open{z-index:30}";

/**
 * Restart's confirm, as Chibi's: "Restart?" with Cancel (secondary, left) and Restart (primary,
 * right). The close X, an outside tap, back and Escape (through the back stack) cancel.
 */
export function createRestartCard(
  root: HTMLElement,
  options: { readonly labels: RestartLabels; readonly onRestart: () => void },
) {
  const { labels } = options;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-restart",
    closeLabel: labels.close,
    size: "small",
    title: labels.title,
  });
  card.card.dataset.dialog = "restart";
  const cancel = createButton(labels.cancel);
  cancel.dataset.action = "restart-cancel";
  const confirm = createButton(labels.restart, "primary");
  confirm.dataset.action = "restart-confirm";
  card.body.append(
    createActions([
      { button: cancel, role: "secondary" },
      { button: confirm, role: "primary" },
    ]),
  );
  modal.append(card.frame);
  root.append(modal);
  const setOpen = (open: boolean) => {
    modal.hidden = !open;
    root.classList.toggle("ada-restart-open", open);
    if (open) {
      card.fit();
      focusTarget(cancel);
    }
  };
  cancel.addEventListener("click", () => setOpen(false));
  card.close.addEventListener("click", () => setOpen(false));
  confirm.addEventListener("click", () => {
    setOpen(false);
    options.onRestart();
  });
  let outside: { readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outside &&
      event.target === modal &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      setOpen(false);
    }
    outside = undefined;
  });
  return {
    close: () => setOpen(false),
    dispose(): void {
      card.dispose();
      root.classList.remove("ada-restart-open");
      modal.remove();
    },
    isOpen: () => !modal.hidden,
    open: () => setOpen(true),
  };
}
