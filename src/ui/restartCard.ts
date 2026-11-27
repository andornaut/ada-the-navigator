import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { applyAdaControlTheme } from "./buttonPresentation.ts";
import { mountAdaLayout } from "./layoutTree.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import { type ConfirmAction, restartTree } from "./restartTree.ts";

export interface RestartLabels {
  readonly body?: string;
  readonly cancel: string;
  readonly close: string;
  readonly restart: string;
  readonly title: string;
}

// A confirm covers the start screen's panel, which sits above the controls layer.
export const RESTART_STYLE =
  ".ada-controls.ada-restart-open,.ada-controls.ada-rewind-quests-open,.ada-controls.ada-exit-prompt-open{z-index:30}";

/**
 * Start and campaign rewind confirmations put Cancel on the left and the primary action on
 * the right. The close X, an outside tap, Back and Escape cancel.
 */
export function createRestartCard(
  root: HTMLElement,
  options: { readonly labels: RestartLabels } & (
    | {
        readonly kind?: "restart";
        readonly onRestart: () => void;
        readonly commit?: never;
      }
    | {
        readonly kind: "exit-prompt";
        readonly canExit: () => boolean;
        /** True once the guard has handed off to platform navigation. */
        readonly requestExit: () => Promise<boolean>;
        readonly commit?: never;
      }
    | {
        readonly kind: "rewind-quests";
        readonly commit: (current: () => boolean) => Promise<((present: boolean) => void) | null>;
        readonly onRestart?: never;
      }
  ),
) {
  const { labels } = options;
  const kind = options.kind ?? "restart";
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  root.append(modal);
  applyAdaControlTheme(modal);
  // The confirm joins the controls overlay's shared modal layer, so it takes the top over Cheats
  // or Settings: the card under it turns inert and the confirm alone takes presses and focus.
  const layer = createModalLayer(modal);
  let disposed = false;
  let committing = false;
  let leaveView: (() => void) | undefined;
  const setOpen = (open: boolean) => {
    // Closing a closed card changes nothing, so it is not laid out again: the scene closes it
    // every frame off the start screen.
    if (disposed || (!open && modal.hidden)) {
      return;
    }
    if (open && kind !== "restart") {
      // Cheats may have moved to the front on open. Put its child above it in paint order.
      root.append(modal);
    }
    modal.hidden = !open;
    root.classList.toggle(`ada-${kind}-open`, open);
    if (open) {
      leaveView ??= layer.open({ close: cancelRestart, focus: cancel }, frame);
    } else {
      leaveView?.();
      leaveView = undefined;
    }
    layout.update(restartTree(labels, kind));
    if (open) {
      layout.fit();
      focusTarget(cancel);
    }
  };
  const cancelRestart = () => {
    if (!committing) {
      setOpen(false);
    }
  };
  const confirm = () => {
    if (options.kind === "exit-prompt") {
      if (committing || !options.canExit()) {
        return;
      }
      committing = true;
      const settle = (departed: boolean) => {
        committing = false;
        if (departed) {
          setOpen(false);
        } else if (!disposed && !modal.hidden) {
          layout.update(restartTree(labels, kind));
        }
      };
      void options.requestExit().then(settle, () => settle(false));
      return;
    }
    if (!options.commit) {
      setOpen(false);
      options.onRestart();
      return;
    }
    committing = true;
    void options
      .commit(() => !disposed && !modal.hidden && inCurrentView(root, frame))
      .then((handoff) => {
        if (handoff) {
          if (!disposed) {
            setOpen(false);
          }
          handoff(!disposed);
        }
      })
      .finally(() => {
        committing = false;
      });
  };
  const actions: ReadonlyMap<ConfirmAction, () => void> = new Map<ConfirmAction, () => void>([
    [`close-${kind}`, cancelRestart],
    [`${kind}-cancel`, cancelRestart],
    [`${kind}-confirm`, confirm],
  ]);
  const layout = mountAdaLayout(
    {
      actionRoot: root,
      actions,
      availability: (action) => {
        if (disposed || committing || modal.hidden || !inCurrentView(root, frame)) {
          return { kind: "omitted" };
        }
        if (
          options.kind === "exit-prompt" &&
          action === "exit-prompt-confirm" &&
          !options.canExit()
        ) {
          return { kind: "unavailable", reason: "Action unavailable." };
        }
        return { kind: "available" };
      },
    },
    { artReady: Promise.resolve(), host: modal },
    restartTree(labels, kind),
  );
  const frame = modal.querySelector<HTMLElement>('[role="dialog"]')!;
  frame.querySelector<HTMLElement>(".ada-card")!.dataset.dialog = kind;
  const cancel = modal.querySelector<HTMLButtonElement>(`[data-action="${kind}-cancel"]`)!;
  return {
    close: cancelRestart,
    dispose(): void {
      disposed = true;
      leaveView?.();
      leaveView = undefined;
      layer.dispose();
      layout.dispose();
      root.classList.remove(`ada-${kind}-open`);
      modal.remove();
    },
    isOpen: () => !disposed && !modal.hidden,
    open: () => setOpen(true),
    settle: layout.settle,
  };
}
