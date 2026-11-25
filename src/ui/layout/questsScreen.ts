import { BUTTON_SLICE, FRAME_LINE, MAP_SCREEN_LAYOUT, TYPE } from "../../data/layout.ts";
import { TEXT_TOKENS } from "../modal.ts";
import { COLOURS, UNLISTED_COLOURS } from "./colours.ts";
import { NARROW_VIEWPORT, pixels, slice, units } from "./css.ts";
import { BUTTON_GAP, SPACING } from "./tokens.ts";

/** Approved quest card geometry, in logical pixels. */
export const QUEST_ROUTE_ARROW = {
  head: "M10 0L18 6L10 12Z",
  height: 12,
  shaft: "M0 5H10V7H0Z",
  viewBox: "0 0 18 12",
  width: 18,
} as const;

export const QUEST_LIST_PAGE_SIZE = 2;

/** A quest icon's drawn disc. */
export const QUEST_ICON = 24;

const QUEST_ROUTE_TYPE = { lineHeight: 18, size: 14 } as const;
// On smaller views, scale the endpoint with its route up to the shared 48px button minimum.
const QUEST_ENDPOINT_MIN_HEIGHT = 48;
// The endpoint's corner radius in CSS px, which rounds its focus and press face.
const QUEST_ENDPOINT_RADIUS = 8;
// An unavailable endpoint's keyboard focus: a white outline this wide and this far out, in CSS px.
const QUEST_ENDPOINT_UNAVAILABLE_FOCUS = { offset: 3, width: 3 } as const;

// The quest detail: two columns (objective, reward) split by a rule inset from the top and
// bottom, the route row's arrow column and its padding on a NARROW_VIEWPORT, and the quest disc's
// padding.
const QUEST_DETAIL = {
  arrowColumn: 46,
  columnGap: 16,
  compactRoutePadding: 7,
  iconPadding: 2,
  ruleInset: 6,
  width: 640,
} as const;

const { chip, inset, markGap } = MAP_SCREEN_LAYOUT.quests;

// A requirement line's indicator to text gap and its space above.
const REQ = { gap: units(SPACING.markGap), top: units(SPACING.rowGap) } as const;

export const QUESTS_SCREEN_STYLE = `
.ada-controls .ada-quest-content{position:relative;
  flex:1;
  min-height:0;
  display:grid;
  width:${units(QUEST_DETAIL.width)};
  box-sizing:border-box;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  grid-template-rows:auto auto;
  align-content:start;
  gap:${units(SPACING.gap)} ${units(QUEST_DETAIL.columnGap)};
  padding:${units(SPACING.rowGap)} ${units(SPACING.gap)} ${units(SPACING.gap)};
  background:${UNLISTED_COLOURS.panelFace};
  border:${pixels(FRAME_LINE)} solid ${UNLISTED_COLOURS.questDetailEdge}}
.ada-controls .ada-quest-content::before{content:"";
  position:absolute;
  left:50%;
  top:${units(QUEST_DETAIL.ruleInset)};
  bottom:${units(QUEST_DETAIL.ruleInset)};
  width:${pixels(FRAME_LINE)};
  background:${UNLISTED_COLOURS.questDetailEdge}}
.ada-controls .ada-quest-content section{min-width:0}
.ada-controls .ada-quest-objective{grid-row:1 / span 2}
.ada-controls .ada-quest-reward{grid-column:2}
.ada-controls .ada-quest-content h3,.ada-controls .ada-quest-content p{font:inherit;
  margin:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-content h3{color:${COLOURS.supporting};
  font-weight:bold;
  margin-bottom:${units(SPACING.rowGap)}}
.ada-controls .ada-quest-description{margin-top:${units(SPACING.gap)}!important;
  color:${COLOURS.rowSupporting}}
.ada-controls .ada-quest-route{display:grid;
  font-size:${units(QUEST_ROUTE_TYPE.size)};
  line-height:${units(QUEST_ROUTE_TYPE.lineHeight)};
  grid-template-columns:minmax(0,1fr) ${units(QUEST_DETAIL.arrowColumn)} minmax(0,1fr);
  gap:${units(SPACING.rowGap)};
  align-items:center;
  margin-top:${units(SPACING.gap)};
  padding:${units(SPACING.gap)};
  background:${COLOURS.navy};
  border:${pixels(FRAME_LINE)} solid ${UNLISTED_COLOURS.questRouteEdge}}
@media ${NARROW_VIEWPORT}{
  .ada-controls .ada-quest-route{padding-block:${units(QUEST_DETAIL.compactRoutePadding)}}
}
.ada-controls .ada-quest-endpoint{display:flex;
  align-items:center;
  gap:${units(SPACING.rowGap)};
  min-width:0;
  min-height:min(${pixels(QUEST_ENDPOINT_MIN_HEIGHT)}, ${units(QUEST_ENDPOINT_MIN_HEIGHT)});
  color:inherit;
  font:inherit;
  text-align:left;
  background:none;
  border:0;
  border-radius:${pixels(QUEST_ENDPOINT_RADIUS)};
  padding:0;
  cursor:pointer;
  pointer-events:auto}
.ada-controls .ada-quest-endpoint:is(:disabled,[aria-disabled=true]){opacity:1;
  cursor:default}
.ada-controls .ada-quest-endpoint:is(:disabled,[aria-disabled=true]):focus-visible{
  outline:${pixels(QUEST_ENDPOINT_UNAVAILABLE_FOCUS.width)} solid ${COLOURS.white};
  outline-offset:${pixels(QUEST_ENDPOINT_UNAVAILABLE_FOCUS.offset)}
}
.ada-controls .ada-quest-endpoint:not(:disabled,[aria-disabled=true]):is(:focus-visible,:active){
  outline:none;
  --ada-endpoint-cue-ink:${TEXT_TOKENS.buttonLabel};
  --ada-endpoint-cue-face:${TEXT_TOKENS.label};
  color:var(--ada-endpoint-cue-ink);
  background:var(--ada-endpoint-cue-face)
}
.ada-controls .ada-quest-endpoint:not(:disabled,[aria-disabled=true]):is(:focus-visible,:active) small{
  color:inherit
}
@media (forced-colors:active){
  .ada-controls .ada-quest-endpoint:not(:disabled,[aria-disabled=true]):is(:focus-visible,:active){
    forced-color-adjust:none;
    --ada-endpoint-cue-ink:HighlightText;
    --ada-endpoint-cue-face:Highlight
  }
}
.ada-controls .ada-quest-endpoint>span{min-width:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-endpoint small{display:block;
  font:inherit;
  color:${COLOURS.supporting}}
.ada-controls .ada-quest-icon{display:block;
  flex-shrink:0;
  width:${units(QUEST_ICON)};
  height:${units(QUEST_ICON)};
  padding:${units(QUEST_DETAIL.iconPadding)};
  border-radius:50%;
  object-fit:contain;
  image-rendering:pixelated}
.ada-controls .ada-quest-arrow{display:block;
  width:${units(QUEST_ROUTE_ARROW.width)};
  height:${units(QUEST_ROUTE_ARROW.height)};
  margin:auto}
/* The footer pattern: secondary actions and the page count from the left edge, the primary
   dismissal on the right edge, neighbouring faces BUTTON_GAP apart. */
.ada-controls .ada-quest-footer{display:flex;
  align-self:stretch;
  justify-content:flex-end;
  gap:${units(BUTTON_GAP)};
  flex:none}
.ada-controls .ada-quest-footer > .ada-button.ada-primary{
  margin-left:auto
}
.ada-controls .ada-quest-list{align-self:stretch;
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:${units(SPACING.gap)};
  overflow:visible}
.ada-controls .ada-quest-list .ada-button{display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:${units(markGap)};
  white-space:normal;
  text-align:left;
  flex:none}
/* The Kit's label inherits the row layout, including when the text wraps. */
.ada-controls .ada-quest-list [data-quest-id]>.ui-control-label{
  min-width:auto;
  text-align:inherit;
  overflow-wrap:inherit
}
.ada-controls .ada-quests-screen .ada-quest-list .ada-button[data-quest-id]{
  padding-inline:calc(${units(inset)} - ${slice(BUTTON_SLICE.left)})}
/* The disc fits the chip slot and contributes one label line to the row height. */
.ada-controls .ada-quest-list .ada-button>.ada-quest-icon{
  margin:${units((TYPE.label.lineHeight - QUEST_ICON) / 2)} ${units((chip - QUEST_ICON) / 2)}}
.ada-controls .ada-quest-requirement{display:flex;align-items:center;gap:${REQ.gap};margin-top:${REQ.top}}
.ada-controls .ada-quest-requirement>span:not(.ada-completion){min-width:0;overflow-wrap:anywhere}
.ada-controls .ada-quest-requirement>strong{margin-left:auto;white-space:nowrap}
.ada-controls .ada-quest-list h3{font:inherit;margin:0;color:${COLOURS.supporting}}
.ada-controls .ada-quests-screen .ada-card header h2{color:${COLOURS.cream}}
.ada-controls .ada-quest-content p{color:${COLOURS.cream}}
.ada-controls .ada-quest-objective>p:first-of-type,.ada-controls .ada-quest-reward p{font-weight:bold}
.ada-controls .ada-quest-objective .ada-quest-description{color:${COLOURS.rowSupporting}}
`;
