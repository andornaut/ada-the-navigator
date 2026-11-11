import type { Weapon } from "../data/types.ts";
import { weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { BUTTON_SLICE, FOCUS_RING, PILL, TEXT_BUTTON } from "./layout/controls.ts";
import { font, slice, units } from "./layout/css.ts";
import {
  BALANCE,
  CONFIRM_ITEM,
  SHOP_ROW,
  shopColumns,
  shopListWidth,
  shopRowWidth,
} from "./layout/shopCard.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import {
  createActions,
  createButton,
  createCard,
  FOCUS_STYLE,
  isTap,
  setScrollGroup,
  TEXT_TOKENS,
} from "./modal.ts";
import { refuse } from "./refusal.ts";
import { buttonProperty } from "./ui-skin.ts";

// The station card, the shop and the buy confirm (art/shop.md) on the shared card builder; every
// size comes from src/ui/layout (layout.md "Shop item row").

const SPRITES = "/art/ui/sprites/";
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
// A glyph size at the well's scale: 1 in rows, CONFIRM_ITEM.glyphScale in the confirm.
const scaled = (size: number) => `calc(${units(size)} * var(--glyph-scale,1))`;

export const STATION_STYLE = `
.ada-controls .ada-balance,
.ada-controls .ada-confirm-price{
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
.ada-controls .ada-confirm-price::before{
  content:"";
  flex:none;
  width:${units(BALANCE.icon)};
  height:${units(BALANCE.icon)};
  background:url('${SPRITES}icon-stardust-20.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

.ada-controls .ada-card .ada-confirm-about{
  color:${TEXT_TOKENS.label}
}

/* The item list, the shop's scroll group: its width holds the columns, the focus and selection
   rings' outset, and the scroll reserve, always kept. */
.ada-controls .ada-shop-list{
  box-sizing:border-box;
  display:grid;
  align-content:start;
  justify-items:center;
  gap:${units(SPACING.gap)};
  padding:${units(FOCUS_RING.outset)};
  scrollbar-gutter:stable;
  overflow-x:hidden;
  touch-action:pan-y
}
.ada-controls .ada-shop-list::-webkit-scrollbar-thumb{
  background:#6b6685;
  background-clip:padding-box
}

.ada-controls .ada-shop-group{
  display:grid;
  grid-template-columns:repeat(var(--shop-columns,2),var(--shop-row-width,max-content));
  column-gap:${units(SHOP_ROW.columnGap)};
  row-gap:${units(SHOP_ROW.rowGap)}
}
.ada-controls .ada-shop-paint{
  display:grid;
  gap:${units(SHOP_ROW.paintHeading.gap)}
}

.ada-controls .ada-paint-heading{
  justify-self:start;
  display:flex;
  align-items:center;
  gap:${units(SHOP_ROW.markGap)};
  height:${units(SHOP_ROW.paintHeading.line)};
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.title}
}
.ada-controls .ada-paint-heading::before{
  content:"";
  flex:none;
  width:${units(SHOP_ROW.paintHeading.icon)};
  height:${units(SHOP_ROW.paintHeading.icon)};
  background:url('${SPRITES}icon-shop-ship-paint.png') 0 0 / 200% 100% no-repeat;
  image-rendering:pixelated
}

/* An item row: a ui-button-tile at the action height; the whole row is one control. */
.ada-controls .ada-shop-row{
  position:relative;
  box-sizing:border-box;
  width:var(--shop-row-width,max-content);
  height:${units(SHOP_ROW.height)};
  min-width:0;
  min-height:0;
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
  color:${TEXT_TOKENS.disabledLabel};
  background:#2f2d3d;
  border-color:#2f2d3d;
  border-image-source:var(${buttonProperty("ui-button-tile", "disabled")});
  cursor:default
}
/* In use: the cream selection ring outside the row's drawn rectangle. */
.ada-controls .ada-shop-row[data-state=inUse]::after{
  content:"";
  position:absolute;
  top:calc(${units(-RING_OUT)} - ${slice(top)});
  right:calc(${units(-RING_OUT)} - ${slice(right)});
  bottom:calc(${units(-RING_OUT)} - ${slice(bottom)});
  left:calc(${units(-RING_OUT)} - ${slice(left)});
  border:${units(SHOP_ROW.selection.band)} solid #ead4aa;
  pointer-events:none
}
.ada-controls .ada-shop-row:focus-visible{${FOCUS_STYLE}
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
.ada-controls [data-state=unaffordable] .ada-glyph-sprite,
.ada-controls [data-state=unaffordable] .ada-glyph-badge{
  background-position:100% 0
}
.ada-controls .ada-glyph-weapon{
  background:currentColor;
  -webkit-mask:var(--sheet) center / 100% 100% no-repeat;
  mask:var(--sheet) center / 100% 100% no-repeat
}
.ada-controls .ada-glyph-upgrade{
  position:relative;
  width:${scaled(SHOP_ROW.glyph.upgrade)};
  height:${scaled(SHOP_ROW.glyph.upgrade)}
}
.ada-controls .ada-glyph-upgrade .ada-glyph-weapon{
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
  background:url('${SPRITES}icon-shop-upgrade-badge.png') 0 0 / 200% 100% no-repeat;
  image-rendering:pixelated
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
  white-space:nowrap
}
.ada-controls .ada-shop-level{
  color:${TEXT_TOKENS.supporting}
}
.ada-controls [data-state=unaffordable] .ada-shop-level{
  color:${TEXT_TOKENS.disabledLabel}
}

.ada-controls .ada-shop-slot{
  flex:none;
  min-width:var(--shop-slot-width,auto);
  display:flex;
  justify-content:flex-end
}
.ada-controls .ada-price{
  box-sizing:border-box;
  min-width:var(--shop-pill-width,auto);
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
  color:${TEXT_TOKENS.supporting};
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
  background:url('${SPRITES}icon-shop-check.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

/* Measuring: rows at their natural widths, off screen. */
.ada-controls .ada-shop-measure{
  position:absolute;
  visibility:hidden;
  pointer-events:none;
  height:auto;
  width:max-content
}
.ada-controls .ada-shop-measure .ada-shop-row{
  width:max-content
}
.ada-controls .ada-shop-measure .ada-shop-name{
  flex:none
}
`;

export interface StationLabels {
  readonly close: string;
  readonly confirmBuy: string;
  readonly confirmCancel: string;
  readonly inUse: string;
  readonly owned: string;
  readonly shipPaint: string;
  readonly shop: string;
  readonly shopShip: string;
  readonly shopWeapons: string;
  readonly station: string;
  readonly stationWelcome: string;
  readonly undock: string;
}

export type StationTab = "weapons" | "ship";

/**
 * How a row answers a tap: forSale opens the confirm, unaffordable refuses, selectable
 * applies an owned paint at once, and owned and inUse rows do nothing.
 */
export type StationRowState = "forSale" | "unaffordable" | "selectable" | "owned" | "inUse";

/** An item's glyph (art/shop-icons.md). */
export type ItemGlyph =
  | { readonly kind: "sprite"; readonly key: string }
  | { readonly kind: "weapon"; readonly weapon: Weapon }
  | { readonly kind: "upgrade"; readonly weapon: Weapon }
  | { readonly kind: "swatch"; readonly path: string };

/** One shop row as shown; `key` names the item to the caller. */
export interface StationRow {
  readonly glyph: ItemGlyph;
  /** The paint group follows the item group on the Ship tab. */
  readonly group: "items" | "paint";
  readonly key: string;
  readonly level: string;
  readonly name: string;
  readonly price: number | null;
  readonly state: StationRowState;
}

export type StationRequest =
  | {
      readonly about: string;
      readonly kind: "confirm";
      readonly left: string;
      readonly price: number;
      readonly title: string;
    }
  | { readonly kind: "refused" };

export interface StationOptions {
  /** The station card's balance: the amount alone and its line, such as "260 Stardust". */
  readonly balance: () => { readonly amount: number; readonly text: string };
  readonly buy: (key: string) => void;
  readonly labels: StationLabels;
  readonly reducedMotion: () => boolean;
  readonly request: (key: string) => StationRequest;
  readonly rows: (tab: StationTab) => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly undock: () => void;
}

/**
 * One step back: the confirm returns to the shop, the shop returns to the station card,
 * and only the station card's exits undock.
 */
export function stationBack(
  view: "card" | "shop",
  confirming: boolean,
): "card" | "shop" | "undock" {
  if (confirming) {
    return "shop";
  }
  return view === "shop" ? "card" : "undock";
}

/** What a row tap does; an unaffordable row is tappable and refuses. */
export function rowAction(state: StationRowState): "request" | "select" | "none" {
  if (state === "selectable") {
    return "select";
  }
  return state === "owned" || state === "inUse" ? "none" : "request";
}

function glyphElement(glyph: ItemGlyph): HTMLElement {
  if (glyph.kind === "swatch") {
    const image = document.createElement("img");
    image.className = "ada-glyph-swatch";
    image.src = glyph.path;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  const node = document.createElement("span");
  node.setAttribute("aria-hidden", "true");
  if (glyph.kind === "upgrade") {
    node.className = "ada-glyph-upgrade";
    const badge = document.createElement("span");
    badge.className = "ada-glyph-badge";
    node.append(glyphElement({ kind: "weapon", weapon: glyph.weapon }), badge);
    return node;
  }
  node.className =
    glyph.kind === "sprite" ? "ada-glyph ada-glyph-sprite" : "ada-glyph ada-glyph-weapon";
  node.style.setProperty(
    "--sheet",
    glyph.kind === "sprite"
      ? `url('${SPRITES}${glyph.key}.png')`
      : `url('${weaponGlyphPath(glyph.weapon)}')`,
  );
  return node;
}

function well(glyph: ItemGlyph, large = false): HTMLElement {
  const node = document.createElement("span");
  node.className = large ? "ada-well ada-large" : "ada-well";
  if (large) {
    node.style.setProperty("--glyph-scale", String(CONFIRM_ITEM.glyphScale));
  }
  node.append(glyphElement(glyph));
  return node;
}

function prose(className: string, text: string): HTMLParagraphElement {
  const node = document.createElement("p");
  node.className = `ada-prose ada-card-note ${className}`;
  node.dataset.inkTop = "0";
  node.textContent = text;
  return node;
}

// An element's laid-out width and height in logical px.
function measured(element: HTMLElement, unit: number): { height: number; width: number } {
  const style = getComputedStyle(element);
  return { height: parseFloat(style.height) / unit, width: parseFloat(style.width) / unit };
}

/**
 * The docked station card, its shop and the buy confirm, following Archie's Pet shop on
 * the shared card builder: tabs, Owned and In use rows, a confirm naming the item and the
 * balance left after, and the shared refusal for an item Ada cannot afford. Back (the X,
 * an outside tap or Escape) cancels the confirm, leaves the shop, and on the station card
 * undocks.
 */
export function createStationView(parent: HTMLElement, options: StationOptions) {
  const { labels } = options;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.dataset.station = "";
  modal.hidden = true;
  const confirmModal = document.createElement("div");
  confirmModal.className = "ada-modal";
  confirmModal.dataset.stationConfirm = "";
  confirmModal.hidden = true;

  const stationCard = createCard({
    closeAction: "station-back",
    closeLabel: labels.close,
    title: labels.station,
  });
  stationCard.card.dataset.dialog = "station";
  const stationBalance = document.createElement("div");
  stationBalance.className = "ada-balance";
  stationBalance.dataset.inkTop = "0";
  const undock = createButton(labels.undock);
  undock.dataset.action = "undock";
  const openShop = createButton(labels.shop, "primary");
  openShop.dataset.action = "open-shop";
  stationCard.body.append(
    stationBalance,
    prose("ada-station-welcome", labels.stationWelcome),
    createActions([
      { button: undock, role: "secondary" },
      { button: openShop, role: "primary" },
    ]),
  );

  const shopCard = createCard({
    closeAction: "shop-back",
    closeLabel: labels.close,
    title: labels.shop,
  });
  shopCard.card.dataset.dialog = "shop";
  shopCard.frame.hidden = true;
  const shopBalance = document.createElement("div");
  shopBalance.className = "ada-balance";
  shopBalance.dataset.inkTop = "0";
  const tabButtons = new Map<StationTab, HTMLButtonElement>();
  for (const [id, label] of [
    ["weapons", labels.shopWeapons],
    ["ship", labels.shopShip],
  ] as const) {
    const button = createButton(label);
    button.setAttribute("role", "tab");
    button.dataset.tab = id;
    tabButtons.set(id, button);
  }
  const tabs = createActions(
    [...tabButtons.values()].map((button) => ({ button, role: "secondary" as const })),
  );
  tabs.classList.add("ada-shop-tabs");
  tabs.setAttribute("role", "tablist");
  const list = document.createElement("div");
  list.className = "ada-shop-list";
  list.setAttribute("role", "tabpanel");
  shopCard.body.append(shopBalance, tabs, list);
  setScrollGroup(shopCard, list);

  const confirmCard = createCard({
    closeAction: "confirm-cancel-x",
    closeLabel: labels.close,
    title: "",
  });
  confirmCard.card.dataset.dialog = "confirm";
  const cancel = createButton(labels.confirmCancel);
  cancel.dataset.action = "confirm-cancel";
  const buy = createButton(labels.confirmBuy, "primary");
  buy.dataset.action = "confirm-buy";
  const confirmActions = createActions([
    { button: cancel, role: "secondary" },
    { button: buy, role: "primary" },
  ]);

  modal.append(stationCard.frame, shopCard.frame);
  confirmModal.append(confirmCard.frame);
  parent.append(modal, confirmModal);

  let open = false;
  let view: "card" | "shop" = "card";
  let tab: StationTab = "weapons";
  let confirm: { key: string } | null = null;

  const renderBalances = (): void => {
    const balance = options.balance();
    stationBalance.textContent = balance.text;
    shopBalance.textContent = String(balance.amount);
  };

  const rowElement = (row: StationRow): HTMLButtonElement => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "ada-shop-row";
    node.dataset.item = row.key;
    node.dataset.state = row.state;
    const name = document.createElement("span");
    name.className = "ada-shop-name";
    const title = document.createElement("span");
    title.textContent = row.name;
    name.append(title);
    if (row.level) {
      const level = document.createElement("span");
      level.className = "ada-shop-level";
      level.textContent = row.level;
      name.append(level);
    }
    const slot = document.createElement("span");
    slot.className = "ada-shop-slot";
    const trailing = document.createElement("span");
    if (row.state === "owned" || row.state === "selectable" || row.state === "inUse") {
      trailing.className = "ada-owned";
      trailing.textContent = row.state === "inUse" ? labels.inUse : labels.owned;
    } else {
      trailing.className = "ada-price";
      trailing.textContent = row.price === null ? "" : String(row.price);
    }
    slot.append(trailing);
    node.append(well(row.glyph), name, slot);
    node.setAttribute(
      "aria-label",
      [row.name, row.level, trailing.textContent].filter(Boolean).join(", "),
    );
    node.addEventListener("click", () => {
      const action = rowAction(row.state);
      if (action === "select") {
        options.select(row.key);
        render();
        return;
      }
      if (action === "none") {
        return;
      }
      const request = options.request(row.key);
      if (request.kind === "refused") {
        refuse(node, options.reducedMotion());
        return;
      }
      openConfirm(row, request);
    });
    return node;
  };

  const groupElement = (rows: readonly StationRow[]): HTMLDivElement => {
    const group = document.createElement("div");
    group.className = "ada-shop-group";
    group.append(...rows.map(rowElement));
    return group;
  };

  const tabContent = (id: StationTab): HTMLElement[] => {
    const rows = options.rows(id);
    const content: HTMLElement[] = [groupElement(rows.filter((row) => row.group === "items"))];
    const paint = rows.filter((row) => row.group === "paint");
    if (paint.length) {
      const block = document.createElement("div");
      block.className = "ada-shop-paint";
      const heading = document.createElement("div");
      heading.className = "ada-paint-heading";
      heading.textContent = labels.shipPaint;
      block.append(heading, groupElement(paint));
      content.push(block);
    }
    return content;
  };

  // Every row shares the widest row across both tabs and the list keeps the taller tab's height,
  // so switching tabs never resizes the card.
  const fitList = (): void => {
    const card = shopCard.card;
    const unit = readViewUnit(card);
    for (const name of ["--shop-row-width", "--shop-slot-width", "--shop-pill-width"]) {
      card.style.removeProperty(name);
    }
    const measure = document.createElement("div");
    measure.className = "ada-shop-list ada-shop-measure";
    const tabsContent = (["weapons", "ship"] as const).map((id) => {
      const holder = document.createElement("div");
      holder.className = "ada-shop-list";
      holder.append(...tabContent(id));
      return holder;
    });
    measure.append(...tabsContent);
    card.append(measure);
    const widest = (selector: string) =>
      Math.max(
        0,
        ...[...measure.querySelectorAll<HTMLElement>(selector)].map(
          (node) => measured(node, unit).width,
        ),
      );
    const pill = Math.ceil(widest(".ada-price"));
    const slot = Math.max(pill, Math.ceil(widest(".ada-owned")));
    const row = shopRowWidth(Math.ceil(widest(".ada-shop-name")), slot);
    card.style.setProperty("--shop-pill-width", units(pill));
    card.style.setProperty("--shop-slot-width", units(slot));
    card.style.setProperty("--shop-row-width", units(row));
    const layer = getComputedStyle(modal);
    const available =
      (modal.clientWidth - parseFloat(layer.paddingLeft) - parseFloat(layer.paddingRight)) / unit;
    const columns = shopColumns(available, row);
    card.style.setProperty("--shop-columns", String(columns));
    const height = Math.max(...tabsContent.map((holder) => measured(holder, unit).height));
    measure.remove();
    list.style.width = units(shopListWidth(columns, row) + 2 * FOCUS_RING.outset);
    list.style.height = units(height);
  };

  const renderShop = (): void => {
    for (const [id, button] of tabButtons) {
      button.classList.toggle("ada-primary", id === tab);
      button.setAttribute("aria-selected", String(id === tab));
    }
    list.replaceChildren(...tabContent(tab));
  };

  const render = (): void => {
    renderBalances();
    stationCard.frame.hidden = view !== "card";
    shopCard.frame.hidden = view !== "shop";
    if (view === "shop") {
      renderShop();
      fitList();
      shopCard.fit();
    } else {
      stationCard.fit();
    }
  };

  const openConfirm = (row: StationRow, request: Extract<StationRequest, { kind: "confirm" }>) => {
    confirm = { key: row.key };
    confirmCard.title.textContent = request.title;
    confirmCard.frame.setAttribute("aria-label", request.title);
    const item = well(row.glyph, true);
    item.dataset.inkTop = "0";
    const price = document.createElement("div");
    price.className = "ada-confirm-price";
    price.dataset.inkTop = "0";
    price.textContent = String(request.price);
    const parts: HTMLElement[] = [item];
    if (request.about) {
      parts.push(prose("ada-confirm-about", request.about));
    }
    parts.push(price, prose("ada-confirm-left", request.left), confirmActions);
    confirmCard.body.replaceChildren(...parts);
    confirmModal.hidden = false;
    confirmCard.fit();
    buy.focus();
  };
  const closeConfirm = (): void => {
    confirm = null;
    confirmModal.hidden = true;
  };

  const back = (): void => {
    const step = stationBack(view, confirm !== null);
    if (step === "undock") {
      options.undock();
      return;
    }
    if (confirm) {
      closeConfirm();
      return;
    }
    view = step;
    render();
    (view === "card" ? openShop : tabButtons.get(tab))?.focus();
  };

  // The row width and columns follow the view; the card builder refits the card itself.
  const refit = (): void => {
    if (open && view === "shop") {
      fitList();
      shopCard.fit();
    }
  };
  window.addEventListener("resize", refit);
  window.addEventListener(VIEW_SCALE_EVENT, refit);

  undock.addEventListener("click", options.undock);
  openShop.addEventListener("click", () => {
    view = "shop";
    render();
    tabButtons.get(tab)?.focus();
  });
  for (const [id, button] of tabButtons) {
    button.addEventListener("click", () => {
      tab = id;
      renderShop();
      list.scrollTop = 0;
    });
  }
  stationCard.close.addEventListener("click", back);
  shopCard.close.addEventListener("click", back);
  confirmCard.close.addEventListener("click", back);
  cancel.addEventListener("click", back);
  buy.addEventListener("click", () => {
    const pending = confirm;
    closeConfirm();
    if (pending) {
      options.buy(pending.key);
    }
    render();
  });

  // A full outside tap goes back, as the Paused card's does; a drag out does not.
  for (const layer of [modal, confirmModal]) {
    let outside: { readonly x: number; readonly y: number } | undefined;
    layer.addEventListener("pointerdown", (event) => {
      outside = event.target === layer ? { x: event.clientX, y: event.clientY } : undefined;
    });
    layer.addEventListener("click", (event) => {
      if (
        outside &&
        event.target === layer &&
        isTap(readViewUnit(layer), outside, { x: event.clientX, y: event.clientY })
      ) {
        back();
      }
      outside = undefined;
    });
  }

  // A drag past the threshold scrolls the list and does not activate the row it started on.
  let drag = { moved: false, scroll: 0, x: 0, y: 0 };
  let dragging = false;
  list.addEventListener("pointerdown", (event) => {
    dragging = true;
    drag = { moved: false, scroll: list.scrollTop, x: event.clientX, y: event.clientY };
  });
  list.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const at = { x: event.clientX, y: event.clientY };
    if (drag.moved || !isTap(readViewUnit(list), drag, at)) {
      drag.moved = true;
      list.scrollTop = drag.scroll - (at.y - drag.y);
    }
  });
  list.addEventListener(
    "click",
    (event) => {
      if (drag.moved) {
        event.stopPropagation();
        event.preventDefault();
      }
      dragging = false;
      drag.moved = false;
    },
    true,
  );
  for (const type of ["pointercancel", "pointerup"] as const) {
    list.addEventListener(type, () => {
      dragging = false;
    });
  }

  return {
    dispose(): void {
      window.removeEventListener("resize", refit);
      window.removeEventListener(VIEW_SCALE_EVENT, refit);
      stationCard.dispose();
      shopCard.dispose();
      confirmCard.dispose();
      modal.remove();
      confirmModal.remove();
    },
    isOpen: () => open,
    /**
     * Back-stack layers: the confirm and the shop step back toward the station card, and
     * the card undocks. Register the card first so the shop is innermost.
     */
    layers: {
      card: { back, isOpen: () => open && view === "card" && confirm === null },
      shop: { back, isOpen: () => open && (view === "shop" || confirm !== null) },
    },
    /** Opens on the station card when docking and closes on undocking. */
    setOpen(value: boolean): void {
      if (value === open) {
        return;
      }
      open = value;
      modal.hidden = !open;
      view = "card";
      closeConfirm();
      if (open) {
        render();
        openShop.focus();
      }
    },
  };
}
