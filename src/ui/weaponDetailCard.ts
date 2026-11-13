import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";

/** Weapon details use the shared card frame and modal pause lifecycle. */
export function createWeaponDetailCard(
  root: HTMLElement,
  options: { readonly closeLabel: string; readonly onOpenChange: (open: boolean) => void },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-weapon-detail",
    closeLabel: options.closeLabel,
    title: "",
  });
  card.card.dataset.dialog = "weapon-detail";
  const description = document.createElement("p");
  description.className = "ada-prose";
  const dismiss = createButton(options.closeLabel, "primary");
  dismiss.dataset.action = "dismiss-weapon-detail";
  card.body.append(description, createActions([{ button: dismiss, role: "primary" }]));
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
  dismiss.addEventListener("click", close);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      focusTarget(document.activeElement === card.close ? dismiss : card.close);
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
    open(title: string, lines: readonly string[], origin: HTMLElement) {
      returnFocus = origin;
      card.title.textContent = title;
      description.replaceChildren(
        ...lines.map((line) => {
          const paragraph = document.createElement("span");
          paragraph.style.display = "block";
          paragraph.textContent = line;
          return paragraph;
        }),
      );
      modal.hidden = false;
      options.onOpenChange(true);
      card.fit();
      focusTarget(dismiss);
    },
  };
}
