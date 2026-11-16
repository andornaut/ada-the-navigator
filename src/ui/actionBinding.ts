import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { HoldAction } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";

import { activateAdaAction, type AdaActionBinding } from "./actionActivation.ts";
import { adaActionHasRoot, adaActionRootAllows } from "./actionRegistry.ts";

/** Shared with the weapon detail override; duration is independent of display scale. */
export const ADA_ACTION_HOLD_MS = 500;

export interface AdaActionOptions extends AdaActionBinding {
  /** Client CSS pixels, derived from the current logical drag threshold and view unit. */
  readonly slopPx: () => number;
  readonly current: () => boolean;
  /** Existing native-event behavior, before executing the shared action. False refuses execution. */
  readonly beforeClick?: (event: MouseEvent) => boolean | void;
}

interface Entry {
  readonly activate: () => boolean;
  options: AdaActionOptions;
}
const bindings = new WeakMap<HTMLElement, Entry>();

/** Replaces the caller's native click listener, never supplements a second action listener. */
export function bindAdaAction(options: AdaActionOptions, element: HTMLElement) {
  if (bindings.has(element)) {
    throw new Error("Ada action already registered");
  }
  const entry: Entry = { activate, options };
  bindings.set(element, entry);
  const current = () =>
    bindings.get(element) === entry && adaActionRootAllows(element) && entry.options.current();
  function activate(): boolean {
    return current() && activateAdaAction(entry.options, "click");
  }
  const click = (event: MouseEvent) => {
    if (current() && entry.options.beforeClick?.(event) !== false) {
      entry.activate();
    }
  };
  element.addEventListener("click", click);
  return {
    activate: entry.activate,
    dispose() {
      if (bindings.get(element) === entry) {
        bindings.delete(element);
        element.removeEventListener("click", click);
      }
    },
    update(next: AdaActionOptions) {
      if (bindings.get(element) === entry) {
        entry.options = next;
      }
    },
  };
}

/** Only explicitly owned actions enter the dispatcher. Continuous and unregistered controls do not. */
export function resolveAdaHoldAction(
  root: HTMLElement,
  target: EventTarget | null,
): HoldAction | null {
  const view = root.ownerDocument.defaultView;
  if (!view || !(target instanceof view.Node)) {
    return null;
  }
  let element = target instanceof view.HTMLElement ? target : target.parentElement;
  while (element && root.contains(element)) {
    const entry = bindings.get(element);
    if (entry) {
      const owned = element;
      const current = () =>
        bindings.get(owned) === entry &&
        owned.isConnected &&
        root.contains(owned) &&
        owned.closest("[hidden], [inert]") === null &&
        adaActionRootAllows(owned) &&
        entry.options.current();
      return {
        activate: () => {
          if (current()) {
            entry.activate();
          }
        },
        available: () =>
          current() &&
          controlPresentation((entry.options.hold ?? entry.options.click).availability())
            .executable,
        element: owned,
        rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: entry.options.slopPx() },
        ...(entry.options.hold
          ? {
              hold: () => {
                if (current()) {
                  activateAdaAction(entry.options, "hold");
                }
              },
            }
          : {}),
      };
    }
    element = element.parentElement;
  }
  return null;
}

/** Audit completed control construction, including disabled controls that can later become active. */
export function assertAdaActionBindings(root: HTMLElement): void {
  const selector =
    'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], [data-action]';
  const controls = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root.matches(selector)) {
    controls.unshift(root);
  }
  for (const element of controls) {
    if (!bindings.has(element)) {
      throw new Error("Discrete action control has no registered action binding");
    }
    if (!adaActionHasRoot(element)) {
      throw new Error("Discrete action control has no live action root");
    }
  }
}
