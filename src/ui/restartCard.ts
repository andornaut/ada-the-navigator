import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { applyAdaControlTheme, presentAdaButton } from "./buttonPresentation.ts";
import { mountAdaLayout } from "./layoutTree.ts";
import { enterPressView, inCurrentView } from "./pressScope.ts";
import { type ConfirmAction, type ConfirmKind, restartTree } from "./restartTree.ts";

export interface RestartLabels {
  readonly cancel: string;
  readonly close: string;
  readonly restart: string;
  readonly title: string;
}

// A confirm covers the start screen's panel, which sits above the controls layer.
export const RESTART_STYLE =
  ".ada-controls.ada-restart-open,.ada-controls.ada-reset-save-open{z-index:30}";

/**
 * Restart's confirm, as Chibi's: "Restart?" with Cancel (secondary, left) and Restart (primary,
 * right); Reset save's is the same card. The close X, an outside tap, back and Escape (through the
 * back stack) cancel.
 */
export function createRestartCard(
  root: HTMLElement,
  options: {
    readonly kind?: ConfirmKind;
    readonly labels: RestartLabels;
    readonly onRestart: () => void;
  },
) {
  const { labels } = options;
  const kind = options.kind ?? "restart";
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  root.append(modal);
  applyAdaControlTheme(modal);
  let disposed = false;
  let leaveView: (() => void) | undefined;
  const setOpen = (open: boolean) => {
    if (disposed) {
      return;
    }
    modal.hidden = !open;
    root.classList.toggle(`ada-${kind}-open`, open);
    if (open) {
      leaveView ??= enterPressView(root, frame, [], {
        backdrop: modal,
        close: () => setOpen(false),
      });
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
  const cancelRestart = () => setOpen(false);
  const actions: ReadonlyMap<ConfirmAction, () => void> = new Map<ConfirmAction, () => void>([
    [`close-${kind}`, cancelRestart],
    [`${kind}-cancel`, cancelRestart],
    [
      `${kind}-confirm`,
      () => {
        setOpen(false);
        options.onRestart();
      },
    ],
  ]);
  const layout = mountAdaLayout(
    {
      actions,
      availability: () =>
        disposed || modal.hidden || !inCurrentView(root, frame)
          ? { kind: "omitted" }
          : { kind: "available" },
      presentButton: presentAdaButton,
    },
    { artReady: Promise.resolve(), host: modal },
    restartTree(labels, kind),
  );
  const frame = modal.querySelector<HTMLElement>('[role="dialog"]')!;
  frame.querySelector<HTMLElement>(".ada-card")!.dataset.dialog = kind;
  const cancel = modal.querySelector<HTMLButtonElement>(`[data-action="${kind}-cancel"]`)!;
  return {
    close: () => setOpen(false),
    dispose(): void {
      disposed = true;
      leaveView?.();
      leaveView = undefined;
      layout.dispose();
      root.classList.remove(`ada-${kind}-open`);
      modal.remove();
    },
    isOpen: () => !disposed && !modal.hidden,
    open: () => setOpen(true),
    settle: layout.settle,
  };
}
