import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { applyAdaControlTheme, presentAdaButton } from "./buttonPresentation.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { mountAdaLayout } from "./layoutTree.ts";
import { isTap } from "./modal.ts";
import { enterPressView, inCurrentView } from "./pressScope.ts";
import { type RestartAction, restartTree } from "./restartTree.ts";

export interface RestartLabels {
  readonly cancel: string;
  readonly close: string;
  readonly restart: string;
  readonly title: string;
}

// The confirm covers the start screen's panel, which sits above the controls layer.
export const RESTART_STYLE = ".ada-controls.ada-restart-open{z-index:30}";

/**
 * Restart's confirm, as Chibi's: "Restart?" with Cancel (secondary, left) and Restart (primary,
 * right). The close X, an outside tap, back and Escape (through the back stack) cancel.
 */
export function createRestartCard(
  root: HTMLElement,
  options: { readonly labels: RestartLabels; readonly onRestart: () => void },
) {
  const { labels } = options;
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
    root.classList.toggle("ada-restart-open", open);
    if (open) {
      leaveView ??= enterPressView(root, frame);
    } else {
      leaveView?.();
      leaveView = undefined;
    }
    layout.update(restartTree(labels));
    if (open) {
      layout.fit();
      focusTarget(cancel);
    }
  };
  const cancelRestart = () => setOpen(false);
  const actions: ReadonlyMap<RestartAction, () => void> = new Map([
    ["close-restart", cancelRestart],
    ["restart-cancel", cancelRestart],
    [
      "restart-confirm",
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
    restartTree(labels),
  );
  const frame = modal.querySelector<HTMLElement>('[role="dialog"]')!;
  frame.querySelector<HTMLElement>(".ada-card")!.dataset.dialog = "restart";
  const cancel = modal.querySelector<HTMLButtonElement>('[data-action="restart-cancel"]')!;
  let outside: { readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outside &&
      event.target === modal &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      setOpen(false);
    }
    outside = undefined;
  });
  return {
    close: () => setOpen(false),
    dispose(): void {
      disposed = true;
      leaveView?.();
      leaveView = undefined;
      layout.dispose();
      root.classList.remove("ada-restart-open");
      modal.remove();
    },
    isOpen: () => !disposed && !modal.hidden,
    open: () => setOpen(true),
    settle: layout.settle,
  };
}
