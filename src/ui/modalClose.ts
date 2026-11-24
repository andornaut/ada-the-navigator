import { HUD_BUTTON } from "../data/layout.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { units } from "./layout/css.ts";

// Mask only the idle atlas frame. The active sprite keeps its own face and ink.
const CLOSE_GLYPH_MASK = `mask:url('/art/ui/sprites/ui-close.png') 0 0 /
  ${units(2 * CARD_CLOSE.art.width)} ${units(CARD_CLOSE.art.height)} no-repeat`;

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
