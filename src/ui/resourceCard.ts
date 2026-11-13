import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { readViewUnit } from "./layout/viewScale.ts";
import { createCard, isTap } from "./modal.ts";

/** Resource descriptions share the standard modal frame and pause lifecycle. */
export function createResourceCard(
  root: HTMLElement,
  options: { readonly closeLabel: string; readonly onOpenChange: (open: boolean) => void },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-resource",
    closeLabel: options.closeLabel,
    title: "",
  });
  card.card.dataset.dialog = "resource";
  const description = document.createElement("p");
  description.className = "ada-prose";
  card.body.append(description);
  modal.append(card.frame);
  root.append(modal);
  let returnFocus: HTMLElement | null = null;
  const close = () => {
    if (modal.hidden) {
      return;
    }
    modal.hidden = true;
    options.onOpenChange(false);
    if (returnFocus) {
      focusTarget(returnFocus);
    }
    returnFocus = null;
  };
  card.close.addEventListener("click", close);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      focusTarget(card.close);
    }
  });
  let outside: { x: number; y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      event.target === modal &&
      outside &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      close();
    }
    outside = undefined;
  });
  return {
    close,
    dispose() {
      card.dispose();
      modal.remove();
      returnFocus = null;
    },
    isOpen: () => !modal.hidden,
    open(title: string, text: string, origin: HTMLElement) {
      returnFocus = origin;
      card.title.textContent = title;
      description.textContent = text;
      modal.hidden = false;
      options.onOpenChange(true);
      card.fit();
      focusTarget(card.close);
    },
  };
}
