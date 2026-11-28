import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { ADA_ACTION_HOLD_MS, bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { adaActionOwnedBy, adaActionRootAllows } from "./actionRegistry.ts";
import { readViewUnit } from "./layout/dom.ts";
import { SCROLL } from "./layout/index.ts";

interface StandardTextActionOptions {
  readonly availability: (
    button: HTMLButtonElement,
  ) => ControlAvailability | { readonly kind: "disabled" };
  readonly current: () => boolean;
  readonly run: () => void;
  readonly reason?: HTMLElement;
  readonly refuse?: (reason: string) => void;
  /** Keep a native-disabled control's tab exclusion while allowing the owned pointer refusal. */
  readonly pointerRefusal?: boolean;
  readonly separateFace?: boolean;
}

/** Kit owns the native click. Ada's existing root owns hold, eligibility and action identity. */
export function createStandardTextAction(
  root: HTMLElement,
  label: string,
  options: StandardTextActionOptions,
) {
  let ready = false;
  const resolve = (button: HTMLButtonElement) => {
    const action = resolveAdaHoldAction(root, button);
    return action?.available() ? action : null;
  };
  const tryRefusal = () => {
    // Kit can report an unavailable click even when getAction returned null.
    if (options.availability(button).kind === "unavailable") {
      resolve(button)?.activate();
    }
  };
  const kit = createButton(root.ownerDocument, {
    appearance: {
      className: "ada-button",
      contentClassName: "ui-control-label",
      ...(options.separateFace ? { face: {} } : {}),
      layout: "caller",
    },
    content: { kind: "text", label },
    getAction: resolve,
    getState: (button) => {
      // Kit presents once during construction, before the button can be registered.
      if (!ready) {
        return {};
      }
      const availability = options.availability(button);
      return {
        availability:
          options.refuse && options.pointerRefusal && availability.kind === "unavailable"
            ? { kind: "pointer-refusal" }
            : availability,
      };
    },
    ...(options.refuse
      ? {
          ...(options.pointerRefusal ? { onPointerRefusal: tryRefusal } : {}),
          onUnavailable: tryRefusal,
        }
      : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
  });
  const button = kit.element;
  const registered = bindAdaAction(
    {
      click: {
        availability: () => {
          const state = options.availability(button);
          // A caller can synchronously close or replace the action while reading its state.
          const current =
            ready &&
            button.isConnected &&
            button.closest("[hidden], [inert]") === null &&
            adaActionOwnedBy(root, button) &&
            adaActionRootAllows(button) &&
            options.current();
          return current && ready && state.kind !== "disabled" ? state : { kind: "omitted" };
        },
        run: options.run,
        ...(options.refuse ? { refuse: options.refuse } : {}),
      },
      current: () => ready && options.current() && ready,
      nativeClickOwner: "factory",
      ...(options.refuse ? { ownAriaDisabled: "refusal-feedback" as const } : {}),
      ...(options.refuse && options.pointerRefusal
        ? {
            resolvePointerTarget: (_context, event) => {
              // A pointer-only refusal keeps the boundary button out of pointer focus.
              if (
                event.type === "pointerdown" &&
                options.availability(button).kind === "unavailable"
              ) {
                event.preventDefault();
              }
              return undefined;
            },
          }
        : {}),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
    },
    button,
  );
  const dispose = () => {
    ready = false;
    registered.dispose();
    kit.dispose();
  };
  try {
    ready = true;
    kit.refresh();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    dispose,
    element: button,
    refresh: kit.refresh,
    setLabel: (text: string) => kit.setContent({ kind: "text", label: text }),
  };
}
