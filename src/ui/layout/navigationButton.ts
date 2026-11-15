import { MODAL_LAYER, UI_SCOPE } from "../modal.ts";
import { hudDiscStyle } from "../weapons.ts";
import { units } from "./css.ts";
import { HUD_BUTTON, PAUSE_BUTTON } from "./playView.ts";

export const NAVIGATION_BUTTON_STYLE = `
${hudDiscStyle(`${UI_SCOPE} .ada-pause[data-navigation=menu]`, ".ada-navigation-disc")}
${UI_SCOPE} .ada-pause[data-navigation=menu]{
  width:${units(PAUSE_BUTTON.hit.width)};
  height:${units(PAUSE_BUTTON.hit.height)};
  z-index:${MODAL_LAYER + 1}
}
${UI_SCOPE} .ada-pause[data-navigation=menu]::before,
${UI_SCOPE} .ada-navigation-disc::before{display:none}
${UI_SCOPE} .ada-navigation-disc[hidden]{display:none}
${UI_SCOPE} .ada-navigation-disc > svg{
  width:${units(HUD_BUTTON.glyph)};
  height:${units(HUD_BUTTON.glyph)}
}
`;
