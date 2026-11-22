import { HUD_BUTTON } from "../data/layout.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { units } from "./layout/css.ts";
import { TEXT_TOKENS } from "./modal.ts";

/** The shared close artwork on a native button. The modal owns its action binding. */
export function createModalClose(action: string, label: string): HTMLButtonElement {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  close.dataset.action = action;
  close.setAttribute("aria-label", label);
  return close;
}

/** Give Map close buttons a filled focus cue, using the shared close art as the glyph. */
export function mapCloseStyle(selector: string, restFace = "transparent"): string {
  const focus = `${selector}:focus-visible`;
  // Mask the idle atlas frame only. The shared active sprite already has its own face and ink.
  const glyph = `
    background:var(--map-close-ink);
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
  background:var(--map-close-face,${restFace});
  pointer-events:none;
  z-index:-1
}
${focus}{
  outline:none;
  box-shadow:none;
  --map-close-face:${TEXT_TOKENS.label};
  --map-close-ink:${TEXT_TOKENS.buttonLabel}
}
${focus}:not(:active)::before{${glyph}}
@media (forced-colors:active){
  ${selector}{
    forced-color-adjust:none;
    --map-close-face:ButtonFace;
    --map-close-ink:ButtonText
  }
  ${focus}{
    --map-close-face:Highlight;
    --map-close-ink:HighlightText
  }
  ${selector}:not(:active)::before{${glyph}}
}
`;
}
