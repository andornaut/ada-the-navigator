import { HUD_BUTTON } from "../data/layout.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { units } from "./layout/css.ts";

/** The shared close artwork on a native button. The modal owns its action binding. */
export function createModalClose(action: string, label: string): HTMLButtonElement {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  close.dataset.action = action;
  close.setAttribute("aria-label", label);
  return close;
}

/** Give close buttons a filled focus cue, using the idle art as the glyph. */
export function modalCloseStyle(
  selector: string,
  paint: { readonly face: string; readonly ink: string },
): string {
  const focus = `${selector}:focus-visible`;
  // Mask the idle atlas frame only. The shared active sprite already has its own face and ink.
  const glyph = `
    background:var(--ada-close-ink);
    mask:url('/art/ui/sprites/ui-close.png') 0 0 /
      ${units(2 * CARD_CLOSE.art.width)} ${units(CARD_CLOSE.art.height)} no-repeat
  `;
  return `
${selector}::after{
  content:"";
  position:absolute;
  inset:0;
  width:${units(HUD_BUTTON.disc)};
  height:${units(HUD_BUTTON.disc)};
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
${focus}:not(:active)::before{${glyph}}
@media (forced-colors:active){
  ${selector}{
    forced-color-adjust:none;
    --ada-close-ink:ButtonText
  }
  ${focus}{
    --ada-close-face:Highlight;
    --ada-close-ink:HighlightText
  }
  ${selector}:not(:active)::before{${glyph}}
}
`;
}

/** Keep each Map's resting face while sharing the dialog close's focus and pressed art. */
export function mapCloseStyle(selector: string, restFace = "transparent"): string {
  return `
${selector}{--ada-close-rest:${restFace}}
@media (forced-colors:active){
  ${selector}{--ada-close-rest:ButtonFace}
}
`;
}
