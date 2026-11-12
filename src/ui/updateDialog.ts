import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import type { UpdateOffer } from "../pwa/updateOffer.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";
import { FONT_ROLES } from "./settings.ts";

export interface UpdateLabels {
  readonly accept: string;
  readonly cancel: string;
  readonly close: string;
  readonly title: string;
}

// The start screen's update offer, as in Archie and Chibi: a compact card titled Update
// available with no body text, secondary Cancel on the left, primary Update now on the right and
// the close X. Only Update now switches versions; Cancel, the X, an outside tap and Escape
// (through defer) keep the current version for this start-screen visit. Closing with focus in
// the card hands it to restoreFocus, the start screen's default. Styled by Settings' sheet in
// the same root.
export function createUpdateDialog(
  root: HTMLElement,
  labels: UpdateLabels,
  offer: Pick<UpdateOffer, "accept" | "defer" | "subscribe">,
  restoreFocus: () => void,
  onOpenChange: (open: boolean) => void,
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const parts = createCard({
    closeAction: "close-update",
    closeLabel: labels.close,
    fontRole: FONT_ROLES.heading,
    title: labels.title,
  });
  const { body, card, close, frame } = parts;
  card.dataset.dialog = "update";
  const cancel = createButton(labels.cancel);
  cancel.dataset.action = "cancel-update";
  const accept = createButton(labels.accept, "primary");
  accept.dataset.action = "accept-update";
  body.append(
    createActions([
      { button: accept, role: "primary" },
      { button: cancel, role: "secondary" },
    ]),
  );
  modal.append(frame);
  root.append(modal);
  let open = false;
  const stop = offer.subscribe((visible) => {
    if (visible === open) {
      return;
    }
    open = visible;
    // Read before hiding: a hidden card drops its focus to the page.
    const focused = modal.contains(document.activeElement);
    modal.hidden = !visible;
    if (visible) {
      parts.fit();
    }
    if (visible) {
      focusTarget(accept);
    } else if (focused) {
      restoreFocus();
    }
    onOpenChange(visible);
  });
  const defer = () => offer.defer();
  close.addEventListener("click", defer);
  cancel.addEventListener("click", defer);
  accept.addEventListener("click", () => offer.accept());
  // A full outside tap defers; dragging out of the card does not.
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
      defer();
    }
    outside = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const order = [close, cancel, accept];
      const index = order.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.shiftKey ? order.length - 1 : 1;
      focusTarget(order[(Math.max(0, index) + step) % order.length]!);
    }
  });
  return {
    defer,
    dispose(): void {
      stop();
      parts.dispose();
      modal.remove();
    },
    isOpen: () => open,
  };
}
