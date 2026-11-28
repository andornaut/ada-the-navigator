import "@andornaut/game-kit/runtime/web/ui/dom/actionGroup.css";
import "./updateDialog.css";

import { ACTION_GAPS } from "@andornaut/game-kit/runtime/ui/actionGroup";
import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { createActionGroup } from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import type { UpdateOffer } from "../pwa/index.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  inCurrentView,
  registerAdaAncestorActionScope,
} from "./actions/index.ts";
import { SCROLL } from "./layout/index.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layoutDom/index.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import { createCard } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
import { FONT_ROLES } from "./settings/index.ts";
import { type UpdateAction, type UpdateSchema, updateTree } from "./updateTree.ts";

export interface UpdateLabels {
  readonly accept: string;
  readonly cancel: string;
  readonly close: string;
  readonly title: string;
}

// The in-session update offer, on any screen, as in Archie and Chibi: a compact card titled
// Update available with no body text, secondary Cancel on the left, primary Update now on the
// right and the close X. The open card pauses play. Only Update now switches versions; Cancel,
// the X, an outside tap and Escape (through defer) continue play on the current version, and the
// next launch applies the update silently. Closing with focus in the card hands it to
// restoreFocus. Styled by Settings' sheet in the same root.
export function createUpdateDialog(
  root: HTMLElement,
  actionRoot: HTMLElement,
  labels: UpdateLabels,
  offer: Pick<UpdateOffer, "accept" | "defer" | "subscribe">,
  restoreFocus: () => void,
  onOpenChange: (open: boolean) => void,
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  let open = false;
  let disposed = false;
  const defer = () => offer.defer();
  const headerBinding = createStandardCloseAction(actionRoot, "close-update", labels.close, {
    current: (button) =>
      !disposed && open && inCurrentView(root, button) && availability().kind === "available",
    run: defer,
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const parts = createCard({
    close: headerBinding.element,
    fontRole: FONT_ROLES.heading,
    size: "small",
    title: labels.title,
  });
  const { body, card, close, frame } = parts;
  card.dataset.dialog = "update";
  const group = createActionGroup(root.ownerDocument, { className: "ada-update-actions" });
  const actions = group.element;
  actions.dataset.inkTop = "0";
  body.append(actions);
  modal.append(frame);
  root.append(modal);
  const releaseActionScope =
    root === actionRoot ? undefined : registerAdaAncestorActionScope(modal, actionRoot);
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  const availability = (): ControlAvailability =>
    disposed || !open || (layer !== undefined && !inCurrentView(root, card))
      ? { kind: "omitted" }
      : { kind: "available" };
  const ports = createAdaLayoutPorts<UpdateAction>({
    actionRoot,
    actions: new Map([
      ["close-update", defer],
      ["cancel-update", defer],
      ["accept-update", () => offer.accept()],
    ]),
    availability,
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
  const cancel = actions.querySelector<HTMLButtonElement>('[data-action="cancel-update"]')!;
  const cancelFace = cancel.parentElement!;
  const acceptFace = accept.parentElement!;
  const fitActions = () => {
    if (modal.hidden) {
      return;
    }
    const [secondary, primary] = group.measure([cancel, accept]);
    const rowWidth = secondary!.width + ACTION_GAPS.standard.row + primary!.width;
    group.arrange(
      {
        gap: "standard",
        press: { margin: 0 },
        variant: "footer",
        width: Math.min(rowWidth, Math.floor(body.clientWidth / readViewUnit(body))),
      },
      [
        { element: cancelFace, role: "secondary", size: secondary! },
        { element: acceptFace, role: "primary", size: primary! },
      ],
    );
  };
  const view = root.ownerDocument.defaultView;
  view?.addEventListener("resize", fitActions);
  view?.addEventListener(VIEW_SCALE_EVENT, fitActions);
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
      fitActions();
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
      view?.removeEventListener("resize", fitActions);
      view?.removeEventListener(VIEW_SCALE_EVENT, fitActions);
      group.dispose();
      mounted.dispose();
      releaseActionScope?.();
      modal.remove();
    },
    isOpen: () => open,
  };
}
