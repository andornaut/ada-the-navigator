import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { presentAdaButton } from "./buttonPresentation.ts";
import { detailCount, renderDetailQuantity } from "./detailQuantity.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import { createActions, createCard, isTap, setFooterAction } from "./modal.ts";
import { createProse } from "./prose.ts";
import {
  type ResourceAction,
  type ResourceLayoutData,
  type ResourceLayoutSchema,
  resourceTree,
} from "./resourceTree.ts";

export interface ResourceDetails {
  readonly icon?: HTMLElement;
  readonly count?: number;
  readonly quantity?: string;
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
    size: "small",
    title: "",
  });
  card.card.dataset.dialog = "resource";
  const description = createProse();
  const quantity = document.createElement("div");
  quantity.hidden = true;
  const actions = createActions([]);
  actions.className += " ada-detail-actions";
  setFooterAction("close", actions);
  card.body.append(description, quantity, actions);
  modal.append(card.frame);
  root.append(modal);
  let disposed = false;
  let visible = false;
  let headerIcon: HTMLElement | undefined;
  let quantityIcon: HTMLElement | undefined;
  let returnFocus: HTMLElement | null = null;
  let openQuests: (() => void) | undefined;
  const close = () => {
    if (modal.hidden) {
      return;
    }
    visible = false;
    modal.hidden = true;
    options.onOpenChange(false);
    if (returnFocus) {
      focusTarget(returnFocus);
    }
    returnFocus = null;
  };
  card.close.addEventListener("click", close);
  const showQuests = () => {
    if (!openQuests || modal.hidden) {
      return;
    }
    openQuests();
    returnFocus = null;
    close();
  };
  const ports = createAdaLayoutPorts<ResourceAction>({
    actions: new Map([
      ["close-resource", close],
      ["dismiss-resource", close],
      ["resource-quests", showQuests],
    ]),
    availability: (action) =>
      disposed || !visible || (action === "resource-quests" && !openQuests)
        ? { kind: "omitted" }
        : { kind: "available" },
    presentButton: presentAdaButton,
  });
  const renderContent = (data: ResourceLayoutData) => {
    card.title.textContent = data.title;
    description.textContent = data.description;
    card.title.className = "ada-detail-header";
    const name = document.createElement("span");
    name.textContent = data.title;
    card.title.replaceChildren(...(headerIcon ? [headerIcon] : []), name);
    renderDetailQuantity(quantity, quantityIcon, data.quantity, data.title);
    card.frame.setAttribute("aria-label", data.title);
  };
  const mounted = mountLayout<ResourceLayoutSchema>(
    {
      components: {
        ...ports.components,
        resource: {
          create(data) {
            renderContent(data);
            return {
              dispose: card.dispose,
              element: card.frame,
              slots: { footer: actions },
              update: renderContent,
            };
          },
          slots: ["footer"],
        },
      },
      host: modal,
    },
    resourceTree({ closeLabel: options.closeLabel, description: "", title: "" }),
  );
  const quests = actions.querySelector<HTMLButtonElement>('[data-action="resource-quests"]')!;
  const dismiss = actions.querySelector<HTMLButtonElement>('[data-action="dismiss-resource"]')!;
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
      disposed = true;
      mounted.dispose();
      modal.remove();
      returnFocus = null;
      openQuests = undefined;
    },
    isOpen: () => !modal.hidden,
    open(title: string, text: string, origin: HTMLElement, details: ResourceDetails = {}) {
      returnFocus = origin;
      headerIcon = details.count === undefined ? details.icon : undefined;
      quantityIcon =
        details.quantity === undefined
          ? (details.icon?.cloneNode(true) as HTMLElement | undefined)
          : undefined;
      const amount =
        details.quantity ?? (details.count === undefined ? undefined : detailCount(details.count));
      openQuests = details.quests?.onOpen;
      visible = true;
      mounted.update(
        resourceTree({
          closeLabel: options.closeLabel,
          description: text,
          title,
          ...(amount === undefined ? {} : { quantity: amount }),
          ...(details.quests ? { questsLabel: details.quests.label } : {}),
        }),
      );
      modal.hidden = false;
      options.onOpenChange(true);
      card.fit();
      focusTarget(dismiss);
    },
  };
}
