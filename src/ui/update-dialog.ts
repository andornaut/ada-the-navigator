import type { UpdateOffer } from "../pwa/updateOffer.ts";
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
// (through defer) keep the current version for this start-screen visit. Styled by Settings'
// sheet in the same root.
export function createUpdateDialog(
  root: HTMLElement,
  labels: UpdateLabels,
  offer: Pick<UpdateOffer, "accept" | "defer" | "subscribe">,
  onOpenChange: (open: boolean) => void,
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = document.createElement("section");
  card.className = "ada-card";
  card.dataset.dialog = "update";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", labels.title);
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = labels.title;
  title.dataset.fontRole = FONT_ROLES.heading;
  const close = document.createElement("button");
  close.className = "ada-close";
  close.dataset.action = "close-update";
  close.setAttribute("aria-label", labels.close);
  header.append(document.createElement("span"), title, close);
  const actions = document.createElement("div");
  actions.className = "ada-actions";
  const cancel = document.createElement("button");
  cancel.dataset.action = "cancel-update";
  cancel.textContent = labels.cancel;
  const accept = document.createElement("button");
  accept.className = "ada-primary";
  accept.dataset.action = "accept-update";
  accept.textContent = labels.accept;
  actions.append(cancel, accept);
  card.append(header, actions);
  modal.append(card);
  root.append(modal);
  let open = false;
  const stop = offer.subscribe((visible) => {
    if (visible === open) {
      return;
    }
    open = visible;
    modal.hidden = !visible;
    if (visible) {
      accept.focus();
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
      Math.hypot(event.clientX - outside.x, event.clientY - outside.y) <= 10
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
      order[(Math.max(0, index) + step) % order.length]?.focus();
    }
  });
  return {
    defer,
    dispose(): void {
      stop();
      modal.remove();
    },
    isOpen: () => open,
  };
}
