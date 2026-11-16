import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type {
  HoldAction,
  HoldActionBinding,
} from "@andornaut/game-kit/runtime/web/input/dom/holdActions";

import { activateAdaAction, type AdaActionBinding } from "./actionActivation.ts";
import { adaActionHasRoot, adaActionOwnedBy, adaActionRootAllows } from "./actionRegistry.ts";

/** Shared with the weapon detail override; duration is independent of display scale. */
export const ADA_ACTION_HOLD_MS = 500;

export interface AdaActionOptions extends AdaActionBinding {
  /** Only this control may expose its guarded refusal action while announcing aria-disabled. */
  readonly ownAriaDisabled?: HoldAction["ownAriaDisabled"];
  /** Maps an owned physical field to an existing registered target; undefined retains native routing. */
  readonly resolvePointerTarget?: (
    context: { readonly physicalTarget: Element },
    event: PointerEvent,
  ) => HTMLElement | null | undefined;
  /** Self ownership excludes card/text descendants from both native click and hold resolution. */
  readonly hitTarget?: "self" | "descendants";
  /** Factory mode registers hold metadata while the factory retains its native click listener. */
  readonly nativeClickOwner?: "registry" | "factory";
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
  const nativeClickOwner = options.nativeClickOwner ?? "registry";
  const hitTarget = options.hitTarget ?? "descendants";
  if (nativeClickOwner === "factory" && options.beforeClick) {
    throw new Error("Factory-owned native click cannot use a registry event hook");
  }
  const entry: Entry = { activate, options };
  bindings.set(element, entry);
  const current = () =>
    bindings.get(element) === entry &&
    element.isConnected &&
    adaActionHasRoot(element) &&
    adaActionRootAllows(element) &&
    entry.options.current();
  function activate(): boolean {
    return current() && activateAdaAction(entry.options, "click");
  }
  const click = (event: MouseEvent) => {
    if (
      (hitTarget !== "self" || event.target === element) &&
      current() &&
      entry.options.beforeClick?.(event) !== false
    ) {
      entry.activate();
    }
  };
  if (nativeClickOwner === "registry") {
    element.addEventListener("click", click);
  }
  return {
    activate: entry.activate,
    dispose() {
      if (bindings.get(element) === entry) {
        bindings.delete(element);
        if (nativeClickOwner === "registry") {
          element.removeEventListener("click", click);
        }
      }
    },
    update(next: AdaActionOptions) {
      if (bindings.get(element) === entry) {
        if (
          (next.nativeClickOwner ?? "registry") !== nativeClickOwner ||
          (nativeClickOwner === "factory" && next.beforeClick)
        ) {
          throw new Error("Native click ownership cannot change during a binding lifetime");
        }
        if ((next.hitTarget ?? "descendants") !== hitTarget) {
          throw new Error("Action hit target cannot change during a binding lifetime");
        }
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
      if (
        (entry.options.hitTarget === "self" && target !== element) ||
        !adaActionOwnedBy(root, element)
      ) {
        return null;
      }
      const owned = element;
      const current = () =>
        bindings.get(owned) === entry &&
        owned.isConnected &&
        root.contains(owned) &&
        adaActionOwnedBy(root, owned) &&
        owned.closest("[hidden], [inert]") === null &&
        adaActionRootAllows(owned) &&
        entry.options.current();
      return {
        activate: () => {
          if (current()) {
            entry.activate();
          }
        },
        available: () => {
          if (!current()) {
            return false;
          }
          const action = entry.options.hold ?? entry.options.click;
          const availability = action.availability();
          return (
            controlPresentation(availability).executable ||
            (entry.options.ownAriaDisabled === "refusal-feedback" &&
              availability.kind === "unavailable" &&
              action.refuse !== undefined)
          );
        },
        element: owned,
        identity: entry,
        ...(entry.options.ownAriaDisabled === undefined
          ? {}
          : { ownAriaDisabled: entry.options.ownAriaDisabled }),
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

function livePointerEntry(root: HTMLElement, entry: Entry, element: HTMLElement): boolean {
  return (
    bindings.get(element) === entry &&
    element.isConnected &&
    root.contains(element) &&
    adaActionHasRoot(element) &&
    adaActionOwnedBy(root, element) &&
    !element.matches(":disabled") &&
    element.closest("[hidden], [inert]") === null &&
    adaActionRootAllows(element) &&
    entry.options.current() &&
    bindings.get(element) === entry
  );
}

/** Consults only the nearest declared surface in the current owning root, without adding a dispatcher. */
export function resolveAdaPointerTarget(
  context: { readonly physicalTarget: Element; readonly root: HTMLElement },
  event: PointerEvent,
): HTMLElement | null | undefined {
  const { physicalTarget, root } = context;
  const view = root.ownerDocument.defaultView;
  if (!view || !(physicalTarget instanceof view.Node) || !root.contains(physicalTarget)) {
    return null;
  }
  let element =
    physicalTarget instanceof view.HTMLElement ? physicalTarget : physicalTarget.parentElement;
  if (
    !element ||
    !element.isConnected ||
    !adaActionHasRoot(element) ||
    !adaActionOwnedBy(root, element) ||
    element.closest("[hidden], [inert]") !== null ||
    !adaActionRootAllows(element)
  ) {
    return null;
  }
  while (element && root.contains(element)) {
    const entry = bindings.get(element);
    if (entry?.options.resolvePointerTarget) {
      const surface = element;
      if (!livePointerEntry(root, entry, surface)) {
        return undefined;
      }
      const target = entry.options.resolvePointerTarget?.({ physicalTarget }, event);
      if (!livePointerEntry(root, entry, surface)) {
        return null;
      }
      if (target === null || target === undefined) {
        return target;
      }
      if (!(target instanceof view.HTMLElement) || !surface.contains(target)) {
        return null;
      }
      const targetEntry = bindings.get(target);
      return targetEntry && livePointerEntry(root, targetEntry, target) ? target : null;
    }
    element = element.parentElement;
  }
  return undefined;
}

function actionControls(completedSubtree: HTMLElement): HTMLElement[] {
  const selector =
    'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], [data-action]';
  const controls = [...completedSubtree.querySelectorAll<HTMLElement>(selector)];
  if (completedSubtree.matches(selector)) {
    controls.unshift(completedSubtree);
  }
  return controls;
}

function assertControlMetadata(controls: readonly HTMLElement[]): void {
  for (const element of controls) {
    if (!bindings.has(element)) {
      throw new Error("Discrete action control has no registered action binding");
    }
  }
}

/** Audits completed semantic construction even while detached, hidden or unavailable. */
export function assertAdaActionMetadata(completedSubtree: HTMLElement): void {
  assertControlMetadata(actionControls(completedSubtree));
}

/** Audits attached construction without evaluating runtime action or eligibility policy. */
export function assertAdaActionBindings(completedSubtree: HTMLElement): void {
  const controls = actionControls(completedSubtree);
  assertControlMetadata(controls);
  for (const element of [completedSubtree, ...controls]) {
    if (!element.isConnected || !adaActionHasRoot(element)) {
      throw new Error("Discrete action control has no live action root");
    }
  }
}

export interface AdaFactoryHoldOptions {
  readonly current: () => boolean;
  readonly slopPx: () => number;
}

/** Uses the factory's original guarded action and availability without another native listener. */
export function createAdaFactoryHoldBinding(
  options: AdaFactoryHoldOptions,
  root: HTMLElement,
): HoldActionBinding {
  return (action) => {
    if (!root.contains(action.element)) {
      throw new Error("Factory action must belong to its recovery root");
    }
    const binding = bindAdaAction(
      {
        click: {
          availability: () => (action.available() ? { kind: "available" } : { kind: "omitted" }),
          run: action.activate,
        },
        current: () => root.contains(action.element) && options.current(),
        nativeClickOwner: "factory",
        slopPx: options.slopPx,
      },
      action.element,
    );
    return binding.dispose;
  };
}
