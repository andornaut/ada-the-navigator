import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { BUTTON_FACE, TEXT_TOKENS } from "../modal.ts";
import { buttonProperty } from "../uiSkin.ts";
import { COLOURS, UNLISTED_COLOURS } from "./colours.ts";
import { CARD_WIDTH_CAPS } from "./contentCard.ts";
import { BUTTON_SLICE, FOCUS_RING, FRAME_LINE, PILL, TEXT_BUTTON } from "./controls.ts";
import { font, slice, units } from "./css.ts";
import { BALANCE, CONFIRM_ITEM, SHOP_ROW } from "./shopCard.ts";
import { BUTTON_GAP, SPACING, TYPE } from "./tokens.ts";

const { bottom, left, right, top } = BUTTON_SLICE;
const TILE_SLICE = `${top} ${right} ${bottom} ${left}`;
const TILE_WIDTHS = `${slice(top)} ${slice(right)} ${slice(bottom)} ${slice(left)}`;
const ROW_SIDE = `calc(${units(SHOP_ROW.inset)} - ${slice(left)})`;
// The row's content centres on each state's face: the normal face over the lip, the pressed face
// sunk into it, the disabled face over the full height.
const NORMAL_BOTTOM = `calc(${units(TEXT_BUTTON.lipHeight)} + ${slice(top)} - ${slice(bottom)})`;
const PRESSED_BOTTOM = `calc(${units(TEXT_BUTTON.lipHeight - TEXT_BUTTON.pressedSink)} + ${slice(
  top,
)} - ${slice(bottom)})`;
const FLAT_TOP = `calc(${slice(bottom)} - ${slice(top)})`;
const TILE_ROW = ".ada-controls .ada-shop-row";
const TILE_FACE = `${TILE_ROW}:is([data-state=inUse],:focus-visible):where(
  :not(:active),[data-state=unaffordable]
)`;
// The station footer's current page stripe along its bottom edge, at rest and with keyboard focus.
const CURRENT_PAGE_STRIPE = { focused: 8, rest: 6 } as const;
// A glyph size at the well's scale: 1 in rows, CONFIRM_ITEM.glyphScale in the confirm.
const scaled = (size: number) => `calc(${units(size)} * var(--glyph-scale,1))`;

export const STATION_STYLE = `
.ada-controls [data-station] > .ada-card-frame,
.ada-controls .ada-dialogue-frame.ada-station-frame{
  position:relative;
  inset:auto;
  height:100%;
  max-height:100%
}
.ada-controls .ada-dialogue-frame.ada-station-frame{
  width:min(100%,${units(CARD_WIDTH_CAPS.large)});
  pointer-events:auto
}
.ada-controls [data-station] .ada-station-page{
  height:100%;
  min-height:0
}
.ada-controls [data-station] .ada-station-page > .ada-card-body{
  flex:1
}
.ada-controls .ada-station-frame > .ada-story-panel.ada-station-page{
  position:static;
  transform:none;
  width:100%;
  max-height:100%;
  padding:${units(SPACING.panelPadding + TYPE.label.lineHeight + SPACING.gap)}
    ${units(SPACING.panelPadding)} 0;
  flex-direction:column;
  gap:${units(SPACING.gap)}
}
.ada-controls .ada-station-frame .ada-story-choice-column{
  display:none
}
.ada-controls .ada-station-frame .ada-story-heading{
  text-align:center
}
.ada-controls .ada-station-balances{
  position:absolute;
  top:${units(SPACING.panelPadding)};
  left:${units(SPACING.panelPadding)};
  display:flex;
  gap:${units(SPACING.gap)};
  font:${font(TYPE.label)}
}
.ada-controls .ada-station-balances > span{
  display:flex;
  align-items:center;
  gap:${units(BALANCE.markGap)}
}
.ada-controls .ada-station-balances > span::before{
  content:"";
  width:${units(BALANCE.icon)};
  height:${units(BALANCE.icon)};
  background:url('${uiIconUrl("icon-stardust-20")}') center / 100% 100% no-repeat
}
.ada-controls .ada-station-balances [data-balance=ore]::before{
  background-image:url('${uiIconUrl("icon-ore-20")}')
}
/* The footer pattern: service buttons from the left edge and primary Undock on the right edge,
   neighbouring faces BUTTON_GAP apart. */
.ada-controls .ada-station-footer{
  display:flex;
  flex:none;
  align-items:center;
  gap:${units(BUTTON_GAP)};
  padding:${units(SPACING.gap)} 0;
  border-top:${units(FRAME_LINE)} solid ${COLOURS.cardRim};
  margin-top:auto
}
.ada-controls .ada-station-footer [data-action=undock]{
  margin-left:auto
}
/* Station text actions already paint focus on the native button face. */
.ada-controls :is(.ada-station-footer,[data-station-confirm])
  :is([data-action=open-shop],[data-action=open-jobs],[data-action=open-exchange],
    [data-action=undock],[data-action=confirm-cancel],[data-action=confirm-buy]):focus-visible
  > .ui-button-face{
  background-color:transparent;
  color:inherit;
  forced-color-adjust:inherit
}
/* Keyboard focus tints the face while keeping the ordinary button slices. */
.ada-controls .ada-station-footer .ada-button:focus-visible{
  outline:none;
  box-shadow:none
}
.ada-controls .ada-station-footer .ada-button:focus-visible:where(:not(:disabled,[aria-disabled=true])){
  --ada-station-footer-face:${TEXT_TOKENS.label};
  --ada-station-footer-ink:${TEXT_TOKENS.buttonLabel};
  color:var(--ada-station-footer-ink);
  background-image:linear-gradient(var(--ada-station-footer-face),var(--ada-station-footer-face));
  background-clip:padding-box;
  border-image-slice:${TILE_SLICE}
}
/* The current page has a flat face and a single stripe along its bottom edge. */
.ada-controls .ada-station-footer .ada-button[aria-current=page]:where(:not(:disabled,[aria-disabled=true])){
  --ada-station-footer-face:${BUTTON_FACE.disabled};
  --ada-station-footer-ink:${TEXT_TOKENS.label};
  --ada-station-footer-underline:${BUTTON_FACE.primary};
  --ada-station-footer-underline-height:${units(CURRENT_PAGE_STRIPE.rest)};
  color:var(--ada-station-footer-ink);
  border-color:transparent;
  border-image-source:none;
  background:linear-gradient(var(--ada-station-footer-underline),var(--ada-station-footer-underline))
    left bottom / 100% var(--ada-station-footer-underline-height) no-repeat var(--ada-station-footer-face);
  background-origin:border-box
}
.ada-controls .ada-station-footer .ada-button[aria-current=page]:focus-visible{
  --ada-station-footer-underline:${TEXT_TOKENS.label};
  --ada-station-footer-underline-height:${units(CURRENT_PAGE_STRIPE.focused)}
}
@media (forced-colors:active){
  .ada-controls .ada-station-footer .ada-button:is(
    [aria-current=page],:focus-visible
  ):where(:not(:disabled,[aria-disabled=true])){
    forced-color-adjust:none
  }
  .ada-controls .ada-station-footer .ada-button:focus-visible{
    --ada-station-footer-face:Highlight;
    --ada-station-footer-ink:HighlightText
  }
  .ada-controls .ada-station-footer .ada-button[aria-current=page]{
    --ada-station-footer-face:ButtonFace;
    --ada-station-footer-ink:ButtonText;
    --ada-station-footer-underline:Highlight
  }
  .ada-controls .ada-station-footer .ada-button[aria-current=page]:focus-visible{
    --ada-station-footer-face:Highlight;
    --ada-station-footer-ink:HighlightText;
    --ada-station-footer-underline:HighlightText
  }
}
.ada-controls .ada-card-body[data-shop-stock]{
  overflow:hidden
}
.ada-controls .ada-card-body[data-shop-stock] h3{
  color:${TEXT_TOKENS.label}
}
.ada-controls .ada-card-body > .ada-station-panes{
  flex:1;
  min-height:0;
  width:100%;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  grid-template-rows:minmax(0,1fr);
  align-items:stretch;
  gap:${units(SPACING.gap)}
}
.ada-controls .ada-station-panes h3{
  margin:0 0 ${units(SPACING.gap)};
  font:${font(TYPE.label)}
}
.ada-controls .ada-station-pane-hint{
  display:inline-flex;
  align-items:center;
  margin-inline-start:${units(BALANCE.markGap)};
  font:${font({ ...TYPE.count, weight: TYPE.body.weight })};
  color:${TEXT_TOKENS.rowSupporting};
  white-space:nowrap
}
.ada-controls .ada-station-pane-hint::before{
  content:"("
}
.ada-controls .ada-station-pane-hint::after{
  content:")";
  padding-inline-start:${units(TYPE.count.size + SPACING.rowGap)};
  background:url('${uiIconUrl("icon-stardust-20")}') ${units(SPACING.rowGap)} center /
    ${units(TYPE.count.size)} ${units(TYPE.count.size)} no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-station-panes > section{
  min-width:0
}
.ada-controls .ada-station-panes > section + section{
  border-left:${units(FRAME_LINE)} solid ${COLOURS.cardRim};
  padding-left:${units(SPACING.gap)}
}
.ada-controls .ada-station-panes .ada-shop-row{
  width:100%;
  height:${units(SHOP_ROW.height - SPACING.gap)};
  min-height:0
}
.ada-controls .ada-station-panes .ada-shop-name{
  line-height:${units(TYPE.body.lineHeight - SPACING.rowGap)};
  overflow-wrap:normal
}
.ada-controls .ada-station-panes .ada-shop-name > span{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap
}
/* Locked ammo keeps its pack size and requirement together beneath its name. */
.ada-controls [data-shop-stock] .ada-shop-row:disabled .ada-shop-name{
  grid-template-columns:max-content minmax(0,1fr);
  column-gap:${units(SPACING.markGap)}
}
.ada-controls [data-shop-stock] .ada-shop-row:disabled .ada-shop-name > :first-child{
  grid-column:1/-1
}
.ada-controls .ada-job-list .ada-shop-row .ada-well,
.ada-controls .ada-station-projects .ada-shop-row .ada-well{
  border-color:var(--station-task-accent)
}
.ada-controls .ada-station-panes .ada-well{
  width:${units(SHOP_ROW.well - SPACING.rowGap)};
  height:${units(SHOP_ROW.well - SPACING.rowGap)}
}

.ada-controls .ada-dialogue-panel[data-dialog="station"] .ada-story-tab{
  width:fit-content;
  max-width:100%;
  height:auto;
  white-space:normal;
  overflow-wrap:anywhere
}

.ada-controls .ada-exchange{
  display:grid;
  gap:${units(SPACING.gap)};
  max-width:100%;
  text-align:left
}
.ada-controls .ada-exchange-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:center;
  column-gap:${units(BUTTON_GAP)};
  padding-inline:${units(SPACING.gap)} ${units(BUTTON_GAP)};
  background:${UNLISTED_COLOURS.panelFace};
  border:${slice(FRAME_LINE)} solid ${UNLISTED_COLOURS.exchangeRowEdge}
}
.ada-controls .ada-exchange-row h3{
  margin:0;
  font:${font(TYPE.label)}
}
.ada-controls .ada-exchange-rate{
  font:${font(TYPE.body)};
  text-align:end
}
.ada-controls .ada-exchange-rate-visual{
  display:inline-flex;
  flex-wrap:wrap;
  align-items:center;
  column-gap:${units(BALANCE.markGap)}
}
.ada-controls .ada-exchange-amount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:${units(BALANCE.markGap)}
}
.ada-controls .ada-exchange .ada-button.ada-exchange-amount[aria-disabled="true"]{
  color:${TEXT_TOKENS.label};
  background:${UNLISTED_COLOURS.unavailableFace};
  border-color:${UNLISTED_COLOURS.unavailableFace};
  border-image-source:none
}
.ada-controls .ada-exchange .ada-button.ada-exchange-amount:focus-visible{
  --ada-exchange-focus-face:${TEXT_TOKENS.label};
  color:${TEXT_TOKENS.buttonLabel};
  background-image:linear-gradient(var(--ada-exchange-focus-face),var(--ada-exchange-focus-face)),none;
  background-clip:padding-box,border-box;
  border-image-slice:${TILE_SLICE};
  outline:none;
  box-shadow:none
}
.ada-controls .ada-exchange .ada-button.ada-exchange-amount[aria-disabled="true"]:focus-visible{
  color:${TEXT_TOKENS.title};
  background:${COLOURS.secondaryLip};
  border-color:transparent
}
@media (forced-colors:active){
  .ada-controls .ada-exchange .ada-button.ada-exchange-amount[aria-disabled="true"]:not(:focus-visible){
    color:GrayText;
    background:ButtonFace;
    border-color:ButtonFace
  }
  .ada-controls .ada-exchange .ada-button.ada-exchange-amount:focus-visible{
    forced-color-adjust:none;
    --ada-exchange-focus-face:Highlight;
    color:HighlightText;
    background-color:ButtonFace
  }
  .ada-controls .ada-exchange .ada-button.ada-exchange-amount[aria-disabled="true"]:focus-visible{
    color:ButtonText;
    background:color-mix(in srgb,ButtonFace 75%,ButtonText)
  }
}
.ada-controls .ada-exchange-icon{
  width:${units(BALANCE.icon)};
  height:${units(BALANCE.icon)};
  flex:none;
  image-rendering:pixelated
}
.ada-controls .ada-exchange p{
  overflow-wrap:anywhere
}

.ada-controls .ada-balance,
.ada-controls .ada-confirm-price,
.ada-controls .ada-confirm-stardust-amount{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:${units(BALANCE.markGap)};
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.label}
}
.ada-controls .ada-balance{
  height:${units(BALANCE.line)}
}
.ada-controls .ada-confirm-price{
  font:${font(CONFIRM_ITEM.price.text)}
}
.ada-controls .ada-balance::before,
.ada-controls .ada-confirm-price::before,
.ada-controls .ada-confirm-stardust-amount::after{
  content:"";
  flex:none;
  width:${units(BALANCE.icon)};
  height:${units(BALANCE.icon)};
  background:url('${uiIconUrl("icon-stardust-20")}') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

.ada-controls .ada-confirm-stardust-spoken,
.ada-controls .ada-exchange-rate-spoken,
.ada-controls .ada-exchange [data-exchange-affordability]{
  position:absolute;
  white-space:nowrap;
  clip-path:inset(50%)
}

.ada-controls .ada-card .ada-confirm-about{
  color:${TEXT_TOKENS.label}
}

/* An item row: a ui-button-tile at the action height; the whole row is one control. */
.ada-controls .ada-shop-row{
  position:relative;
  box-sizing:border-box;
  width:max-content;
  height:${units(SHOP_ROW.height)};
  min-width:0;
  min-height:${units(SHOP_ROW.height)};
  margin:0;
  padding:0 ${ROW_SIDE} ${NORMAL_BOTTOM};
  display:flex;
  align-items:center;
  gap:${units(SHOP_ROW.nameGap)};
  font:${font(TYPE.body)};
  text-align:left;
  color:${TEXT_TOKENS.label};
  background:${COLOURS.tileFace};
  border-style:solid;
  border-color:${COLOURS.tileFace} ${COLOURS.tileFace} ${COLOURS.disabledFace};
  border-width:${TILE_WIDTHS};
  border-radius:0;
  border-image:var(${buttonProperty("ui-button-tile", "normal")}) ${TILE_SLICE} fill / ${TILE_WIDTHS};
  image-rendering:pixelated;
  cursor:pointer;
  pointer-events:auto;
  scroll-margin:${units(FOCUS_RING.outset)}
}
.ada-controls .ada-shop-row:disabled{
  opacity:0.5
}
.ada-controls .ada-shop-row:active:not([data-state=unaffordable]){
  padding:${units(TEXT_BUTTON.pressedSink)} ${ROW_SIDE} ${PRESSED_BOTTOM};
  border-image-source:var(${buttonProperty("ui-button-tile", "pressed")})
}
/* Unaffordable: the flat disabled frame over the full height, still focusable and pressable. */
.ada-controls .ada-shop-row[data-state=unaffordable]{
  padding:${FLAT_TOP} ${ROW_SIDE} 0;
  color:${TEXT_TOKENS.rowDisabled};
  background:${COLOURS.disabledFace};
  border-color:${COLOURS.disabledFace};
  border-image-source:var(${buttonProperty("ui-button-tile", "disabled")});
  cursor:default
}
/* Colour the face for focus, a held job or installed paint. Keep the tile's edges, lip and pressed art. */
${TILE_ROW}[data-state=inUse]{
  --ada-tile-state-face:${COLOURS.navy};
  --ada-tile-state-ink:${TEXT_TOKENS.label}
}
${TILE_ROW}:focus-visible{
  --ada-tile-state-face:${TEXT_TOKENS.label};
  --ada-tile-state-ink:${TEXT_TOKENS.buttonLabel};
  outline:none;
  box-shadow:none
}
${TILE_ROW}[data-state=inUse]:focus-visible{
  --ada-tile-state-face:${TEXT_TOKENS.supporting}
}
${TILE_ROW}[data-state=unaffordable]:focus-visible{
  --ada-tile-state-face:${UNLISTED_COLOURS.unavailableFace};
  --ada-tile-state-ink:${TEXT_TOKENS.title}
}
${TILE_FACE}{
  background-color:var(--ada-tile-state-face);
  background-clip:padding-box;
  border-image-slice:${TILE_SLICE}
}
${TILE_FACE} :is(.ada-shop-name,.ada-shop-level,.ada-owned){
  color:var(--ada-tile-state-ink)
}
${TILE_ROW}[data-ui-refusal-red] :is(.ada-shop-name,.ada-shop-level){
  color:inherit
}
${TILE_ROW}:focus-visible:active:not([data-state=unaffordable]) .ada-shop-name{
  color:${TEXT_TOKENS.title}
}
@media (forced-colors:active){
  ${TILE_FACE}{
    forced-color-adjust:none
  }
  ${TILE_ROW}[data-state=inUse]{
    --ada-tile-state-face:ButtonText;
    --ada-tile-state-ink:ButtonFace
  }
  ${TILE_ROW}:focus-visible{
    --ada-tile-state-face:Highlight;
    --ada-tile-state-ink:HighlightText
  }
  ${TILE_ROW}[data-state=inUse]:focus-visible{
    --ada-tile-state-face:HighlightText;
    --ada-tile-state-ink:Highlight
  }
  ${TILE_ROW}[data-state=unaffordable]:focus-visible{
    --ada-tile-state-face:color-mix(in srgb,ButtonFace 75%,ButtonText);
    --ada-tile-state-ink:ButtonText
  }
}

/* The item well: an ink edge with clear corner pixels, a navy face; glyphs centre in it. */
.ada-controls .ada-well{
  flex:none;
  box-sizing:border-box;
  width:${units(SHOP_ROW.well)};
  height:${units(SHOP_ROW.well)};
  display:grid;
  place-items:center;
  background:${COLOURS.navy};
  border:${units(SHOP_ROW.wellEdge)} solid ${COLOURS.ink};
  border-radius:${units(SHOP_ROW.wellEdge)};
  color:${TEXT_TOKENS.label}
}
.ada-controls [data-state=unaffordable] .ada-well{
  background:${COLOURS.disabledFace};
  color:${TEXT_TOKENS.disabledLabel}
}
.ada-controls .ada-well.ada-large{
  width:${units(CONFIRM_ITEM.well)};
  height:${units(CONFIRM_ITEM.well)}
}

/* Row glyphs share their authored display slot. */
.ada-controls .ada-glyph{
  width:${scaled(SHOP_ROW.glyph.icon)};
  height:${scaled(SHOP_ROW.glyph.icon)}
}
/* Multicolour glyphs use the supplied SVG for each state. */
.ada-controls .ada-glyph-state-vector{
  background:var(--state-icon) 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}
.ada-controls [data-state=unaffordable] .ada-glyph-state-vector{
  background-image:var(--state-icon-disabled)
}
.ada-controls .ada-glyph-vector{
  background:var(--icon) 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}
.ada-controls .ada-glyph-mask{
  background:currentColor;
  mask:var(--icon) center / 100% 100% no-repeat
}
@media (forced-colors:active){
  .ada-controls .ada-glyph-mask{
    background:ButtonText;
    forced-color-adjust:none
  }
  .ada-controls [data-state=unaffordable] .ada-glyph-mask{
    background:GrayText
  }
}
.ada-controls .ada-glyph-upgrade{
  position:relative;
  width:${scaled(SHOP_ROW.glyph.upgrade)};
  height:${scaled(SHOP_ROW.glyph.upgrade)}
}
.ada-controls .ada-glyph-upgrade > .ada-glyph{
  position:absolute;
  left:0;
  top:${scaled(SHOP_ROW.upgrade.weaponY)}
}
.ada-controls .ada-glyph-badge{
  position:absolute;
  left:${scaled(SHOP_ROW.upgrade.badgeX)};
  top:0;
  width:${scaled(SHOP_ROW.upgrade.badge)};
  height:${scaled(SHOP_ROW.upgrade.badge)};
  background:url('${uiIconUrl("icon-shop-upgrade-badge")}') 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}
.ada-controls [data-state=unaffordable] .ada-glyph-badge{
  background-image:url('${uiIconUrl("icon-shop-upgrade-badge-disabled")}')
}
.ada-controls .ada-glyph-swatch{
  width:${units(SHOP_ROW.glyph.swatch)};
  height:${units(SHOP_ROW.glyph.swatch)};
  image-rendering:pixelated
}
.ada-controls .ada-well.ada-large .ada-glyph-swatch{
  width:${units(CONFIRM_ITEM.swatch)};
  height:${units(CONFIRM_ITEM.swatch)}
}

.ada-controls .ada-shop-name{
  flex:1;
  min-width:0;
  display:grid;
  line-height:${units(SHOP_ROW.nameLine)};
  white-space:normal;
  overflow-wrap:anywhere
}
.ada-controls .ada-shop-level{
  color:${TEXT_TOKENS.rowSupporting}
}
.ada-controls [data-state=unaffordable] .ada-shop-level{
  color:${TEXT_TOKENS.rowDisabled}
}

.ada-controls .ada-shop-slot{
  flex:none;
  display:flex;
  justify-content:flex-end
}
.ada-controls .ada-price{
  box-sizing:border-box;
  height:${units(SHOP_ROW.pill.pill.height)};
  padding:0 ${units(PILL.padding)};
  display:flex;
  align-items:center;
  justify-content:center;
  gap:${units(SHOP_ROW.markGap)};
  border-radius:${units(PILL.radius)};
  background:${COLOURS.ink};
  font:${font(PILL.text)};
  color:${TEXT_TOKENS.label};
  white-space:nowrap
}
/* The row's disabled text colour, which the refusal cue tints red with the name. */
.ada-controls [data-state=unaffordable] .ada-price{
  color:inherit
}
.ada-controls .ada-price::before{
  content:"";
  flex:none;
  width:${units(SHOP_ROW.pill.icon)};
  height:${units(SHOP_ROW.pill.icon)};
  background:url('${uiIconUrl("icon-stardust-20")}') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-owned{
  display:flex;
  align-items:center;
  gap:${units(SHOP_ROW.markGap)};
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.rowSupporting};
  white-space:nowrap
}
.ada-controls [data-state=inUse] .ada-owned{
  color:${TEXT_TOKENS.label}
}
.ada-controls .ada-owned::before{
  content:"";
  flex:none;
  width:${units(SHOP_ROW.check.width)};
  height:${units(SHOP_ROW.check.height)};
  background:url('${uiIconUrl("icon-shop-check")}') 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}

.ada-controls :is(.ada-job-list,.ada-station-projects,.ada-stock-rows){
  display:grid;
  gap:${units(SPACING.rowGap)}
}

`;
