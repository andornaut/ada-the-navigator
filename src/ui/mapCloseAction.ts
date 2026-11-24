import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { ADA_ACTION_HOLD_MS, bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { mapCloseStyle } from "./modalClose.ts";

interface MapCloseActionOptions {
  readonly current: (button: HTMLButtonElement) => boolean;
  readonly run: () => void;
  readonly slopPx: (button: HTMLButtonElement) => number;
  readonly slopThreshold: number;
}

/** The Map styles paint the sprite on the button's pseudo-elements. */
export function mapCloseActionStyle(selector: string, restFace?: string): string {
  return `
${mapCloseStyle(selector, restFace)}
${selector} > .ada-map-close-content{display:none}
${selector}.ui-standard-button:focus-visible{background-color:transparent}
`;
}

/** Kit owns native click. The existing Map root guards the same action for click and hold. */
export function createMapCloseAction(
  root: HTMLElement,
  action: string,
  label: string,
  options: MapCloseActionOptions,
) {
  const availability = (button: HTMLButtonElement) =>
    button.hidden ? ({ kind: "omitted" } as const) : ({ kind: "available" } as const);
  const kit = createButton(root.ownerDocument, {
    appearance: {
      className: "ada-close",
      contentClassName: "ada-map-close-content",
      layout: "caller",
    },
    content: { kind: "icon", name: label },
    getAction: (button) => {
      const owned = resolveAdaHoldAction(root, button);
      return owned?.available() ? owned : null;
    },
    getState: (button) => ({
      availability: button.matches(":disabled") ? { kind: "disabled" } : availability(button),
    }),
    rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: options.slopThreshold },
  });
  const button = kit.element;
  button.dataset.action = action;
  const binding = bindAdaAction(
    {
      click: { availability: () => availability(button), run: options.run },
      current: () => options.current(button),
      nativeClickOwner: "factory",
      slopPx: () => options.slopPx(button),
    },
    button,
  );
  return {
    dispose() {
      binding.dispose();
      kit.dispose();
    },
    element: button,
  };
}
