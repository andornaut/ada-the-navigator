import { BUTTON_FACE, FOCUS_STYLE, TEXT_TOKENS } from "../modal.ts";
import { buttonProperty } from "../uiSkin.ts";
import { CARD_WIDTH_CAPS } from "./contentCard.ts";
import { BUTTON_SLICE, FOCUS_RING, FRAME_LINE, PILL, TEXT_BUTTON } from "./controls.ts";
import { font, slice, units } from "./css.ts";
import { BALANCE, CONFIRM_ITEM, SHOP_ROW } from "./shopCard.ts";
import { BUTTON_GAP, SPACING, TYPE } from "./tokens.ts";

export const STATION_SPRITES = "/art/ui/sprites/";
const SPRITES = STATION_SPRITES;
const ICONS = "/art/ui/icons/";
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
const RING_OUT = SHOP_ROW.selection.outset + SHOP_ROW.selection.band;
const STOCK_ROW = ".ada-controls [data-shop-stock] .ada-shop-row";
const STOCK_FACE = `${STOCK_ROW}:is([data-state=inUse],:focus-visible):where(
  :not(:active),[data-state=unaffordable]
)`;
const OTHER_ROW = ".ada-controls .ada-shop-row:not(:where([data-shop-stock] *))";
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
.ada-controls .ada-station-frame > .ada-close{
  top:0;
  right:0
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
  background:url('${SPRITES}icon-stardust-20.png') center / 100% 100% no-repeat
}
.ada-controls .ada-station-balances [data-balance=ore]::before{
  background-image:url('${SPRITES}icon-ore-20.png')
}
.ada-controls .ada-station-footer{
  display:flex;
  flex:none;
  align-items:center;
  gap:${units(SPACING.gap)};
  padding:${units(SPACING.gap)} 0;
  border-top:${units(1)} solid #6b6685;
  margin-top:auto
}
.ada-controls .ada-station-footer [data-action=undock]{
  margin-left:auto
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
  --ada-station-footer-underline-height:${units(6)};
  color:var(--ada-station-footer-ink);
  border-color:transparent;
  border-image-source:none;
  background:linear-gradient(var(--ada-station-footer-underline),var(--ada-station-footer-underline))
    left bottom / 100% var(--ada-station-footer-underline-height) no-repeat var(--ada-station-footer-face);
  background-origin:border-box
}
.ada-controls .ada-station-footer .ada-button[aria-current=page]:focus-visible{
  --ada-station-footer-underline:${TEXT_TOKENS.label};
  --ada-station-footer-underline-height:${units(8)}
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
  background:url('${SPRITES}icon-stardust-20.png') ${units(SPACING.rowGap)} center /
    ${units(TYPE.count.size)} ${units(TYPE.count.size)} no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-station-panes > section{
  min-width:0
}
.ada-controls .ada-station-panes > section + section{
  border-left:${units(1)} solid #6b6685;
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
  background:#302e42;
  border:${slice(FRAME_LINE)} solid #49465f
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
  background:#514b68;
  border-color:#514b68;
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
  background:#5f5980;
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
  background:url('${SPRITES}icon-stardust-20.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

.ada-controls .ada-confirm-stardust-spoken,
.ada-controls .ada-exchange-rate-spoken{
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
  background:#46425e;
  border-style:solid;
  border-color:#46425e #46425e #2f2d3d;
  border-width:${TILE_WIDTHS};
  border-radius:0;
  border-image:var(${buttonProperty("ui-button-tile", "normal")}) ${TILE_SLICE} fill / ${TILE_WIDTHS};
  image-rendering:pixelated;
  cursor:pointer;
  pointer-events:auto;
  scroll-margin:${units(FOCUS_RING.outset)}
}
.ada-controls .ada-shop-row:active:not([data-state=unaffordable]){
  padding:${units(TEXT_BUTTON.pressedSink)} ${ROW_SIDE} ${PRESSED_BOTTOM};
  border-image-source:var(${buttonProperty("ui-button-tile", "pressed")})
}
/* Unaffordable: the flat disabled frame over the full height, still focusable and pressable. */
.ada-controls .ada-shop-row[data-state=unaffordable]{
  padding:${FLAT_TOP} ${ROW_SIDE} 0;
  color:${TEXT_TOKENS.rowDisabled};
  background:#2f2d3d;
  border-color:#2f2d3d;
  border-image-source:var(${buttonProperty("ui-button-tile", "disabled")});
  cursor:default
}
/* The held Job keeps its existing decoration. */
${OTHER_ROW}[data-state=inUse]::after{
  content:"";
  position:absolute;
  top:calc(${units(-RING_OUT)} - ${slice(top)});
  right:calc(${units(-RING_OUT)} - ${slice(right)});
  bottom:calc(${units(-RING_OUT)} - ${slice(bottom)});
  left:calc(${units(-RING_OUT)} - ${slice(left)});
  border:${units(SHOP_ROW.selection.band)} solid #ead4aa;
  pointer-events:none
}
${OTHER_ROW}:focus-visible{${FOCUS_STYLE}
}
/* Colour the Shop face and keep the tile's edges, lip and pressed art. */
${STOCK_ROW}[data-state=inUse]{
  --ada-stock-face:#262b44;
  --ada-stock-ink:${TEXT_TOKENS.label}
}
${STOCK_ROW}:focus-visible{
  --ada-stock-face:${TEXT_TOKENS.label};
  --ada-stock-ink:${TEXT_TOKENS.buttonLabel};
  outline:none;
  box-shadow:none
}
${STOCK_ROW}[data-state=inUse]:focus-visible{
  --ada-stock-face:${TEXT_TOKENS.supporting}
}
${STOCK_ROW}[data-state=unaffordable]:focus-visible{
  --ada-stock-face:#514b68;
  --ada-stock-ink:${TEXT_TOKENS.title}
}
${STOCK_FACE}{
  background-color:var(--ada-stock-face);
  background-clip:padding-box;
  border-image-slice:${TILE_SLICE}
}
${STOCK_FACE} :is(.ada-shop-name,.ada-shop-level,.ada-owned){
  color:var(--ada-stock-ink)
}
${STOCK_ROW}[data-ui-refusal-red] :is(.ada-shop-name,.ada-shop-level){
  color:inherit
}
${STOCK_ROW}:focus-visible:active:not([data-state=unaffordable]) .ada-shop-name{
  color:${TEXT_TOKENS.title}
}
@media (forced-colors:active){
  ${STOCK_FACE}{
    forced-color-adjust:none
  }
  ${STOCK_ROW}[data-state=inUse]{
    --ada-stock-face:ButtonText;
    --ada-stock-ink:ButtonFace
  }
  ${STOCK_ROW}:focus-visible{
    --ada-stock-face:Highlight;
    --ada-stock-ink:HighlightText
  }
  ${STOCK_ROW}[data-state=inUse]:focus-visible{
    --ada-stock-face:HighlightText;
    --ada-stock-ink:Highlight
  }
  ${STOCK_ROW}[data-state=unaffordable]:focus-visible{
    --ada-stock-face:color-mix(in srgb,ButtonFace 75%,ButtonText);
    --ada-stock-ink:ButtonText
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
  background:#262b44;
  border:${units(SHOP_ROW.wellEdge)} solid #181425;
  border-radius:${units(SHOP_ROW.wellEdge)};
  color:${TEXT_TOKENS.label}
}
.ada-controls [data-state=unaffordable] .ada-well{
  background:#2f2d3d;
  color:${TEXT_TOKENS.disabledLabel}
}
.ada-controls .ada-well.ada-large{
  width:${units(CONFIRM_ITEM.well)};
  height:${units(CONFIRM_ITEM.well)}
}

/* Sheets hold the normal frame then the disabled one; glyphs scale by nearest neighbour. */
.ada-controls .ada-glyph{
  width:${scaled(SHOP_ROW.glyph.icon)};
  height:${scaled(SHOP_ROW.glyph.icon)};
  image-rendering:pixelated
}
.ada-controls .ada-glyph-sprite{
  background:var(--sheet) 0 0 / 200% 100% no-repeat
}
.ada-controls [data-state=unaffordable] .ada-glyph-sprite{
  background-position:100% 0
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
  background:url('${ICONS}icon-shop-upgrade-badge.svg') 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}
.ada-controls [data-state=unaffordable] .ada-glyph-badge{
  background-image:url('${ICONS}icon-shop-upgrade-badge-disabled.svg')
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
  background:#181425;
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
  background:url('${SPRITES}icon-stardust.png') 0 0 / 100% 100% no-repeat;
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
  background:url('${ICONS}icon-shop-check.svg') 0 0 / 100% 100% no-repeat;
  image-rendering:auto
}

.ada-controls :is(.ada-job-list,.ada-station-projects,.ada-stock-rows){
  display:grid;
  gap:${units(SPACING.rowGap)}
}

`;
