import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import type { UpdateOffer } from "../pwa/updateOffer.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { presentAdaButton } from "./buttonPresentation.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import { createActions, createCard } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import { FONT_ROLES } from "./settings.ts";
import { type UpdateAction, type UpdateSchema, updateTree } from "./updateTree.ts";

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
    size: "small",
    title: labels.title,
  });
  const { body, card, close, frame } = parts;
  card.dataset.dialog = "update";
  const actions = createActions([]);
  body.append(actions);
  modal.append(frame);
  root.append(modal);
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  let open = false;
  let disposed = false;
  const defer = () => offer.defer();
  const availability = (): ControlAvailability =>
    disposed || !open || (layer !== undefined && !inCurrentView(root, card))
      ? { kind: "omitted" }
      : { kind: "available" };
  const headerBinding = bindAdaAction(
    {
      click: { availability, run: defer },
      current: () => !disposed && open && inCurrentView(root, close),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(close),
    },
    close,
  );
  const ports = createAdaLayoutPorts<UpdateAction>({
    actions: new Map([
      ["close-update", defer],
      ["cancel-update", defer],
      ["accept-update", () => offer.accept()],
    ]),
    availability,
    presentButton: presentAdaButton,
  });
  const tree = updateTree(labels);
  const mounted = mountLayout<UpdateSchema>(
    {
      components: {
        ...ports.components,
        update: {
          create() {
            return {
              dispose: parts.dispose,
              element: frame,
              slots: { footer: actions },
              update() {},
            };
          },
          slots: ["footer"],
        },
      },
      host: modal,
    },
    tree,
  );
  assertAdaActionMetadata(modal);
  const accept = actions.querySelector<HTMLButtonElement>('[data-action="accept-update"]')!;
  const stop = offer.subscribe((visible) => {
    if (disposed || visible === open) {
      return;
    }
    open = visible;
    // Read before hiding: a hidden card drops its focus to the page.
    const focused = modal.contains(document.activeElement);
    mounted.update(tree);
    assertAdaActionMetadata(modal);
    if (visible) {
      assertAdaActionBindings(modal);
    }
    modal.hidden = !visible;
    if (visible) {
      parts.fit();
    }
    if (visible) {
      layer = createModalLayer(modal);
      leaveLayer = layer.open({ close: defer, focus: accept, live: [close] }, card);
    } else {
      leaveLayer?.();
      leaveLayer = undefined;
      layer?.dispose();
      layer = undefined;
      if (focused) {
        restoreFocus();
      }
    }
    onOpenChange(visible);
  });
  return {
    defer,
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      stop();
      layer?.dispose();
      headerBinding.dispose();
      mounted.dispose();
      modal.remove();
    },
    isOpen: () => open,
  };
}
