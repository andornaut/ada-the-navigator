import {
  bindHoldActions,
  type HoldActionsOptions,
  type PointerReleaseHoldActionsOptions,
} from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import { guardClicks, type PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import type { RequiredReady } from "../loading/required.ts";
import { assertAdaActionBindings, resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import {
  inCurrentView,
  invalidatePressScope,
  rootPressGuard,
  subscribePressScope,
} from "./pressScope.ts";

export interface AdaPointerReleaseOptions {
  readonly pointerTarget?: HTMLElement | Document;
  /** Return a registered control, null to reject, or undefined to use its native event target. */
  readonly resolvePointer: (event: PointerEvent) => HTMLElement | null | undefined;
  readonly onPressChange?: (element: HTMLElement | null) => void;
}

export interface AdaActionRootOptions {
  /** Opt in only when the caller removes its parallel pointer-release activation. */
  readonly pointerRelease?: AdaPointerReleaseOptions;
  readonly guard: PressGuard;
  readonly requiredReady: RequiredReady;
  /** Subscribe to the same required-resource registry used by requiredReady. */
  readonly subscribeRequired: (invalidate: () => void) => () => void;
}

export interface AdaRecoveryActionRootOptions {
  readonly guard: PressGuard;
}

type RootPolicy =
  | { readonly kind: "game"; readonly options: AdaActionRootOptions }
  | { readonly kind: "recovery"; readonly options: AdaRecoveryActionRootOptions };

/** Game controls remain fenced by the canonical required-resource registry. */
export function bindAdaActionRoot(options: AdaActionRootOptions, root: HTMLElement) {
  return bindRoot({ kind: "game", options }, root);
}

/** Recovery is governed by its own root lifetime and factory action availability, not game readiness. */
export function bindAdaRecoveryActionRoot(
  options: AdaRecoveryActionRootOptions,
  root: HTMLElement,
) {
  return bindRoot({ kind: "recovery", options }, root);
}

function bindRoot(policy: RootPolicy, root: HTMLElement) {
  const options = policy.options;
  const document = root.ownerDocument;
  let disposed = false;
  const scope = rootPressGuard(root);
  const eligible = () =>
    !disposed &&
    root.isConnected &&
    !document.hidden &&
    (policy.kind === "recovery" || policy.options.requiredReady()) &&
    options.guard.gate.accepts();
  const guard: PressGuard = {
    gate: {
      accepts: () => eligible() && scope.gate.accepts(),
      capture() {
        const valid = options.guard.gate.capture();
        const current = scope.gate.capture();
        return () => eligible() && valid() && current();
      },
    },
  };
  Object.defineProperty(guard, "tapGuard", { get: () => options.guard.tapGuard });
  const unregister = registerAdaActionRoot(
    {
      permits: (element) =>
        guard.gate.accepts() &&
        element.isConnected &&
        !element.matches(":disabled") &&
        element.closest("[hidden], [inert]") === null &&
        inCurrentView(root, element),
    },
    root,
  );
  const resolve = (target: EventTarget | null) => {
    const action = resolveAdaHoldAction(root, target);
    return action && inCurrentView(root, action.element) ? action : null;
  };
  const pointer = policy.kind === "game" ? policy.options.pointerRelease : undefined;
  const dispatch: HoldActionsOptions | PointerReleaseHoldActionsOptions = pointer
    ? {
        activation: "pointer-release",
        guard,
        onPressChange: (action) => pointer.onPressChange?.(action?.element ?? null),
        pointerTarget: pointer.pointerTarget,
        resolve,
        resolvePointer: (event) => {
          const element = pointer.resolvePointer(event);
          return resolve(element === undefined ? event.target : element);
        },
      }
    : { guard, resolve };
  const stop = bindHoldActions(dispatch, root);
  const stopClicks = guardClicks(guard, root);
  const stopScope = subscribePressScope(() => stop.cancel(), root);
  const invalidate = () => {
    if (!disposed) {
      invalidatePressScope(root);
    }
  };
  const stopRequired =
    policy.kind === "game" ? policy.options.subscribeRequired(invalidate) : undefined;
  document.addEventListener("visibilitychange", invalidate);
  document.defaultView?.addEventListener("pagehide", invalidate);
  return {
    assertBindings: () => assertAdaActionBindings(root),
    dispose() {
      if (disposed) {
        return;
      }
      invalidate();
      disposed = true;
      unregister();
      stopScope();
      stopRequired?.();
      stopClicks();
      stop();
      document.removeEventListener("visibilitychange", invalidate);
      document.defaultView?.removeEventListener("pagehide", invalidate);
    },
    invalidate,
  };
}

/** Existing roots retain their caller guard until they supply the canonical readiness ports. */
export function bindAdaHoldActions(guard: PressGuard, root: HTMLElement): () => void {
  return bindAdaActionRoot(
    { guard, requiredReady: () => true, subscribeRequired: () => () => {} },
    root,
  ).dispose;
}
