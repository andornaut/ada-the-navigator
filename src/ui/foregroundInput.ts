import {
  bindForegroundInput,
  type ForegroundInput,
  type ForegroundInputOptions,
  type ForegroundSurface,
} from "@andornaut/game-kit/runtime/web/input/dom/foregroundInput";
import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import {
  foregroundPressGuard,
  resolveAdaForegroundAction,
  rootPressGuard,
} from "./actions/index.ts";

type GameEscape = NonNullable<ForegroundInputOptions["gameEscape"]>;

function createInput(document: Document) {
  let escape: GameEscape | undefined;
  let gameBlocked: (() => boolean) | undefined;
  const router = bindForegroundInput(
    { gameEscape: () => (gameBlocked?.() ? undefined : escape?.()) },
    document,
  );
  const input: ForegroundInput = {
    dispose: router.dispose,
    register(surface) {
      const unblocked = () =>
        surface.layer === "crash" || surface.layer === "recovery" || gameBlocked?.() !== true;
      const guard = () =>
        surface.guard ?? foregroundPressGuard(surface.root) ?? rootPressGuard(surface.root);
      const press: PressGuard = {
        gate: {
          accepts: () => unblocked() && guard().gate.accepts(),
          capture() {
            const eligible = unblocked();
            const captured = guard().gate.capture();
            return () => eligible && unblocked() && captured();
          },
        },
      };
      Object.defineProperty(press, "tapGuard", { get: () => guard().tapGuard });
      return router.register({
        resolve: (target) => resolveAdaForegroundAction(surface.root, target),
        ...surface,
        guard: press,
      });
    },
  };
  return {
    input,
    setGameBlock(next: () => boolean) {
      gameBlocked = next;
      return () => {
        if (gameBlocked === next) {
          gameBlocked = undefined;
        }
      };
    },
    setGameEscape(next: GameEscape) {
      escape = next;
      return () => {
        if (escape === next) {
          escape = undefined;
        }
      };
    },
  };
}

const inputs = new WeakMap<Document, ReturnType<typeof createInput>>();
function documentInput(document: Document) {
  let input = inputs.get(document);
  if (input === undefined) {
    input = createInput(document);
    inputs.set(document, input);
  }
  return input;
}

export function adaForegroundInput(document: Document): ForegroundInput {
  return documentInput(document).input;
}

export function registerGameEscape(document: Document, escape: GameEscape): () => void {
  return documentInput(document).setGameEscape(escape);
}

export function registerForegroundSurface(surface: ForegroundSurface): () => void {
  return adaForegroundInput(surface.root.ownerDocument).register(surface);
}

/** Applies the existing game transition fence before foreground command dispatch. */
export function registerForegroundBlock(document: Document, blocked: () => boolean): () => void {
  return documentInput(document).setGameBlock(blocked);
}
