import { HUD_BUTTON } from "../../data/layout.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { COLOURS } from "./colours.ts";
import { units } from "./css.ts";
import { PAUSE_BUTTON } from "./playView.ts";
import { TEXT_TOKENS, UI_SCOPE } from "./tokens.ts";

// The pause button's vector art per pose (art/controls.md "Pause"): rest, the press swell, and
// held, which also shows the press's second frame.
export const PAUSE_ART = {
  held: uiIconUrl("pause-held"),
  press: uiIconUrl("pause-press"),
  rest: uiIconUrl("pause"),
} as const;

export type PausePose = keyof typeof PAUSE_ART;

// The Menu button's vector art per pose (art/controls.md "Menu button"): the pause button's frame
// and poses with three bars.
export const MENU_ART: Readonly<Record<PausePose, string>> = {
  held: uiIconUrl("menu-held"),
  press: uiIconUrl("menu-press"),
  rest: uiIconUrl("menu"),
};

export const EXIT_ART: Readonly<Record<PausePose, string>> = {
  held: uiIconUrl("exit-disc-held"),
  press: uiIconUrl("exit-disc-press"),
  rest: uiIconUrl("exit-disc"),
};

export const NAVIGATION_DISCS = ":is(.ada-pause,.ada-exit-open)";
// The navigation art's inner face radius at rest and in the held pose (art/controls.md "Pause").
const NAVIGATION_FACE_RADIUS = { held: 12.5, rest: 13.5 } as const;
const FOCUSED_NAVIGATION = `${UI_SCOPE} ${NAVIGATION_DISCS}:focus-visible`;

// The pause button carries the three-bar Menu glyph outside pausable play: the same frame, press
// area and poses, with the Menu art in each pose.
export const NAVIGATION_BUTTON_STYLE = `
${UI_SCOPE} .ada-pause[data-navigation=menu]::before{
  --ada-nav-pose:url('${MENU_ART.rest}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=press]::before{
  --ada-nav-pose:url('${MENU_ART.press}')
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=held]::before{
  --ada-nav-pose:url('${MENU_ART.held}')
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
  font:inherit;
  color:inherit;
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
  --ada-nav-pose:url('${EXIT_ART.rest}');
  background:var(--ada-nav-pose) center / 100% 100% no-repeat
}
${UI_SCOPE} .ada-exit-open[data-pose=press]::before{
  --ada-nav-pose:url('${EXIT_ART.press}')
}
${UI_SCOPE} .ada-exit-open[data-pose=held]::before{
  --ada-nav-pose:url('${EXIT_ART.held}')
}
${FOCUSED_NAVIGATION}{
  outline:none;
  box-shadow:none
}
/* Tint only the 35-unit artwork's inner face. Lighten keeps its lighter glyph intact. */
${FOCUSED_NAVIGATION}::before{
  --ada-nav-face-radius:${units(NAVIGATION_FACE_RADIUS.rest)};
  --ada-nav-focus-tone:${COLOURS.cardRim};
  --ada-nav-focus-blend:lighten;
  background-image:radial-gradient(circle,
    var(--ada-nav-focus-tone) var(--ada-nav-face-radius),
    transparent var(--ada-nav-face-radius)),var(--ada-nav-pose);
  background-blend-mode:var(--ada-nav-focus-blend),normal
}
${FOCUSED_NAVIGATION}[data-pose=held]::before{
  --ada-nav-face-radius:${units(NAVIGATION_FACE_RADIUS.held)}
}
@media (forced-colors: active){
  /* Invert the face and glyph for a clear contrast change while keeping the authored edge. */
  ${FOCUSED_NAVIGATION}::before{
    forced-color-adjust:none;
    --ada-nav-focus-tone:${TEXT_TOKENS.title};
    --ada-nav-focus-blend:difference
  }
}
`;
