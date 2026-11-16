import {
  createModalInputGate,
  type ModalInputScope,
} from "@andornaut/game-kit/runtime/input/modalInput";
import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import { readViewUnit } from "./layout/viewScale.ts";
import { isTap } from "./modal.ts";

export interface ViewDismissal {
  readonly backdrop: HTMLElement;
  readonly close: () => void;
}

interface View {
  readonly dialog: HTMLElement;
  readonly live: readonly HTMLElement[];
  readonly scope: ModalInputScope;
}
function createState(root: HTMLElement) {
  const gate = createModalInputGate();
  const views: View[] = [];
  const active = () => views.at(-1)?.scope ?? gate;
  const guard: PressGuard = {
    gate: {
      accepts: () => root.isConnected && active().accepts(),
      capture() {
        const accepted = active().capture();
        return () => root.isConnected && accepted();
      },
    },
  };
  return { gate, guard, views };
}
const roots = new WeakMap<HTMLElement, ReturnType<typeof createState>>();
function state(root: HTMLElement) {
  let value = roots.get(root);
  if (!value) {
    value = createState(root);
    roots.set(root, value);
  }
  return value;
}
function owner(root: HTMLElement): HTMLElement {
  for (let parent: HTMLElement | null = root; parent; parent = parent.parentElement) {
    if (roots.has(parent)) {
      return parent;
    }
  }
  return root;
}

/** Register the stable overlay before constructing its child modal layers. */
export function rootPressGuard(root: HTMLElement): PressGuard {
  return state(root).guard;
}

export function currentView(root: HTMLElement): HTMLElement {
  return state(owner(root)).views.at(-1)?.dialog ?? root;
}

/** Includes the published modal layer's explicit live controls outside its dialog. */
export function inCurrentView(root: HTMLElement, element: HTMLElement): boolean {
  const view = state(owner(root)).views.at(-1);
  return view
    ? [view.dialog, ...view.live].some((part) => part.contains(element))
    : root.contains(element);
}

/** Scope reporting only: the published layer retains navigation, focus and inert ownership. */
export function enterPressView(
  root: HTMLElement,
  dialog: HTMLElement,
  live: readonly HTMLElement[] = [],
  dismissal?: ViewDismissal,
): () => void {
  const shared = state(owner(root));
  const view: View = { dialog, live, scope: shared.gate.open() };
  shared.views.push(view);
  let outside:
    { readonly x: number; readonly y: number; readonly valid: () => boolean } | undefined;
  const current = () => shared.views.at(-1) === view && root.isConnected;
  const pointerdown = (event: PointerEvent) => {
    outside =
      current() &&
      event.target === dismissal?.backdrop &&
      event.isPrimary !== false &&
      (!event.button || event.button === 0)
        ? { valid: view.scope.capture(), x: event.clientX, y: event.clientY }
        : undefined;
  };
  const cancel = () => {
    outside = undefined;
  };
  const click = (event: MouseEvent) => {
    const from = outside;
    outside = undefined;
    if (
      dismissal &&
      from &&
      from.valid() &&
      current() &&
      event.target === dismissal.backdrop &&
      isTap(
        readViewUnit(dismissal.backdrop),
        { x: from.x, y: from.y },
        { x: event.clientX, y: event.clientY },
      )
    ) {
      // Consume before the callback can restore a parent view on the same backdrop.
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissal.close();
    }
  };
  dismissal?.backdrop.addEventListener("pointerdown", pointerdown, true);
  dismissal?.backdrop.addEventListener("pointercancel", cancel, true);
  dismissal?.backdrop.addEventListener("click", click, true);
  return () => {
    const index = shared.views.indexOf(view);
    if (index >= 0) {
      cancel();
      dismissal?.backdrop.removeEventListener("pointerdown", pointerdown, true);
      dismissal?.backdrop.removeEventListener("pointercancel", cancel, true);
      dismissal?.backdrop.removeEventListener("click", click, true);
      shared.views.splice(index, 1);
      view.scope.close();
    }
  };
}

/** Cancel in-flight UI captures when an owned control group is disabled or keyboard-owned. */
export function invalidatePressScope(root: HTMLElement): void {
  const shared = state(owner(root));
  const interruption = shared.gate.open();
  interruption.close();
}
