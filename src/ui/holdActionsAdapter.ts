import { bindHoldActions } from "@andornaut/game-kit/web/input/dom/holdActions";
import type { PressGuard } from "@andornaut/game-kit/web/ui/dom/domPress";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { inCurrentView } from "./pressScope.ts";

/** One released root lifecycle hook. Gesture recognition and suppression remain in the kit. */
export function bindAdaHoldActions(guard: PressGuard, root: HTMLElement): () => void {
  return bindHoldActions(
    {
      guard,
      resolve: (target) => {
        const action = resolveAdaHoldAction(root, target);
        return action && inCurrentView(root, action.element) ? action : null;
      },
    },
    root,
  );
}
