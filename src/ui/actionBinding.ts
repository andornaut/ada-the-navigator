import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { HoldAction } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";

import { activateAdaAction, type AdaActionBinding } from "./actionActivation.ts";

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
  options: AdaActionOptions;
}
const bindings = new WeakMap<HTMLElement, Entry>();

/** Replaces the caller's native click listener, never supplements a second action listener. */
export function bindAdaAction(options: AdaActionOptions, element: HTMLElement) {
  if (bindings.has(element)) {
    throw new Error("Ada action already registered");
  }
  const entry: Entry = { options };
  bindings.set(element, entry);
  const current = () => bindings.get(element) === entry && entry.options.current();
  const click = (event: MouseEvent) => {
    if (current() && entry.options.beforeClick?.(event) !== false) {
      activateAdaAction(entry.options, "click");
    }
  };
  element.addEventListener("click", click);
  return {
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
        entry.options.current();
      return {
        activate: () => {
          if (current()) {
            activateAdaAction(entry.options, "click");
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
