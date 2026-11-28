import {
  createModalInputGate,
  type ModalInputScope,
} from "@andornaut/game-kit/runtime/input/modalInput";
import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import { SCROLL } from "../data/layout.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { readViewUnit } from "./layoutDom/viewScaleBridge.ts";

export interface ViewDismissal {
  readonly backdrop: HTMLElement;
  readonly close: () => void;
}

interface View {
  readonly dialog: HTMLElement;
  readonly dismissal: ViewDismissal | undefined;
  readonly live: readonly HTMLElement[];
  readonly scope: ModalInputScope;
}
function createState(root: HTMLElement) {
  const gate = createModalInputGate();
  const views: View[] = [];
  const dismissals = new Map<HTMLElement, { readonly dispose: () => void; users: number }>();
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
  return { dismissals, gate, guard, listeners, views };
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
    ? element === view.dismissal?.backdrop ||
        [view.dialog, ...view.live].some((part) => part.contains(element))
    : root.contains(element);
}

/** Backdrop dismissal retains primary-pointer ownership even when other controls allow touch chords. */
export function isCurrentViewBackdrop(root: HTMLElement, element: HTMLElement): boolean {
  return state(owner(root)).views.at(-1)?.dismissal?.backdrop === element;
}

/** Registers top-only dismissal metadata; the published layer retains focus and navigation. */
export function enterPressView(
  root: HTMLElement,
  dialog: HTMLElement,
  live: readonly HTMLElement[] = [],
  dismissal?: ViewDismissal,
): () => void {
  const shared = state(owner(root));
  const view: View = { dialog, dismissal, live, scope: shared.gate.open() };
  shared.views.push(view);
  notify(shared);
  if (dismissal) {
    const backdrop = dismissal.backdrop;
    let metadata = shared.dismissals.get(backdrop);
    if (!metadata) {
      const current = () =>
        root.isConnected && shared.views.at(-1)?.dismissal?.backdrop === backdrop;
      const binding = bindAdaAction(
        {
          click: {
            availability: () => (current() ? { kind: "available" } : { kind: "omitted" }),
            run: () => shared.views.at(-1)?.dismissal?.close(),
          },
          current,
          hitTarget: "self",
          // The root's published pointer-release dispatcher owns both tap and hold activation.
          nativeClickOwner: "factory",
          slopPx: () => SCROLL.dragThreshold * readViewUnit(backdrop),
        },
        backdrop,
      );
      metadata = { dispose: binding.dispose, users: 0 };
      shared.dismissals.set(backdrop, metadata);
    }
    metadata.users++;
  }
  return () => {
    const index = shared.views.indexOf(view);
    if (index >= 0) {
      if (dismissal) {
        const metadata = shared.dismissals.get(dismissal.backdrop);
        if (metadata && --metadata.users === 0) {
          metadata.dispose();
          shared.dismissals.delete(dismissal.backdrop);
        }
      }
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
