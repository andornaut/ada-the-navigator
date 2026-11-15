import { createModalInputGate, type ModalInputScope } from "@andornaut/game-kit/input/modalInput";
import type { PressGuard } from "@andornaut/game-kit/web/ui/dom/domPress";

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
): () => void {
  const shared = state(owner(root));
  const view: View = { dialog, live, scope: shared.gate.open() };
  shared.views.push(view);
  return () => {
    const index = shared.views.indexOf(view);
    if (index >= 0) {
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
