import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import type { Weapon } from "../data/types.ts";
import { weaponShopSheet } from "../data/weaponGlyphs.ts";
import type { StationGreeting } from "../model/keepers.ts";
import { createKeeperBlock } from "./keeperBlock.ts";
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
import { buttonProperty } from "./uiSkin.ts";

// The station card, the shop, the job board and their confirms (art/shop.md,
// gameplay/quests.md "Job board") on the shared card builder; every size comes from src/ui/layout
// (layout.md "Shop item row").

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
  color:${TEXT_TOKENS.rowDisabled};
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
  color:${TEXT_TOKENS.rowSupporting}
}
.ada-controls [data-state=unaffordable] .ada-shop-level{
  color:${TEXT_TOKENS.rowDisabled}
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
  background:url('${SPRITES}icon-shop-check.png') 0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

/* The job board's list: one column of rows at the widest row's width. */
.ada-controls .ada-job-list{
  box-sizing:border-box;
  display:grid;
  grid-template-columns:max-content;
  justify-content:center;
  align-content:start;
  row-gap:${units(SHOP_ROW.rowGap)};
  padding:${units(FOCUS_RING.outset)};
  scrollbar-gutter:stable;
  overflow-x:hidden;
  touch-action:pan-y
}
.ada-controls .ada-job-row{
  width:auto;
  justify-self:stretch
}
.ada-controls .ada-job-row .ada-shop-slot{
  gap:${units(SHOP_ROW.markGap)};
  align-items:center
}
/* The compact row action (art/controls.md "Compact row action"): drawn inside the row, which
   stays one control, so it takes no press of its own and sinks with the row. Every row's action
   is one width. In a busy row it is the flat disabled frame, its label at 4 in row disabled. */
.ada-controls .ada-job-action.ada-compact{
  min-width:var(--job-action-width,${units(TEXT_BUTTON.compactWidth)});
  pointer-events:none;
  cursor:inherit
}
.ada-controls .ada-shop-row:active .ada-job-action.ada-compact:not(.ada-primary){
  border-image-source:var(--ui-button-normal)
}
.ada-controls .ada-shop-row:active .ada-job-action.ada-compact.ada-primary{
  border-image-source:var(--ui-button-primary-normal)
}
.ada-controls [data-state=unaffordable] .ada-job-action.ada-compact{
  align-items:flex-start;
  padding-top:${units(TEXT_BUTTON.pressedSink)};
  color:${TEXT_TOKENS.rowDisabled};
  border-image-source:var(--ui-button-disabled)
}
.ada-controls [data-state=unaffordable] .ada-job-action.ada-compact.ada-primary{
  border-image-source:var(--ui-button-primary-disabled)
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
  readonly jobAccept: string;
  readonly jobActive: string;
  readonly jobBoard: string;
  readonly jobBoardIntro: string;
  readonly activityDrop: string;
  readonly jobBusy: string;
  readonly jobDrop: string;
  readonly jobDropCancel: string;
  readonly jobDropTitle: string;
  readonly jobs: string;
  /** The keeper block's name while it shows the next line. */
  readonly nextLine: string;
  readonly owned: string;
  readonly projectFunded: string;
  readonly projects: string;
  readonly shipPaint: string;
  readonly shop: string;
  readonly shopShip: string;
  readonly shopWeapons: string;
  readonly station: string;
  readonly stationWelcome: string;
  readonly undock: string;
}

export type StationTab = "projects" | "ship" | "weapons";

/** The station's cards: the station card, the shop and the job board. */
export type StationView = "card" | "shop" | "jobs";

/**
 * One job board row as shown: the held job (Active, with Drop) or an offer, which refuses while
 * Ada holds a job.
 */
export interface StationJob {
  readonly detail: string;
  readonly id: string;
  /** A station job, or the galaxy's active activity, whose Drop names it. */
  readonly kind: "activity" | "job";
  readonly reward: number;
  /** The reward's words for assistive technology, such as "15 Stardust". */
  readonly rewardText: string;
  readonly state: "held" | "offer" | "busy";
  readonly title: string;
  readonly type: string;
}

/**
 * How a row answers a tap: forSale opens the confirm, unaffordable refuses, selectable
 * applies an owned paint at once, and owned and inUse rows do nothing.
 */
export type StationRowState = "forSale" | "unaffordable" | "selectable" | "owned" | "inUse";

/** An item's glyph (art/shop-icons.md). */
export type ItemGlyph =
  | { readonly kind: "sprite"; readonly key: string }
  | { readonly kind: "upgrade"; readonly weapon: Weapon }
  | { readonly kind: "swatch"; readonly path: string };

/** One shop row as shown; `key` names the item to the caller. */
export interface StationRow {
  /** A community project's row, whose owned state reads Funded (art/projects.md). */
  readonly project?: boolean;
  readonly glyph: ItemGlyph;
  /**
   * The ammunition group precedes the item group on the Weapons tab; the paint group follows
   * it on the Ship tab.
   */
  readonly group: "ammo" | "items" | "paint";
  readonly key: string;
  readonly level: string;
  readonly name: string;
  readonly price: number | null;
  readonly state: StationRowState;
}

export type StationRequest =
  | {
      readonly about: string;
      /** The primary action's label: Buy, or Donate for a project. */
      readonly action: string;
      readonly kind: "confirm";
      readonly left: string;
      readonly price: number;
      /** A donation leaving part unpaid: "{amount} still needed after". */
      readonly stillNeeded?: string;
      readonly title: string;
    }
  | { readonly kind: "refused" };

export interface StationOptions {
  /** Accept takes an offer at once; false refuses it while Ada holds a job. */
  readonly acceptJob: (id: string) => boolean;
  /** Why Accept refuses while the galaxy's slot is taken: a job or an activity holds it. */
  readonly busyLine: () => string;
  /** A tap on the keeper block shows the keeper's next line. */
  readonly advanceGreeting: () => void;
  /** The station card's balance: the amount alone and its line, such as "260 Stardust". */
  readonly balance: () => { readonly amount: number; readonly text: string };
  readonly buy: (key: string) => void;
  /** Whether the Projects tab shows: once the galaxy's projects are offered. */
  readonly projectsShown: () => boolean;
  readonly dropJob: () => void;
  /** The docked station keeper's line on show, or null for the generic welcome. */
  readonly greeting: () => StationGreeting | null;
  readonly jobs: () => readonly StationJob[];
  readonly labels: StationLabels;
  readonly reducedMotion: () => boolean;
  readonly request: (key: string) => StationRequest;
  readonly rows: (tab: StationTab) => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly undock: () => void;
}

/**
 * One step back: a confirm returns to the card under it, the shop and the job board return to
 * the station card, and only the station card's exits undock.
 */
export function stationBack(view: StationView, confirming: boolean): StationView | "undock" {
  if (confirming) {
    return view;
  }
  return view === "card" ? "undock" : "card";
}

/** What a job row tap does: an offer accepts, a refused offer refuses, the held job asks to drop. */
export function jobAction(state: StationJob["state"]): "accept" | "drop" {
  return state === "held" ? "drop" : "accept";
}

/** What a row tap does; an unaffordable row is tappable and refuses. */
export function rowAction(state: StationRowState): "request" | "select" | "none" {
  if (state === "selectable") {
    return "select";
  }
  return state === "owned" || state === "inUse" ? "none" : "request";
}

/** A weapon's shop glyph: its two-frame shop sheet. */
export function weaponItemGlyph(weapon: Weapon): ItemGlyph {
  return { key: weaponShopSheet(weapon), kind: "sprite" };
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
    node.append(glyphElement(weaponItemGlyph(glyph.weapon)), badge);
    return node;
  }
  node.className = "ada-glyph ada-glyph-sprite";
  node.style.setProperty("--sheet", `url('${SPRITES}${glyph.key}.png')`);
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
  const openJobs = createButton(labels.jobs);
  openJobs.dataset.action = "open-jobs";
  // The keeper's block: the greeting where the station has one, a tap showing its next line while
  // Undock, Jobs and Shop stay live (gameplay/rules.md "Species and greeters"). When its last line
  // shows, focus on it moves to Shop, where the card's focus starts.
  const keeper = createKeeperBlock({
    advance: () => {
      options.advanceGreeting();
      keeper.render(options.greeting());
    },
    focusAfter: () => openShop,
    labels: { nextLine: labels.nextLine, welcome: labels.stationWelcome },
  });
  stationCard.body.append(
    stationBalance,
    keeper.element(),
    createActions([
      { button: undock, role: "secondary" },
      { button: openJobs, role: "secondary" },
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
    ["projects", labels.projects],
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

  const jobsCard = createCard({
    closeAction: "jobs-back",
    closeLabel: labels.close,
    title: labels.jobBoard,
  });
  jobsCard.card.dataset.dialog = "jobs";
  jobsCard.frame.hidden = true;
  const jobsBalance = document.createElement("div");
  jobsBalance.className = "ada-balance";
  jobsBalance.dataset.inkTop = "0";
  const jobsIntro = prose("ada-jobs-intro", labels.jobBoardIntro);
  const jobsBusy = prose("ada-jobs-busy", labels.jobBusy);
  jobsBusy.hidden = true;
  const jobList = document.createElement("div");
  jobList.className = "ada-job-list";
  jobsCard.body.append(jobsBalance, jobsIntro, jobsBusy, jobList);
  setScrollGroup(jobsCard, jobList);

  const dropCancel = createButton(labels.jobDropCancel);
  dropCancel.dataset.action = "drop-cancel";
  const drop = createButton(labels.jobDrop, "primary");
  drop.dataset.action = "drop-job";
  const dropActions = createActions([
    { button: dropCancel, role: "secondary" },
    { button: drop, role: "primary" },
  ]);

  modal.append(stationCard.frame, shopCard.frame, jobsCard.frame);
  confirmModal.append(confirmCard.frame);
  parent.append(modal, confirmModal);

  let open = false;
  let view: StationView = "card";
  let tab: StationTab = "weapons";
  // The tabs the shop shows: Projects joins Weapons and Ship once the galaxy offers projects.
  const shownTabs = (): StationTab[] =>
    options.projectsShown() ? ["weapons", "ship", "projects"] : ["weapons", "ship"];
  let confirm: { readonly key: string } | { readonly drop: true } | null = null;

  const renderBalances = (): void => {
    const balance = options.balance();
    stationBalance.textContent = balance.text;
    shopBalance.textContent = String(balance.amount);
    jobsBalance.textContent = String(balance.amount);
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
      trailing.textContent =
        row.state === "inUse" ? labels.inUse : row.project ? labels.projectFunded : labels.owned;
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
    const ammo = rows.filter((row) => row.group === "ammo");
    const content: HTMLElement[] = [
      ...(ammo.length ? [groupElement(ammo)] : []),
      groupElement(rows.filter((row) => row.group === "items")),
    ];
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
    const tabsContent = shownTabs().map((id) => {
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

  const jobElement = (job: StationJob): HTMLButtonElement => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "ada-shop-row ada-job-row";
    node.dataset.job = job.id;
    // The held job wears the selection ring; a refused offer the disabled face.
    node.dataset.state = { busy: "unaffordable", held: "inUse", offer: "forSale" }[job.state];
    // The job type's icon-job sheet, normal then disabled; every activity shares one.
    const glyph = document.createElement("span");
    glyph.className = "ada-glyph ada-glyph-sprite ada-job-glyph";
    glyph.dataset.type = job.kind === "activity" ? "activity" : job.type;
    glyph.style.setProperty("--sheet", `url('${SPRITES}icon-job-${glyph.dataset.type}.png')`);
    glyph.setAttribute("aria-hidden", "true");
    const jobWell = document.createElement("span");
    jobWell.className = "ada-well";
    jobWell.append(glyph);
    const name = document.createElement("span");
    name.className = "ada-shop-name";
    const title = document.createElement("span");
    title.textContent = job.title;
    const detail = document.createElement("span");
    detail.className = "ada-shop-level";
    detail.textContent = job.detail;
    name.append(title, detail);
    const slot = document.createElement("span");
    slot.className = "ada-shop-slot";
    const action = document.createElement("span");
    action.className = `ada-button ada-compact ada-job-action${
      job.state === "held" ? "" : " ada-primary"
    }`;
    const mark = document.createElement("span");
    if (job.state === "held") {
      mark.className = "ada-owned";
      mark.textContent = labels.jobActive;
      action.textContent = labels.jobDrop;
    } else {
      mark.className = "ada-price";
      mark.textContent = String(job.reward);
      action.textContent = labels.jobAccept;
    }
    slot.append(mark, action);
    node.append(jobWell, name, slot);
    node.setAttribute(
      "aria-label",
      [
        job.title,
        job.detail,
        job.state === "held" ? labels.jobActive : job.rewardText,
        action.textContent,
      ].join(", "),
    );
    node.addEventListener("click", () => {
      if (jobAction(job.state) === "drop") {
        openDrop(job);
        return;
      }
      if (!options.acceptJob(job.id)) {
        jobsBusy.textContent = options.busyLine();
        jobsBusy.hidden = false;
        jobsCard.fit();
        refuse(node, options.reducedMotion());
        return;
      }
      jobsBusy.hidden = true;
      render();
      const inUse = jobList.querySelector<HTMLElement>("[data-state=inUse]");
      if (inUse) {
        focusTarget(inUse);
      }
    });
    return node;
  };

  const renderJobs = (): void => {
    jobList.replaceChildren(...options.jobs().map(jobElement));
    // Every row's compact action is one width: the widest label's (art/layout.md "Job board row").
    jobList.style.removeProperty("--job-action-width");
    const widest = Math.max(
      0,
      ...[...jobList.querySelectorAll<HTMLElement>(".ada-job-action")].map(
        (action) => action.getBoundingClientRect().width,
      ),
    );
    if (widest > 0) {
      jobList.style.setProperty("--job-action-width", units(widest / readViewUnit(jobList)));
    }
  };

  const renderShop = (): void => {
    if (!shownTabs().includes(tab)) {
      tab = "weapons";
    }
    for (const [id, button] of tabButtons) {
      button.hidden = !shownTabs().includes(id);
      button.classList.toggle("ada-primary", id === tab);
      button.setAttribute("aria-selected", String(id === tab));
    }
    list.replaceChildren(...tabContent(tab));
  };

  const render = (): void => {
    renderBalances();
    keeper.render(options.greeting());
    stationCard.frame.hidden = view !== "card";
    shopCard.frame.hidden = view !== "shop";
    jobsCard.frame.hidden = view !== "jobs";
    if (view === "shop") {
      renderShop();
      fitList();
      shopCard.fit();
    } else if (view === "jobs") {
      renderJobs();
      jobsCard.fit();
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
    parts.push(price, prose("ada-confirm-left", request.left));
    if (request.stillNeeded) {
      parts.push(prose("ada-confirm-left", request.stillNeeded));
    }
    parts.push(confirmActions);
    buy.textContent = request.action;
    confirmCard.body.replaceChildren(...parts);
    confirmModal.hidden = false;
    confirmCard.fit();
    focusTarget(buy);
  };
  // Drop asks first, naming the held job or the active activity.
  const openDrop = (job: StationJob): void => {
    confirm = { drop: true };
    const title = job.kind === "activity" ? labels.activityDrop : labels.jobDropTitle;
    confirmCard.title.textContent = title;
    confirmCard.frame.setAttribute("aria-label", title);
    confirmCard.body.replaceChildren(prose("ada-confirm-about", job.title), dropActions);
    confirmModal.hidden = false;
    confirmCard.fit();
    focusTarget(dropCancel);
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
    const left = view;
    view = step;
    jobsBusy.hidden = true;
    render();
    const target = view === "card" ? (left === "jobs" ? openJobs : openShop) : tabButtons.get(tab);
    if (target) {
      focusTarget(target);
    }
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

  openJobs.addEventListener("click", () => {
    view = "jobs";
    jobsBusy.hidden = true;
    render();
    focusTarget(jobList.querySelector<HTMLElement>("button") ?? jobsCard.close);
  });
  jobsCard.close.addEventListener("click", back);
  dropCancel.addEventListener("click", back);
  drop.addEventListener("click", () => {
    closeConfirm();
    options.dropJob();
    render();
    focusTarget(jobList.querySelector<HTMLElement>("button") ?? jobsCard.close);
  });

  undock.addEventListener("click", options.undock);
  openShop.addEventListener("click", () => {
    view = "shop";
    render();
    const tabButton = tabButtons.get(tab);
    if (tabButton) {
      focusTarget(tabButton);
    }
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
    if (pending && "key" in pending) {
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
      jobsCard.dispose();
      confirmCard.dispose();
      modal.remove();
      confirmModal.remove();
    },
    isOpen: () => open,
    /**
     * Back-stack layers: a confirm, the shop and the job board step back toward the station
     * card, and the card undocks. Register the card first so the inner cards are innermost.
     */
    layers: {
      card: { back, isOpen: () => open && view === "card" && confirm === null },
      inner: { back, isOpen: () => open && (view !== "card" || confirm !== null) },
    },
    /** Opens on the station card when docking and closes on undocking. */
    setOpen(value: boolean): void {
      if (value === open) {
        return;
      }
      open = value;
      modal.hidden = !open;
      view = "card";
      jobsBusy.hidden = true;
      closeConfirm();
      if (open) {
        render();
        focusTarget(openShop);
      }
    },
  };
}
