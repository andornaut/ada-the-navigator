import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { assertAdaActionBindings, assertAdaActionMetadata } from "./actionBinding.ts";
import { createDetailCardFrame } from "./detailCardFrame.ts";
import { detailCount, renderDetailQuantity } from "./detailQuantity.ts";
import { renderItemDetailDescription, renderItemDetailHeader } from "./itemDetailContent.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
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
  options: {
    readonly backLabel?: string;
    readonly closeLabel: string;
    readonly onOpenChange: (open: boolean) => void;
  },
) {
  let disposed = false;
  const dismissLabel = options.backLabel ?? options.closeLabel;
  const headerBinding = createStandardCloseAction(root, "close-resource", options.closeLabel, {
    current: (button) =>
      !disposed &&
      !modal.hidden &&
      inCurrentView(root, button) &&
      availability("close-resource").kind === "available",
    run: () => close(),
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const frame = createDetailCardFrame(
    root,
    headerBinding.element,
    "resource",
    options.backLabel === undefined ? "close" : "back",
  );
  const { actions, card, description, modal, quantity } = frame;
  let visible = false;
  const layer = createModalLayer(modal);
  let leaveView: (() => void) | undefined;
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
    leaveView?.();
    leaveView = undefined;
    options.onOpenChange(false);
    if (returnFocus && document.activeElement !== returnFocus) {
      focusTarget(returnFocus);
    }
    returnFocus = null;
  };
  const availability = (action: ResourceAction): ControlAvailability =>
    disposed || !visible || (action === "resource-quests" && !openQuests)
      ? { kind: "omitted" }
      : { kind: "available" };
  const showQuests = () => {
    if (!openQuests || modal.hidden) {
      return;
    }
    openQuests();
    returnFocus = null;
    close();
  };
  const ports = createAdaLayoutPorts<ResourceAction>({
    actionRoot: root,
    actions: new Map([
      ["close-resource", close],
      ["dismiss-resource", close],
      ["resource-quests", showQuests],
    ]),
    availability,
  });
  const renderContent = (data: ResourceLayoutData) => {
    renderItemDetailHeader(card.title, data.title, headerIcon);
    renderItemDetailDescription(description, data.description);
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
              dispose: frame.dispose,
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
    resourceTree({ closeLabel: dismissLabel, description: "", title: "" }),
  );
  assertAdaActionMetadata(modal);
  const dismiss = actions.querySelector<HTMLButtonElement>('[data-action="dismiss-resource"]')!;
  return {
    close,
    dispose() {
      disposed = true;
      layer.dispose();
      leaveView = undefined;
      headerBinding.dispose();
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
          closeLabel: dismissLabel,
          description: text,
          title,
          ...(amount === undefined ? {} : { quantity: amount }),
          ...(details.quests ? { questsLabel: details.quests.label } : {}),
        }),
      );
      assertAdaActionMetadata(modal);
      assertAdaActionBindings(modal);
      modal.hidden = false;
      card.fit();
      leaveView ??= layer.open(
        {
          backdrop: modal,
          close,
          focus: dismiss,
          isolation: "dialog",
          restore: () => returnFocus,
        },
        card.frame,
      );
      if (document.activeElement !== dismiss) {
        focusTarget(dismiss);
      }
      options.onOpenChange(true);
    },
  };
}
