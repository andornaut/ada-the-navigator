import { BUTTON_FACE, TEXT_TOKENS, UI_SCOPE } from "../modal.ts";
import { FOCUS_RING } from "./controls.ts";
import { font, units } from "./css.ts";
import { SPACING, TYPE } from "./tokens.ts";

/** Ship geometry uses the shared card and text roles, in logical px. */
export const SHIP_CARD = {
  icon: TYPE.body.lineHeight,
  row: TYPE.body.lineHeight,
} as const;

export const SHIP_CARD_STYLE = `
${UI_SCOPE} .ada-ship-sections{
  width:100%;
  max-width:100%;
  flex:none;
  align-items:stretch
}
${UI_SCOPE} .ada-ship-section{
  display:flex;
  flex-direction:column;
  gap:${units(SPACING.gap)};
  min-width:0;
  margin:0
}
${UI_SCOPE} .ada-ship-section h3{
  margin:0;
  overflow-wrap:anywhere;
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)};
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-grid{
  display:grid;
  row-gap:${units(SPACING.rowGap)};
  min-width:0;
  align-content:start
}
${UI_SCOPE} .ada-ship-row{
  display:flex;
  align-items:flex-start;
  gap:${units(SPACING.markGap)};
  min-width:0;
  min-height:${units(SHIP_CARD.row)};
  padding:0;
  border:0;
  background:transparent;
  margin:0;
  text-align:left;
  font:${font(TYPE.body)};
  line-height:${units(SHIP_CARD.row)};
  color:${TEXT_TOKENS.label};
  cursor:pointer
}
/* Keep the inventory's scroll gutter and column positions. */
${UI_SCOPE} .ada-card[data-dialog=ship] > .ada-card-body{
  margin-inline:${units(-FOCUS_RING.outset)};
  padding-inline:${units(FOCUS_RING.outset)}
}
${UI_SCOPE} .ada-ship-row:focus-visible{
  outline:none;
  box-shadow:none
}
/* Paint the text area in place so the icon stays on its authored background. */
${UI_SCOPE} .ada-ship-row:not(:disabled):is(:focus-visible,:active) .ada-ship-text{
  background-color:${TEXT_TOKENS.label};
  color:${TEXT_TOKENS.buttonLabel}
}
${UI_SCOPE} .ada-ship-row:not(:disabled):active .ada-ship-text{
  background-color:${BUTTON_FACE.primary}
}
@media (forced-colors: active){
  ${UI_SCOPE} .ada-ship-row:not(:disabled):is(:focus-visible,:active) .ada-ship-text{
    forced-color-adjust:none;
    background-color:Highlight;
    color:HighlightText
  }
}
${UI_SCOPE} .ada-ship-icon{
  flex:none;
  width:${units(SHIP_CARD.icon)};
  height:${units(SHIP_CARD.icon)};
  image-rendering:pixelated
}
${UI_SCOPE} .ada-ship-text{
  display:flex;
  flex:1;
  flex-wrap:wrap;
  gap:0 ${units(SPACING.markGap)};
  min-width:0
}
${UI_SCOPE} .ada-ship-label{
  flex:1 1 auto;
  min-width:0;
  overflow-wrap:anywhere
}
${UI_SCOPE} .ada-ship-count,
${UI_SCOPE} .ada-ship-ammo{
  min-width:0;
  max-width:100%;
  overflow-wrap:anywhere;
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)}
}
`;
