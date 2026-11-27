import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { ADA_ACTION_HOLD_MS, bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";

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
  const tryRefusal = () => {
    // Kit can report an unavailable click even when getAction returned null.
    if (options.availability(kit.element).kind !== "unavailable") {
      return;
    }
    const action = resolveAdaHoldAction(root, kit.element);
    if (action?.available()) {
      action.activate();
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
    getAction: () => {
      const action = resolveAdaHoldAction(root, kit.element);
      return action?.available() ? action : null;
    },
    getState: (button) => {
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
  const registered = bindAdaAction(
    {
      click: {
        availability: () => {
          const state = options.availability(kit.element);
          return state.kind === "disabled" ? { kind: "omitted" } : state;
        },
        run: options.run,
        ...(options.refuse ? { refuse: options.refuse } : {}),
      },
      current: options.current,
      nativeClickOwner: "factory",
      ...(options.refuse ? { ownAriaDisabled: "refusal-feedback" as const } : {}),
      ...(options.refuse && options.pointerRefusal
        ? {
            resolvePointerTarget: (_context, event) => {
              // A pointer-only refusal keeps the boundary button out of pointer focus.
              if (
                event.type === "pointerdown" &&
                options.availability(kit.element).kind === "unavailable"
              ) {
                event.preventDefault();
              }
              return undefined;
            },
          }
        : {}),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(kit.element),
    },
    kit.element,
  );
  return {
    dispose() {
      registered.dispose();
      kit.dispose();
    },
    element: kit.element,
    refresh: kit.refresh,
    setLabel: (text: string) => kit.setContent({ kind: "text", label: text }),
  };
}
