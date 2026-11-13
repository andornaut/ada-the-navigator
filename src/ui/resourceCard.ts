import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";

export interface ResourceDetails {
  readonly icon?: HTMLElement;
  readonly quests?: { readonly label: string; readonly onOpen: () => void };
}

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
  const icon = document.createElement("span");
  icon.style.display = "flex";
  icon.style.justifyContent = "center";
  icon.setAttribute("aria-hidden", "true");
  const quests = createButton("", "secondary");
  quests.dataset.action = "resource-quests";
  quests.hidden = true;
  const dismiss = createButton(options.closeLabel, "primary");
  dismiss.dataset.action = "dismiss-resource";
  card.body.append(
    icon,
    description,
    createActions([
      { button: quests, role: "secondary" },
      { button: dismiss, role: "primary" },
    ]),
  );
  modal.append(card.frame);
  root.append(modal);
  let returnFocus: HTMLElement | null = null;
  let openQuests: (() => void) | undefined;
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
  quests.addEventListener("click", () => {
    if (!openQuests || modal.hidden) {
      return;
    }
    openQuests();
    returnFocus = null;
    close();
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const controls = [card.close, ...(!quests.hidden ? [quests] : []), dismiss];
      const current = controls.indexOf(document.activeElement as HTMLButtonElement);
      const next = (current + (event.shiftKey ? controls.length - 1 : 1)) % controls.length;
      focusTarget(controls[next]!);
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
      openQuests = undefined;
    },
    isOpen: () => !modal.hidden,
    open(title: string, text: string, origin: HTMLElement, details: ResourceDetails = {}) {
      returnFocus = origin;
      card.title.textContent = title;
      description.textContent = text;
      icon.replaceChildren(...(details.icon ? [details.icon] : []));
      icon.hidden = !details.icon;
      openQuests = details.quests?.onOpen;
      quests.hidden = !details.quests;
      quests.textContent = details.quests?.label ?? "";
      card.frame.setAttribute("aria-label", title);
      modal.hidden = false;
      options.onOpenChange(true);
      card.fit();
      focusTarget(dismiss);
    },
  };
}
