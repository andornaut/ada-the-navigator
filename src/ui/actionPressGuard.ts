import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

/** The UI owner changes the token on every active-view transition, including re-entry. */
export interface AdaUiPressScope {
  readonly token: object;
  readonly guard: PressGuard;
}

/** Root-stable facade over explicit UI scope ports, independent of gameplay input eligibility. */
export function createAdaUiPressGuard(current: () => AdaUiPressScope | null): PressGuard {
  const guard: PressGuard = {
    gate: {
      accepts: () => current()?.guard.gate.accepts() ?? false,
      capture() {
        const scope = current();
        if (!scope) {
          return () => false;
        }
        const accepted = scope.guard.gate.capture();
        return () => {
          const next = current();
          return next?.token === scope.token && next.guard === scope.guard && accepted();
        };
      },
    },
  };
  Object.defineProperty(guard, "tapGuard", { get: () => current()?.guard.tapGuard });
  return guard;
}
