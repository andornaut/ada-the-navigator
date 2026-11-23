import { HIT_RULE, hitMargin } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { setControlPlacement } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";

import { SCREEN } from "../data/screen.ts";
import {
  CARD_CLOSE,
  CARD_CONTENT,
  cardHeaderLayout,
  cardTitleReserve,
  listCardHeader,
} from "./layout/cardFrame.ts";
import {
  CARD_WIDTH_CAPS,
  type CardSize,
  MODAL_SCREEN_MARGIN,
  SCROLL,
} from "./layout/contentCard.ts";
import {
  BUTTON_SLICE,
  CARD_SLICE,
  CHEAT_GRANT_ICON,
  CONTROL_ROW,
  FOCUS_RING,
  STORY_BUTTON,
  TEXT_BUTTON,
} from "./layout/controls.ts";
import { font, fromHudEdge, slice, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { PAUSE_BUTTON } from "./layout/playView.ts";
import { BUTTON_GAP, SPACING, STACK_BUTTON_GAP, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { modalCloseStyle } from "./modalClose.ts";
import { PAUSE_ART } from "./pause.ts";

// Ada's modal cards and their controls, as art/controls.md sets them (Chibi's control rules in
// the dark lavender palette) and art/layout.md sizes them: Settings, the install steps, the update
// offer, the cheats card, Paused and Travel share these styles and builders. Every size is a
// logical px through src/ui/layout.

export const BUTTON_FACE = {
  disabled: "#2f2d3d",
  primary: "#bfa06f",
  secondary: "#9690b4",
} as const;

// Text colours on the card face #3b3850.
export const TEXT_TOKENS = {
  buttonLabel: "#181425",
  disabledLabel: "#9a96ad",
  label: "#ead4aa",
  /** Every text of an unaffordable or busy tile row, on its flat #2f2d3d face (5.42:1). */
  rowDisabled: "#a6a2b8",
  /** A tile row's second line and Owned, on its #46425e face (5.11:1). */
  rowSupporting: "#c0bbd0",
  supporting: "#b8b3c9",
  title: "#ffffff",
} as const;

export { BUTTON_SLICE } from "./layout/controls.ts";

export type ButtonRole = "primary" | "secondary";
export type ButtonTag = "disabled" | "normal" | "pressed";

// The sheet tag a button shows.
export function buttonTag(disabled: boolean, pressed: boolean): ButtonTag {
  if (disabled) {
    return "disabled";
  }
  return pressed ? "pressed" : "normal";
}

// Paired actions in reading order: secondary on the left, primary on the right.
export function actionOrder<T extends { readonly role: ButtonRole }>(actions: readonly T[]): T[] {
  return [
    ...actions.filter((action) => action.role === "secondary"),
    ...actions.filter((action) => action.role === "primary"),
  ];
}

const { bottom, left, right, top } = BUTTON_SLICE;
const SLICE = `${top} ${right} ${bottom} ${left}`;
const SLICE_WIDTHS = `${slice(top)} ${slice(right)} ${slice(bottom)} ${slice(left)}`;
const FRAME = slice(CARD_SLICE);

// A logical length less a whole-pixel nine-slice edge.
const lessSlice = (length: number, edge: number) => `calc(${units(length)} - ${slice(edge)})`;

// Button content insets: the label's line box 11 below the face's top and above its bottom, 16 in
// from each side, inside the nine-slice edges. Normal faces sit on the lip; pressed and disabled
// faces sink by pressedSink.
const { height, inset, lipHeight, pressedSink, verticalInset } = TEXT_BUTTON;
const BUTTON_SIDE = lessSlice(inset, left);
const buttonY = (offset: number, edge: number) =>
  `calc(var(--ada-button-inset-y) + ${units(offset)} - ${slice(edge)})`;
const NORMAL_PADDING = `${buttonY(0, top)} ${BUTTON_SIDE} ${buttonY(lipHeight, bottom)}`;
const SUNK_PADDING = `${buttonY(pressedSink, top)} ${BUTTON_SIDE} ${buttonY(lipHeight - pressedSink, bottom)}`;

// The story action's press area grows its face by hitAround's margin on each side.
const STORY_HIT = hitMargin(HIT_RULE, {
  height: STORY_BUTTON.height,
  width: STORY_BUTTON.height,
  x: 0,
  y: 0,
});

// Focus: a cream band between ink fringes, FOCUS_RING.outset outside the control (the HTML form
// of ui-focus).
export const FOCUS_STYLE = `
  outline:${units(FOCUS_RING.band)} solid #ead4aa;
  outline-offset:${units(FOCUS_RING.fringe)};
  box-shadow:0 0 0 ${units(FOCUS_RING.fringe)} #181425,0 0 0 ${units(FOCUS_RING.outset)} #181425`;

// The close X's press area relative to the card's top-right corner.
const CLOSE_HIT = CARD_CLOSE.hit;

// The shared card and control styles apply in the controls overlay and on the start screen.
export const UI_SCOPE = ":is(.ada-controls,.ada-start)";

// The shared renderer and existing specialised actions retain their own focus treatment.
export const LEGACY_TEXT_BUTTON = `.ada-button:not(:where(
  .ui-standard-button,.ada-compact,.ada-story-button,.ada-quest-list *,
  [data-station] *,[data-station-confirm] *
))`;
const LEGACY_TEXT_FOCUS = `${UI_SCOPE} ${LEGACY_TEXT_BUTTON}:focus-visible`;
const STANDARD_TEXT_FOCUS = `${UI_SCOPE}
  :is([data-dialog=menu], .ada-quest-footer, [data-dialog=install-steps], [data-dialog=settings],
    .ada-cheats-card, .ada-map-navigation, .ada-ship-back)
  .ada-button.ui-standard-button:not(:where(.ada-compact)):focus-visible`;
const STORY_TEXT_FOCUS = ".ada-controls .ada-story .ada-button:focus-visible";
const ENABLED_TEXT_CONTROL = `:where(
  :not(:disabled,.ada-unavailable,[aria-disabled=true])
)`;
const LEGACY_ENABLED_FOCUS = `${LEGACY_TEXT_FOCUS}${ENABLED_TEXT_CONTROL}`;
const STANDARD_ENABLED_FOCUS = `${STANDARD_TEXT_FOCUS}${ENABLED_TEXT_CONTROL}`;
const STORY_ENABLED_FOCUS = `${STORY_TEXT_FOCUS}${ENABLED_TEXT_CONTROL}`;
const SPECIAL_BUTTON_SHAPES = `
  .ada-exchange-amount,.ada-quest-list [data-quest-id]
`;

/**
 * An open modal's stacking order in its layer: above every HUD and start-screen control there,
 * whatever their document order, so no button draws over an open card. Every other control in
 * the layer stays below it.
 */
export const MODAL_LAYER = 10;

export const MODAL_STYLE = `
/* The dim covers the view; fixed-width cards centre inside the safe game-area rect. */
${UI_SCOPE} .ada-modal{
  position:absolute;
  inset:0;
  z-index:${MODAL_LAYER};
  display:flex;
  align-items:center;
  justify-content:center;
  background:#101926b3;
  pointer-events:auto;
  padding:max(var(${VIEW_PROPERTIES.safe("top")}),
      calc(var(${VIEW_PROPERTIES.areaTop}) + ${units(MODAL_SCREEN_MARGIN)}))
    max(var(${VIEW_PROPERTIES.safe("right")}),calc(
      max(0px,calc(100% - var(${VIEW_PROPERTIES.areaLeft}) - ${units(SCREEN.width)})) + ${units(MODAL_SCREEN_MARGIN)}
    ))
    max(var(${VIEW_PROPERTIES.safe("bottom")}),
      calc(var(${VIEW_PROPERTIES.areaBottom}) + ${units(MODAL_SCREEN_MARGIN)}))
    max(var(${VIEW_PROPERTIES.safe("left")}),
      calc(max(0px,var(${VIEW_PROPERTIES.areaLeft})) + ${units(MODAL_SCREEN_MARGIN)}));
  box-sizing:border-box
}

${UI_SCOPE} .ada-card-frame{
  position:relative;
  max-width:100%;
  max-height:100%;
  min-height:0;
  display:flex;
  flex-direction:column
}

${UI_SCOPE} .ada-card-frame[data-card-size=small]{width:${units(CARD_WIDTH_CAPS.small)}}
${UI_SCOPE} .ada-card-frame[data-card-size=medium]{width:${units(CARD_WIDTH_CAPS.medium)}}
${UI_SCOPE} .ada-card-frame[data-card-size=large]{width:${units(CARD_WIDTH_CAPS.large)}}
${UI_SCOPE} .ada-card-frame[data-card-size] > .ada-card{width:100%}

/* Shared fixed-width card chrome: the header and close X stay fixed while the body scrolls. */
${UI_SCOPE} .ada-card{
  box-sizing:border-box;
  width:max-content;
  max-width:100%;
  max-height:100%;
  min-height:0;
  flex:0 1 auto;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  padding:0 ${lessSlice(CARD_CONTENT.padding, CARD_SLICE)};
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.label};
  background:#3b3850;
  border:${FRAME} solid #6b6685;
  border-radius:0;
  border-image:url('/art/ui/sprites/ui-settings-card.png') ${CARD_SLICE} fill / ${FRAME} stretch;
  image-rendering:pixelated
}

/* The title centres across the card with the close target's clearance reserved on each side. */
${UI_SCOPE} .ada-card header{
  flex:none;
  align-self:stretch;
  box-sizing:border-box;
  margin-top:var(--title-top,${units(CARD_CONTENT.padding)});
  padding:0 ${units(cardTitleReserve(true) - CARD_CONTENT.padding)}
}

/* A page card has no close X, so its title keeps only the padding. */
${UI_SCOPE} .ada-card.ada-page-card header{
  padding:0 ${units(cardTitleReserve(false) - CARD_CONTENT.padding)}
}

/* The scroll group: groups stack a gap apart, each at its own width, centred in the inner width.
   A scrolling body reserves a gap and a track on its right, inside the padding. */
${UI_SCOPE} .ada-card-body{
  flex:0 1 auto;
  min-height:0;
  overflow-x:hidden;
  overflow-y:auto;
  overscroll-behavior:contain;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:${units(CARD_CONTENT.gap)};
  margin-top:var(--body-gap,0);
  scrollbar-color:#9690b4 #2f2d3d
}
${UI_SCOPE} .ada-card-body::-webkit-scrollbar,
${UI_SCOPE} .ada-scroll::-webkit-scrollbar{
  width:${units(SCROLL.gap + SCROLL.track)}
}
${UI_SCOPE} .ada-card-body::-webkit-scrollbar-track,
${UI_SCOPE} .ada-scroll::-webkit-scrollbar-track{
  background:linear-gradient(to right,transparent ${units(SCROLL.gap)},#2f2d3d ${units(SCROLL.gap)})
}
${UI_SCOPE} .ada-card-body::-webkit-scrollbar-thumb,
${UI_SCOPE} .ada-scroll::-webkit-scrollbar-thumb{
  background:#9690b4;
  background-clip:padding-box;
  border:solid transparent;
  border-width:${units(SCROLL.thumbInset)} ${units(SCROLL.thumbInset)} ${units(
    SCROLL.thumbInset,
  )} ${units(SCROLL.gap + SCROLL.thumbInset)}
}

/* The last control keeps the end pad below it at the scroll end: the frame and the last gap
   count toward it. */
${UI_SCOPE} .ada-card-body::after{
  content:"";
  flex:none;
  height:${lessSlice(SCROLL.endPad - CARD_CONTENT.gap, CARD_SLICE)}
}

${UI_SCOPE} .ada-card-body > *{
  flex:none;
  max-width:100%
}

/* A card with a named scroll group scrolls only that group; its other groups stay in view, and
   the body's end pad below its last group counts the frame, as in every card. */
${UI_SCOPE} .ada-card-body.ada-has-scroll{
  overflow-y:hidden
}
${UI_SCOPE} .ada-card-body > .ada-scroll{
  flex:0 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-color:#9690b4 #2f2d3d
}

/* Prose never widens a card: it wraps to the inner width of the card's width family. */
${UI_SCOPE} .ada-prose{
  contain:inline-size;
  align-self:stretch
}

${UI_SCOPE} .ada-card h1,
${UI_SCOPE} .ada-card h2{
  font-size:${units(TYPE.heading.size)};
  line-height:${units(TYPE.heading.lineHeight)};
  text-align:center;
  margin:0;
  font-weight:${TYPE.heading.weight};
  color:${TEXT_TOKENS.title};
  overflow-wrap:anywhere
}

${UI_SCOPE} .ada-card h3{
  margin:0;
  font-size:${units(TYPE.label.size)};
  line-height:${units(TYPE.label.lineHeight)};
  font-weight:${TYPE.label.weight};
  color:${TEXT_TOKENS.title}
}

${UI_SCOPE} .ada-card p{
  margin:0;
  color:${TEXT_TOKENS.supporting}
}

/* The close X: a 24 face closeInset from the card's top and right, in its hitAround target. */
${UI_SCOPE} .ada-close{
  position:absolute;
  top:${units(CLOSE_HIT.y)};
  right:${units(CLOSE_HIT.x)};
  width:${units(CLOSE_HIT.width)};
  height:${units(CLOSE_HIT.height)};
  min-width:0;
  min-height:0;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  display:grid;
  place-items:center;
  isolation:isolate;
  cursor:pointer;
  pointer-events:auto
}
${UI_SCOPE} .ada-close::before{
  content:"";
  width:${units(CARD_CLOSE.art.width)};
  height:${units(CARD_CLOSE.art.height)};
  background:url('/art/ui/sprites/ui-close.png') 0 0 / ${units(2 * CARD_CLOSE.art.width)} ${units(
    CARD_CLOSE.art.height,
  )};
  image-rendering:pixelated
}
${UI_SCOPE} .ada-close:active::before{
  background-position:${units(-CARD_CLOSE.art.width)} 0
}
${modalCloseStyle(`${UI_SCOPE} .ada-close`, {
  face: TEXT_TOKENS.label,
  ink: TEXT_TOKENS.buttonLabel,
})}

/* Buttons: 48 high, a 44 face over a 4 lip; pressed sinks 2; disabled is flat. A wrapped label
   grows the face by a line box per line. */
${UI_SCOPE} .ada-button{
  --ada-button-inset-y:${units(verticalInset)};
  box-sizing:border-box;
  min-width:${units(TEXT_BUTTON.height)};
  height:auto;
  min-height:${units(TEXT_BUTTON.height)};
  margin:0;
  padding:${NORMAL_PADDING};
  display:inline-flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  gap:${units(SPACING.markGap)};
  font:${font(TEXT_BUTTON.label)};
  color:${TEXT_TOKENS.buttonLabel};
  background:${BUTTON_FACE.secondary};
  border-style:solid;
  border-color:${BUTTON_FACE.secondary} ${BUTTON_FACE.secondary} #5f5980;
  border-width:${SLICE_WIDTHS};
  border-radius:0;
  border-image:var(--ui-button-normal) ${SLICE} fill / ${SLICE_WIDTHS};
  image-rendering:pixelated;
  cursor:pointer;
  pointer-events:auto
}
${UI_SCOPE} .ada-button:not(:where(${SPECIAL_BUTTON_SHAPES})){
  width:max-content;
  max-width:100%;
  overflow-wrap:anywhere
}
/* Numeric amount controls and quest list entries keep their purpose-specific geometry. */
${UI_SCOPE} .ada-button:where(${SPECIAL_BUTTON_SHAPES}){
  --ada-button-inset-y:${units((height - lipHeight - TYPE.label.lineHeight) / 2)};
  font:${font(TYPE.label)}
}
${UI_SCOPE} .ada-button.ada-primary{
  background:${BUTTON_FACE.primary};
  border-color:${BUTTON_FACE.primary} ${BUTTON_FACE.primary} #8a7148;
  border-image-source:var(--ui-button-primary-normal)
}
${UI_SCOPE} .ada-button:active:not(:disabled){
  padding:${SUNK_PADDING};
  border-image-source:var(--ui-button-pressed)
}
${UI_SCOPE} .ada-button.ada-primary:active:not(:disabled){
  border-image-source:var(--ui-button-primary-pressed)
}
${UI_SCOPE} .ada-button:disabled{
  padding:${SUNK_PADDING};
  color:${TEXT_TOKENS.disabledLabel};
  background:${BUTTON_FACE.disabled};
  border-color:${BUTTON_FACE.disabled};
  border-image-source:var(--ui-button-disabled);
  cursor:default
}
${UI_SCOPE} .ada-button.ada-primary:disabled{
  border-image-source:var(--ui-button-primary-disabled)
}

/* An unavailable action keeps the disabled face but stays pressable, so it can refuse. */
${UI_SCOPE} .ada-button.ada-unavailable,
${UI_SCOPE} .ada-button.ada-unavailable:active,
${UI_SCOPE} .ada-button[aria-disabled="true"],
${UI_SCOPE} .ada-button[aria-disabled="true"]:active{
  padding:${SUNK_PADDING};
  color:${TEXT_TOKENS.disabledLabel};
  background:${BUTTON_FACE.disabled};
  border-color:${BUTTON_FACE.disabled};
  border-image-source:var(--ui-button-disabled);
  cursor:default
}

${UI_SCOPE} :is(.ada-cheats-card,.ada-map-navigation) .ada-button.ui-standard-button:not(.ada-primary){
  --ui-button-focus-fill:${BUTTON_FACE.secondary}
}

/* Ship Back keeps the existing focus fill on the native button's painted face. */
${UI_SCOPE} .ada-ship-back [data-action=back-ship].ui-standard-button:focus-visible > .ui-button-face{
  background-color:transparent;
  color:inherit;
  forced-color-adjust:inherit
}

/* Tint the centre and retain the existing sprite slices, including the active lip. */
${STANDARD_TEXT_FOCUS},
${STORY_TEXT_FOCUS},
${LEGACY_TEXT_FOCUS}{
  outline:none;
  box-shadow:none
}
${STANDARD_ENABLED_FOCUS},
${STORY_ENABLED_FOCUS},
${LEGACY_ENABLED_FOCUS}{
  --ada-text-focus-face:${TEXT_TOKENS.label};
  --ada-text-focus-ink:${TEXT_TOKENS.buttonLabel};
  color:var(--ada-text-focus-ink);
  background-image:linear-gradient(var(--ada-text-focus-face),var(--ada-text-focus-face));
  background-clip:padding-box;
  border-image-slice:${SLICE}
}
/* A focusable refusal keeps its flat disabled face and gets a label cue. */
${LEGACY_TEXT_FOCUS}:where(.ada-unavailable,[aria-disabled=true]){
  text-decoration:underline;
  text-underline-offset:.15em
}
@media (forced-colors:active){
  ${STANDARD_ENABLED_FOCUS},
  ${STORY_ENABLED_FOCUS},
  ${LEGACY_ENABLED_FOCUS}{
    forced-color-adjust:none;
    --ada-text-focus-face:Highlight;
    --ada-text-focus-ink:HighlightText;
    background-color:ButtonFace
  }
}

/* Equal-width vertical stacks fill their group. Horizontal rows keep each action's width. */
${UI_SCOPE} .ada-actions.ada-stack{
  grid-auto-flow:row;
  grid-template-columns:minmax(0,1fr);
  align-self:stretch;
  width:auto;
  gap:${units(STACK_BUTTON_GAP)}
}
${UI_SCOPE} .ada-actions.ada-stack .ada-button{
  width:100%
}

/* Standard actions wrap with the same horizontal and vertical face gaps as action grids. */
${UI_SCOPE} .ada-actions.ada-wrap{
  display:flex;
  flex-wrap:wrap;
  align-self:stretch;
  width:auto;
  box-sizing:border-box;
  padding:${units(FOCUS_RING.outset)};
  column-gap:${units(BUTTON_GAP)};
  row-gap:${units(STACK_BUTTON_GAP)}
}
${UI_SCOPE} .ada-actions.ada-wrap > .ada-button{
  flex:0 1 auto;
  overflow-wrap:anywhere
}

${UI_SCOPE} .ada-card .ada-card-note{
  text-align:center
}

/* Chibi's pause button: the 35 frame on the HUD rect's top-left corner, in its hitAround press area.
   Its vector art draws with smooth sampling at every scale; ui-pause gives only tags and timing. */
${UI_SCOPE} .ada-pause{
  position:absolute;
  left:${fromHudEdge("left", PAUSE_BUTTON.hit.x)};
  top:${fromHudEdge("top", PAUSE_BUTTON.hit.y)};
  width:${units(PAUSE_BUTTON.hit.width)};
  height:${units(PAUSE_BUTTON.hit.height)};
  min-width:0;
  min-height:0;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  display:grid;
  place-items:center;
  pointer-events:auto;
  touch-action:none
}
${UI_SCOPE} .ada-pause::before{
  content:"";
  width:${units(PAUSE_BUTTON.art.width)};
  height:${units(PAUSE_BUTTON.art.height)};
  --ada-nav-pose:url('${PAUSE_ART.rest}');
  background:var(--ada-nav-pose) center / 100% 100% no-repeat
}
${UI_SCOPE} .ada-pause[data-pose=press]::before{
  --ada-nav-pose:url('${PAUSE_ART.press}')
}
${UI_SCOPE} .ada-pause[data-pose=held]::before{
  --ada-nav-pose:url('${PAUSE_ART.held}')
}

/* A row with one visible button centers independently of its role or native presentation. */
${UI_SCOPE} :is(.ada-actions,[data-footer-action],.ada-ship-back):has(
  > :is(button,.ada-button-presentation):not([hidden])
):not(:has(
  > :is(button,.ada-button-presentation):not([hidden])
  ~ :is(button,.ada-button-presentation):not([hidden])
)){
  align-self:center;justify-content:center;width:max-content;max-width:100%
}

/* Keep each action's own width and centre the group. */
${UI_SCOPE} .ada-actions{
  display:grid;
  grid-auto-columns:minmax(0,max-content);
  justify-content:center;
  grid-auto-flow:column;
  gap:${units(BUTTON_GAP)};
  width:max-content;
  max-width:100%;
  margin:0
}

/* Control rows: measured at their widest label row, then filling the inner width so their notes
   wrap there; rows a row gap apart. */
${UI_SCOPE} .ada-rows{
  display:grid;
  grid-auto-rows:max-content;
  gap:${units(CARD_CONTENT.rowGap)};
  align-self:stretch
}

/* Preserve the story action's press area beyond the drawn face. */
${UI_SCOPE} .ada-button.ada-story-button{
  position:relative
}
${UI_SCOPE} .ada-button.ada-story-button::after{
  content:"";
  position:absolute;
  inset:${units(-STORY_HIT)}
}

/* Control rows: at least 48 high (their text plus a row gap above and below), icon, label and
   action; the whole row is the press target. */
${UI_SCOPE} .ada-row{
  box-sizing:border-box;
  display:flex;
  align-items:flex-start;
  gap:${units(CONTROL_ROW.gap)};
  width:100%;
  min-height:${units(CONTROL_ROW.height)};
  margin:0;
  padding:0;
  font:inherit;
  text-align:left;
  color:${TEXT_TOKENS.label};
  background:transparent;
  border:0;
  border-radius:0;
  cursor:pointer;
  pointer-events:auto
}
${UI_SCOPE} .ada-row[data-ui-placement="center"]{
  align-items:center
}

${UI_SCOPE} .ada-switch{
  flex:none;
  width:${units(CONTROL_ROW.switch.width)};
  height:${units(CONTROL_ROW.switch.height)};
  background:url('/art/ui/sprites/ui-switch.png') 0 0 / ${units(
    2 * CONTROL_ROW.switch.width,
  )} ${units(CONTROL_ROW.switch.height)};
  image-rendering:pixelated
}
${UI_SCOPE} .ada-switch[data-tag=off]{
  background-position:${units(-CONTROL_ROW.switch.width)} 0
}

${UI_SCOPE} .ada-icon{
  flex:none;
  width:${units(CONTROL_ROW.icon)};
  height:${units(CONTROL_ROW.icon)};
  background:center / ${units(CONTROL_ROW.icon)} ${units(CONTROL_ROW.icon)} no-repeat;
  image-rendering:pixelated
}

${UI_SCOPE} .ada-setting-text{
  flex:1;
  display:grid;
  padding:${units(CONTROL_ROW.textInset)} 0;
  overflow-wrap:anywhere
}

/* Supporting text keeps the body size, as in Chibi: it wraps and its row grows instead, and never
   widens the rows. */
${UI_SCOPE} .ada-setting-note{
  contain:inline-size;
  font-size:${units(TYPE.body.size)};
  line-height:${units(TYPE.body.lineHeight)};
  color:${TEXT_TOKENS.supporting}
}

/* Install steps: the row icons, a gap, then the wrapped body text. */
${UI_SCOPE} .ada-steps{
  display:flex;
  align-items:center;
  gap:${units(CONTROL_ROW.gap)};
  margin:0
}

/* Cheats keeps the two approved columns and its Back footer in one compact card. */
${UI_SCOPE} .ada-cheats-card > .ada-card-body{
  gap:${units(SPACING.rowGap)};
  overflow:visible
}
${UI_SCOPE} .ada-cheats-card > .ada-card-body > [data-footer-action=back]{
  margin-block-start:${units(SPACING.rowGap)}
}
${UI_SCOPE} .ada-cheats-card > .ada-card-body::after{
  height:${units(SPACING.rowGap)}
}
${UI_SCOPE} .ada-cheat-items{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:${units(SPACING.columnGap * 2)};
  align-self:stretch
}
${UI_SCOPE} .ada-cheat-column{
  display:grid;
  min-width:0
}
${UI_SCOPE} .ada-cheat-rows{
  display:grid;
  grid-auto-rows:minmax(${units(TEXT_BUTTON.height)},auto);
  gap:${units(SPACING.rowGap)}
}
${UI_SCOPE} .ada-cheat-grants{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:${units(SPACING.columnGap)}
}
${UI_SCOPE} .ada-cheat-rows .ada-button,
${UI_SCOPE} .ada-cheat-rows > .ada-row{
  width:100%
}
${UI_SCOPE} .ada-cheat-resource-icon{
  flex:none;
  width:${units(CHEAT_GRANT_ICON)};
  height:${units(CHEAT_GRANT_ICON)};
  background-size:100% 100%;
  background-repeat:no-repeat
}

${UI_SCOPE} .ada-card .ada-button:focus-visible:not(:where(${LEGACY_TEXT_BUTTON},.ada-story .ada-button)),
${UI_SCOPE} .ada-row:not([role=switch]):focus-visible{${FOCUS_STYLE}
}

${UI_SCOPE} .ada-row[role=switch]:not(:disabled):is(:focus-visible,:active){
  outline:none;
  --ada-switch-cue-ink:${TEXT_TOKENS.buttonLabel};
  --ada-switch-cue-face:${TEXT_TOKENS.label};
  color:var(--ada-switch-cue-ink);
  background:var(--ada-switch-cue-face)
}
${UI_SCOPE} .ada-row[role=switch]:not(:disabled):is(:focus-visible,:active) .ada-setting-note{
  color:inherit
}
${UI_SCOPE} .ada-row[role=switch]:not(:disabled):is(:focus-visible,:active) > .ada-icon{
  filter:brightness(0)
}
@media (forced-colors:active){
  ${UI_SCOPE} .ada-row[role=switch]:not(:disabled):is(:focus-visible,:active) > .ada-icon{
    filter:none
  }
  ${UI_SCOPE} .ada-row[role=switch]:not(:disabled):is(:focus-visible,:active){
    forced-color-adjust:none;
    --ada-switch-cue-ink:HighlightText;
    --ada-switch-cue-face:Highlight
  }
}

${UI_SCOPE} [hidden]{
  display:none!important
}
/* A parent card retained under its child (Settings over Pause or Menu) keeps its card's paint
   but not its own dim: the child's dim alone covers the view, so dims never stack. */
${UI_SCOPE} .ada-modal[data-ada-modal-underlay][hidden]{
  z-index:${MODAL_LAYER - 1};
  display:flex!important;
  background:transparent
}
`;

export interface CardParts {
  // The scroll group: append the card's groups here.
  readonly body: HTMLDivElement;
  readonly card: HTMLElement;
  readonly close: HTMLButtonElement;
  readonly frame: HTMLDivElement;
  readonly header: HTMLElement;
  readonly title: HTMLHeadingElement;
  // Stops refitting the card as the view resizes.
  dispose(): void;
  // Sizes the shown card to its content (src/ui/layout/contentCard.ts); call after its content
  // changes.
  fit(): void;
}

// An element's laid-out size in logical px, independent of the frame turn's transform.
function logicalSize(element: HTMLElement, unit: number): { height: number; width: number } {
  const style = getComputedStyle(element);
  return { height: parseFloat(style.height) / unit, width: parseFloat(style.width) / unit };
}

// Fits a shown card's header within its fixed preset width, balancing its vertical gaps.
// A group's data-ink-top gives the distance from its top to its first visible content.
function fitCard(
  parts: Pick<CardParts, "body" | "card" | "title">,
  close: boolean,
  list: boolean,
): void {
  const { body, card, title } = parts;
  const layer = card.closest<HTMLElement>(".ada-modal, .ada-start");
  if (!layer || card.getClientRects().length === 0) {
    return;
  }
  const unit = readViewUnit(card);
  const groups = [...body.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getClientRects().length > 0,
  );
  const text = title.textContent ?? "";
  const titleHeight = text ? logicalSize(title, unit).height : undefined;
  const first = groups[0];
  const { bodyTop, titleTop } = list
    ? listCardHeader(TYPE.label)
    : cardHeaderLayout(close, first ? Number(first.dataset.inkTop ?? 0) : undefined, titleHeight);
  // Layout measures from the card's outer edge; its content starts inside the frame.
  card.style.setProperty("--title-top", units(titleTop - CARD_CONTENT.frameBorder));
  card.style.setProperty("--body-gap", units(bodyTop - titleTop - (titleHeight ?? 0)));
  const group = body.querySelector<HTMLElement>(":scope > .ada-scroll");
  if (group) {
    reserveScrollbar(group);
  } else if (body.classList.contains(SCROLL_RESERVE_CLASS)) {
    reserveScrollbar(body);
  }
}

// A card body that scrolls as a whole but keeps a group's scroll reserve, as the job list does.
export const SCROLL_RESERVE_CLASS = "ada-scroll-reserve";

/**
 * While group scrolls, it keeps the scroll reserve (SCROLL.gap + SCROLL.track, 14) on its right in
 * every browser: right padding makes up whatever the browser's own scrollbar leaves of it, so its
 * rows keep one width whether that scrollbar is drawn, thin or hidden. Call it after the group's
 * height can change.
 */
export function reserveScrollbar(group: HTMLElement): void {
  group.style.removeProperty("padding-right");
  group.classList.remove("ada-scrolls");
  if (group.scrollHeight <= group.clientHeight + 1) {
    return;
  }
  const unit = readViewUnit(group);
  const style = getComputedStyle(group);
  const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const bar = Math.max(0, group.offsetWidth - group.clientWidth - border) / unit;
  const padding = parseFloat(style.paddingRight) / unit;
  group.classList.add("ada-scrolls");
  group.style.paddingRight = units(padding + Math.max(0, SCROLL.gap + SCROLL.track - bar));
}

// A card in its frame, with its title and scrolling body: a dialog with its close X, or a page
// card (the start screen) with its title as the page heading and no close X. Show or hide it
// through frame.hidden.
export function createCard(
  options:
    | {
        readonly closeAction: string;
        readonly closeLabel: string;
        readonly fontRole?: string;
        /** Fixed preset width, clamped to the modal game-area rect. */
        readonly size?: CardSize;
        /** Chibi's list header (listCardHeader), for a card whose body opens with a list. */
        readonly list?: boolean;
        readonly title: string;
      }
    | { readonly fontRole?: string; readonly page: true; readonly title: string },
): CardParts {
  const page = "page" in options;
  const frame = document.createElement("div");
  frame.className = "ada-card-frame";
  const size = !page ? (options.size ?? "medium") : "medium";
  frame.dataset.cardSize = size;
  const card = document.createElement("section");
  card.className = page ? "ada-card ada-page-card" : "ada-card";
  if (!page) {
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
  }
  frame.setAttribute("aria-label", options.title);
  const header = document.createElement("header");
  const title = document.createElement(page ? "h1" : "h2");
  title.textContent = options.title;
  if (options.fontRole) {
    title.dataset.fontRole = options.fontRole;
  }
  header.append(title);
  const body = document.createElement("div");
  body.className = "ada-card-body";
  card.append(header, body);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  if (page) {
    frame.append(card);
  } else {
    close.dataset.action = options.closeAction;
    close.setAttribute("aria-label", options.closeLabel);
    frame.append(card, close);
  }
  const list = !("page" in options) && options.list === true;
  const fit = () => fitCard({ body, card, title }, !page, list);
  // Keyboard focus scrolls the focused control fully into view, its focus ring included.
  body.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLElement) {
      event.target.style.scrollMargin = units(FOCUS_RING.outset);
      event.target.scrollIntoView({ block: "nearest" });
    }
  });
  window.addEventListener("resize", fit);
  window.addEventListener(VIEW_SCALE_EVENT, fit);
  return {
    body,
    card,
    close,
    dispose: () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener(VIEW_SCALE_EVENT, fit);
    },
    fit,
    frame,
    header,
    title,
  };
}

// Makes group the card's scroll group: only it scrolls when the card is taller than its rect.
export function setScrollGroup(parts: Pick<CardParts, "body">, group: HTMLElement): void {
  for (const other of parts.body.querySelectorAll(".ada-scroll")) {
    other.classList.remove("ada-scroll");
  }
  group.classList.add("ada-scroll");
  parts.body.classList.add("ada-has-scroll");
}

// Whether a press that began at from and ended at to is a tap: it moved no further than the
// scroll drag threshold, in logical px at unit CSS px each.
export function isTap(
  unit: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= SCROLL.dragThreshold * unit;
}

// A control row's parts, left to right, as in Chibi: icon, label (with any note) and switch.
export const SWITCH_ROW_PARTS = ["icon", "text", "switch"] as const;

export type SwitchTag = "off" | "on";

// The ui-switch tag and ARIA state a row shows for its setting.
export function switchState(on: boolean): {
  readonly ariaChecked: string;
  readonly tag: SwitchTag;
} {
  return { ariaChecked: String(on), tag: on ? "on" : "off" };
}

// A control row: one switch button at least a control row high holding icon, label, optional note and switch, so the
// whole row is the press target. show sets its state.
export function createSwitchRow(options: {
  readonly align?: "top" | "center";
  readonly icon: HTMLElement;
  readonly id: string;
  readonly label: string;
  readonly note?: string | undefined;
}): { readonly row: HTMLButtonElement; show(on: boolean): void } {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ada-row";
  setControlPlacement(options.align ?? "top", row);
  row.setAttribute("role", "switch");
  row.setAttribute("aria-label", options.label);
  const text = document.createElement("span");
  text.className = "ada-setting-text";
  const caption = document.createElement("span");
  caption.textContent = options.label;
  text.append(caption);
  if (options.note) {
    const note = document.createElement("span");
    note.className = "ada-setting-note";
    note.id = `ada-note-${options.id}`;
    note.textContent = options.note;
    text.append(note);
    row.setAttribute("aria-describedby", note.id);
  }
  const toggle = document.createElement("span");
  toggle.className = "ada-switch";
  toggle.setAttribute("aria-hidden", "true");
  const parts = { icon: options.icon, switch: toggle, text };
  row.append(...SWITCH_ROW_PARTS.map((part) => parts[part]));
  return {
    row,
    show(on) {
      const state = switchState(on);
      row.setAttribute("aria-checked", state.ariaChecked);
      toggle.dataset.tag = state.tag;
    },
  };
}

export function createButton(label: string, role: ButtonRole = "secondary"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = role === "primary" ? "ada-button ada-primary" : "ada-button";
  button.textContent = label;
  return button;
}

// An action group of one shared width, secondary actions left of primary ones.
/** Footer intent is explicit and independent of translated labels or entry context. */
export function setFooterAction(action: "back" | "close", footer: HTMLElement): void {
  footer.dataset.footerAction = action;
  setControlPlacement("footer", footer);
}

export function createActions(
  buttons: readonly { readonly button: HTMLButtonElement; readonly role: ButtonRole }[],
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "ada-actions";
  row.dataset.inkTop = "0";
  row.append(...actionOrder(buttons).map(({ button }) => button));
  return row;
}
