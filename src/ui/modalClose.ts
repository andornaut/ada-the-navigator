import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { HUD_BUTTON } from "../data/layout.ts";
import { ADA_ACTION_HOLD_MS, bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { units } from "./layout/css.ts";

// Mask only the idle atlas frame. The active sprite keeps its own face and ink.
const CLOSE_GLYPH_MASK = `mask:url('/art/ui/sprites/ui-close.png') 0 0 /
  ${units(CARD_CLOSE.sheetWidth)} ${units(CARD_CLOSE.art.height)} no-repeat`;

/** Give close buttons a filled focus cue, using the idle art as the glyph. */
export function modalCloseStyle(
  selector: string,
  paint: { readonly face: string; readonly ink: string },
): string {
  const focus = `${selector}:focus-visible`;
  return `
${selector}::after{
  content:"";
  position:absolute;
  inset:0;
  width:var(--ada-close-face-size,${units(CARD_CLOSE.art.width)});
  height:var(--ada-close-face-size,${units(CARD_CLOSE.art.height)});
  margin:auto;
  border-radius:50%;
  background:var(--ada-close-face,var(--ada-close-rest,transparent));
  pointer-events:none;
  z-index:-1
}
${focus}{
  outline:none;
  box-shadow:none;
  --ada-close-face:${paint.face};
  --ada-close-ink:${paint.ink}
}
${focus}:not(:active)::before{
  background:var(--ada-close-ink);
  ${CLOSE_GLYPH_MASK}
}
@media (forced-colors:active){
  ${selector}{forced-color-adjust:none}
  ${focus}{
    --ada-close-face:Highlight;
    --ada-close-ink:HighlightText
  }
}
`;
}

/** Keep each Map's resting face while sharing the dialog close's focus and pressed art. */
export function mapCloseStyle(selector: string, restFace = "transparent"): string {
  return `
${selector}{
  --ada-close-rest:${restFace};
  --ada-close-face-size:${units(HUD_BUTTON.disc)}
}
@media (forced-colors:active){
  ${selector}{--ada-close-rest:ButtonFace}
  ${selector}:not(:active)::before{
    background:var(--ada-close-ink,ButtonText);
    ${CLOSE_GLYPH_MASK}
  }
}
`;
}

/** Preserve the sprite face under Kit defaults at each caller's existing specificity. */
export function standardCloseActionStyle(selector: string): string {
  return `
${selector} > .ada-close-content{display:none}
${selector}.ui-standard-button:focus-visible{background-color:transparent}
`;
}

interface StandardCloseActionOptions {
  readonly current: (button: HTMLButtonElement) => boolean;
  readonly run: () => void;
  readonly slopPx: (button: HTMLButtonElement) => number;
  readonly slopThreshold: number;
}

/** Kit owns native click. The existing action root guards the same action for click and hold. */
export function createStandardCloseAction(
  root: HTMLElement,
  action: string,
  label: string,
  options: StandardCloseActionOptions,
) {
  const availability = (button: HTMLButtonElement) => {
    if (button.matches(":disabled")) {
      return { kind: "disabled" } as const;
    }
    return button.hidden ? ({ kind: "omitted" } as const) : ({ kind: "available" } as const);
  };
  const kit = createButton(root.ownerDocument, {
    appearance: {
      className: "ada-close",
      contentClassName: "ada-close-content",
      layout: "caller",
    },
    content: { kind: "icon", name: label },
    getAction: (button) => {
      const owned = resolveAdaHoldAction(root, button);
      return owned?.available() ? owned : null;
    },
    getState: (button) => ({ availability: availability(button) }),
    rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: options.slopThreshold },
  });
  const button = kit.element;
  button.dataset.action = action;
  const binding = bindAdaAction(
    {
      click: {
        availability: () =>
          availability(button).kind === "available" ? { kind: "available" } : { kind: "omitted" },
        run: options.run,
      },
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
