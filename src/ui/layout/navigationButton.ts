import { HUD_BUTTON } from "../../data/layout.ts";
import { FOCUS_STYLE, UI_SCOPE } from "../modal.ts";
import { MENU_ART, type PausePose } from "../pause.ts";
import { units } from "./css.ts";
import { PAUSE_BUTTON } from "./playView.ts";

export const EXIT_ART: Readonly<Record<PausePose, string>> = {
  held: "/art/ui/icons/exit-disc-held.svg",
  press: "/art/ui/icons/exit-disc-press.svg",
  rest: "/art/ui/icons/exit-disc.svg",
};

// The pause button carries the three-bar Menu glyph outside pausable play: the same frame, press
// area and poses, with the Menu art in each pose.
export const NAVIGATION_BUTTON_STYLE = `
${UI_SCOPE} .ada-pause[data-navigation=menu]::before{
  background-image:url('${MENU_ART.rest}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=press]::before{
  background-image:url('${MENU_ART.press}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=held]::before{
  background-image:url('${MENU_ART.held}')
}

${UI_SCOPE} .ada-exit-open{
  box-sizing:border-box;
  width:${units(HUD_BUTTON.target)};
  height:${units(HUD_BUTTON.target)};
  min-width:0;
  min-height:0;
  margin:0;
  padding:0;
  display:grid;
  place-items:center;
  border:0;
  border-radius:0;
  background:transparent;
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation
}
${UI_SCOPE} .ada-exit-open::before{
  content:"";
  width:${units(PAUSE_BUTTON.art.width)};
  height:${units(PAUSE_BUTTON.art.height)};
  border-radius:50%;
  background:url('${EXIT_ART.rest}') center / 100% 100% no-repeat
}
${UI_SCOPE} .ada-exit-open[data-pose=press]::before{
  background-image:url('${EXIT_ART.press}')
}
${UI_SCOPE} .ada-exit-open[data-pose=held]::before{
  background-image:url('${EXIT_ART.held}')
}
${UI_SCOPE} .ada-exit-open:focus-visible{
  outline:none;
  box-shadow:none
}
${UI_SCOPE} .ada-exit-open:focus-visible::before{${FOCUS_STYLE}
}
@media (forced-colors: active){
  ${UI_SCOPE} .ada-exit-open:focus-visible::before{
    outline-color:Highlight;
    box-shadow:none
  }
}
`;
