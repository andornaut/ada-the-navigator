import { MODAL_LAYER, UI_SCOPE } from "../modal.ts";
import { MENU_ART } from "../pause.ts";

// The pause button carries the three-bar Menu glyph outside pausable play: the same frame, press
// area and poses, with the Menu art in each pose.
export const NAVIGATION_BUTTON_STYLE = `
${UI_SCOPE} .ada-pause[data-navigation=menu]{
  z-index:${MODAL_LAYER + 1}
}
${UI_SCOPE}.ada-modal-open .ada-pause[inert]{
  z-index:${MODAL_LAYER - 1}
}
${UI_SCOPE} .ada-pause[data-navigation=menu]::before{
  background-image:url('${MENU_ART.rest}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=press]::before{
  background-image:url('${MENU_ART.press}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=held]::before{
  background-image:url('${MENU_ART.held}')
}
`;
