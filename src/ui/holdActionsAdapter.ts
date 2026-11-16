import { bindHoldActions } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
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

export interface AdaActionRootOptions {
  readonly guard: PressGuard;
  readonly requiredReady: RequiredReady;
  /** Subscribe to the same required-resource registry used by requiredReady. */
  readonly subscribeRequired: (invalidate: () => void) => () => void;
}

/** One owned root uses the published dispatcher and canonical readiness subscription. */
export function bindAdaActionRoot(options: AdaActionRootOptions, root: HTMLElement) {
  const document = root.ownerDocument;
  let disposed = false;
  const scope = rootPressGuard(root);
  const eligible = () =>
    !disposed &&
    root.isConnected &&
    !document.hidden &&
    options.requiredReady() &&
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
  const stop = bindHoldActions(
    {
      guard,
      resolve: (target) => {
        const action = resolveAdaHoldAction(root, target);
        return action && inCurrentView(root, action.element) ? action : null;
      },
    },
    root,
  );
  const stopClicks = guardClicks(guard, root);
  const stopScope = subscribePressScope(() => stop.cancel(), root);
  const invalidate = () => {
    if (!disposed) {
      invalidatePressScope(root);
    }
  };
  const stopRequired = options.subscribeRequired(invalidate);
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
      stopRequired();
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
