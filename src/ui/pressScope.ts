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
  const listeners = new Set<() => void>();
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
  return { gate, guard, listeners, views };
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

function notify(shared: ReturnType<typeof createState>): void {
  for (const listener of [...shared.listeners]) {
    if (shared.listeners.has(listener)) {
      listener();
    }
  }
}

/** Reports actual modal and capture revisions synchronously to the owning input binding. */
export function subscribePressScope(listener: () => void, root: HTMLElement): () => void {
  const shared = state(owner(root));
  shared.listeners.add(listener);
  return () => shared.listeners.delete(listener);
}

/** Register the parent UI root first so child roots share its modal scope and revisions. */
export function rootPressGuard(root: HTMLElement): PressGuard {
  const owned = owner(root);
  const shared = state(owned).guard;
  if (owned === root) {
    return shared;
  }
  return {
    gate: {
      accepts: () => root.isConnected && shared.gate.accepts(),
      capture() {
        const captured = shared.gate.capture();
        return () => root.isConnected && captured();
      },
    },
  };
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
  notify(shared);
  let outside:
    | {
        readonly id: number;
        readonly valid: () => boolean;
        readonly x: number;
        readonly y: number;
        released: boolean;
      }
    | undefined;
  const current = () => shared.views.at(-1) === view && root.isConnected;
  const primary = (event: PointerEvent) => event.isPrimary !== false && event.button === 0;
  const pointerdown = (event: PointerEvent) => {
    outside =
      current() && event.target === dismissal?.backdrop && primary(event)
        ? {
            id: event.pointerId,
            released: false,
            valid: view.scope.capture(),
            x: event.clientX,
            y: event.clientY,
          }
        : undefined;
  };
  const cancel = () => {
    outside = undefined;
  };
  const pointerup = (event: PointerEvent) => {
    if (
      outside &&
      dismissal &&
      current() &&
      outside.valid() &&
      primary(event) &&
      event.pointerId === outside.id &&
      event.target === dismissal.backdrop &&
      isTap(
        readViewUnit(dismissal.backdrop),
        { x: outside.x, y: outside.y },
        { x: event.clientX, y: event.clientY },
      )
    ) {
      outside.released = true;
    } else {
      cancel();
    }
  };
  const click = (event: MouseEvent) => {
    const from = outside;
    outside = undefined;
    if (
      dismissal &&
      from?.released &&
      from.valid() &&
      current() &&
      event.target === dismissal.backdrop &&
      (!("pointerId" in event) || event.pointerId === from.id)
    ) {
      // Consume before the callback can restore a parent view on the same backdrop.
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissal.close();
    }
  };
  dismissal?.backdrop.addEventListener("pointerdown", pointerdown, true);
  dismissal?.backdrop.addEventListener("pointerup", pointerup, true);
  dismissal?.backdrop.addEventListener("pointercancel", cancel, true);
  dismissal?.backdrop.addEventListener("click", click, true);
  return () => {
    const index = shared.views.indexOf(view);
    if (index >= 0) {
      cancel();
      dismissal?.backdrop.removeEventListener("pointerdown", pointerdown, true);
      dismissal?.backdrop.removeEventListener("pointerup", pointerup, true);
      dismissal?.backdrop.removeEventListener("pointercancel", cancel, true);
      dismissal?.backdrop.removeEventListener("click", click, true);
      shared.views.splice(index, 1);
      view.scope.close();
      notify(shared);
    }
  };
}

/** Cancel in-flight UI captures when an owned control group is disabled or keyboard-owned. */
export function invalidatePressScope(root: HTMLElement): void {
  const shared = state(owner(root));
  const interruption = shared.gate.open();
  interruption.close();
  notify(shared);
}
