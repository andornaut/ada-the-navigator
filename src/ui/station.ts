import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { CONTENT } from "../data/content.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import type { Weapon } from "../data/types.ts";
import { weaponShopSheet } from "../data/weaponGlyphs.ts";
import type { StationGreeting } from "../model/keepers.ts";
import type { StationServices } from "../model/stationServices.ts";
import { createDialoguePanel, type DialogueSpeaker } from "./dialoguePanel.ts";
import { createExchangeView, type ExchangePort } from "./exchange.ts";
import { keeperName } from "./keeperBlock.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { cardPages } from "./layout/cardPages.ts";
import { BUTTON_SLICE, FOCUS_RING, PILL, TEXT_BUTTON } from "./layout/controls.ts";
import { font, safeEdge, slice, units } from "./layout/css.ts";
import {
  BALANCE,
  CONFIRM_ITEM,
  EXCHANGE_FIELD,
  SHOP_ROW,
  shopColumns,
  shopListWidth,
  shopRowHeight,
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
.ada-controls .ada-dialogue-frame.ada-station-frame > .ada-story-skip{
  right:${safeEdge("right", SPACING.pageInset + CARD_CLOSE.hit.width + SPACING.gap)}
}

.ada-controls .ada-dialogue-panel[data-dialog="station"] .ada-story-tab{
  width:fit-content;
  max-width:100%;
  height:auto;
  white-space:normal;
  overflow-wrap:anywhere
}

.ada-controls .ada-exchange{
  max-width:100%;
  text-align:left
}
.ada-controls .ada-exchange label{
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:${units(SPACING.gap)}
}
.ada-controls .ada-exchange input{
  box-sizing:border-box;
  width:${units(EXCHANGE_FIELD.width)};
  max-width:100%;
  font:inherit;
  color:inherit;
  background:transparent;
  border:${units(EXCHANGE_FIELD.edge)} solid currentColor
}
.ada-controls .ada-exchange p{
  overflow-wrap:anywhere
}

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

/* Paged rows retain space for focus and selection rings. */
.ada-controls .ada-shop-list{
  box-sizing:border-box;
  display:grid;
  align-content:start;
  justify-items:center;
  gap:${units(SPACING.gap)};
  padding:${units(FOCUS_RING.outset)};
  align-self:center
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

/* The job board packs measured rows into the available width, then pages them. */
.ada-controls .ada-job-list{
  box-sizing:border-box;
  display:grid;
  grid-template-columns:1fr;
  justify-content:center;
  align-content:start;
  row-gap:${units(SHOP_ROW.rowGap)};
  padding:${units(FOCUS_RING.outset)};
  align-self:center
}
.ada-controls .ada-job-row{
  width:100%;
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
  flex:none;
  white-space:nowrap
}
.ada-controls .ada-job-page-row{
  display:grid;
  grid-template-columns:repeat(var(--shop-columns,1),var(--shop-row-width,max-content));
  column-gap:${units(SHOP_ROW.columnGap)}
}
.ada-controls .ada-station-pager{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:${units(SPACING.gap)}
}
.ada-controls .ada-station-previous{
  grid-column:1;
  grid-row:1
}
.ada-controls .ada-station-next{
  grid-column:3;
  grid-row:1
}
.ada-controls .ada-station-pager p{
  grid-column:2;
  grid-row:1;
  margin:0
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

export type StationTab = "exchange" | "projects" | "ship" | "weapons";

/** Visible shop tabs come only from the docked station's authoritative capabilities. */
export function stationTabs(services: StationServices | null): readonly StationTab[] {
  return services === null
    ? []
    : [
        ...(services.weaponsAmmo ? ["weapons" as const] : []),
        ...(services.equipment ? ["ship" as const] : []),
        ...(services.projects ? ["projects" as const] : []),
        "exchange",
      ];
}

/** Held tasks remain accessible for Drop at every station. */
export function stationJobsShown(services: StationServices | null): boolean {
  return services !== null && (services.jobs || services.heldTask);
}

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

/** A station without an authored keeper offers its menu without attributed speech. */
export function stationWelcome(
  title: string,
  greeting: StationGreeting | null,
): {
  readonly speaker: DialogueSpeaker | undefined;
  readonly text: string;
  readonly title: string;
} {
  return {
    speaker: greeting
      ? {
          displayName: greeting.displayName,
          portraitName: keeperName(greeting.keeper),
        }
      : undefined,
    text: greeting?.line ?? "",
    title: greeting ? "" : title,
  };
}

/** Skip is distinct from Next only when it advances past more than one remaining line. */
export function stationGreetingCanSkip(greeting: StationGreeting | null): boolean {
  return greeting !== null && greeting.count - greeting.index - 1 > 1;
}

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
  readonly exchange: ExchangePort;
  readonly dropJob: () => void;
  /** The docked station keeper's line on show, or null for the generic welcome. */
  readonly greeting: () => StationGreeting | null;
  readonly jobs: () => readonly StationJob[];
  readonly labels: StationLabels;
  readonly reducedMotion: () => boolean;
  readonly request: (key: string) => StationRequest;
  readonly rows: (tab: Exclude<StationTab, "exchange">) => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly services: () => StationServices | null;
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

  const stationCard = createDialoguePanel({
    closeAction: "station-back",
    closeLabel: labels.close,
    title: labels.station,
  });
  stationCard.card.dataset.dialog = "station";
  stationCard.frame.classList.add("ada-station-frame");
  const stationBalance = document.createElement("div");
  stationBalance.className = "ada-balance";
  stationBalance.dataset.inkTop = "0";
  const undock = createButton(labels.undock);
  undock.dataset.action = "undock";
  const openShop = createButton(labels.shop, "primary");
  openShop.dataset.action = "open-shop";
  const openJobs = createButton(labels.jobs);
  openJobs.dataset.action = "open-jobs";
  for (const button of [undock, openShop, openJobs]) {
    button.classList.add("ada-story-button");
  }
  const nextGreeting = createButton(labels.nextLine);
  nextGreeting.classList.add("ada-story-button");
  const keeper = {
    render(greeting: StationGreeting | null) {
      const welcome = stationWelcome(labels.station, greeting);
      stationCard.title.textContent = welcome.title;
      stationCard.title.hidden = welcome.title === "";
      stationCard.showLine(welcome.speaker, welcome.text);
      nextGreeting.hidden = !greeting || greeting.index >= greeting.count - 1;
      stationCard.skip.hidden = !stationGreetingCanSkip(greeting);
      stationCard.fit();
    },
  };
  nextGreeting.addEventListener("click", () => {
    options.advanceGreeting();
    keeper.render(options.greeting());
    if (nextGreeting.hidden) {
      focusTarget(openShop);
    }
  });
  stationCard.skip.addEventListener("click", () => {
    const initial = options.greeting();
    if (!initial || !stationGreetingCanSkip(initial)) {
      return;
    }
    for (let step = 0; step < initial.count; step++) {
      const current = options.greeting();
      if (!current || current.index >= current.count - 1) {
        break;
      }
      options.advanceGreeting();
      const next = options.greeting();
      if (!next || next.index <= current.index) {
        break;
      }
    }
    keeper.render(options.greeting());
    if (stationCard.skip.hidden) {
      focusTarget(openShop);
    }
  });
  stationCard.choices.append(stationBalance, openJobs, openShop);
  stationCard.controls.append(nextGreeting, undock);

  const shopCard = createCard({
    closeAction: "shop-back",
    closeLabel: labels.close,
    size: "large",
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
    ["exchange", EXCHANGE_COPY.title],
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
  const exchange = createExchangeView(shopCard.body, options.exchange, () => render());
  exchange.root.hidden = true;

  const confirmCard = createCard({
    closeAction: "confirm-cancel-x",
    closeLabel: labels.close,
    size: "small",
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
    size: "large",
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

  const makePager = () => {
    const node = document.createElement("div");
    node.className = "ada-station-pager";
    const previous = createButton(CONTENT.labels.previous ?? "");
    previous.classList.add("ada-station-previous");
    const count = document.createElement("p");
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");
    const next = createButton(CONTENT.labels.next ?? "");
    next.classList.add("ada-station-next");
    node.append(previous, count, next);
    return { count, next, node, pages: 1, previous };
  };
  const shopPager = makePager();
  const jobsPager = makePager();
  shopCard.body.append(shopPager.node);
  jobsCard.body.append(jobsPager.node);
  let shopPage = 0;
  let jobsPage = 0;

  const focusPage = (
    parts: typeof shopCard,
    group: HTMLElement,
    pager: typeof shopPager,
    preferred?: HTMLElement,
  ): void => {
    const action = pager.node.hidden
      ? undefined
      : [preferred, pager.previous, pager.next].find((button) => button && !button.hidden);
    focusTarget(action ?? group.querySelector<HTMLElement>("button") ?? parts.close);
  };

  // Fit actual laid-out grid rows below the fixed groups, with the pager only when needed.
  const fitPages = (
    parts: typeof shopCard,
    group: HTMLElement,
    pager: typeof shopPager,
    chunks: readonly HTMLElement[],
    page: number,
  ): number => {
    const focused =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const restoreFocus = focused && (pager.node.contains(focused) || group.contains(focused));
    pager.node.hidden = true;
    pager.previous.hidden = false;
    pager.next.hidden = false;
    group.replaceChildren(...chunks);
    parts.fit();
    const unit = readViewUnit(group);
    for (const row of group.querySelectorAll<HTMLElement>(".ada-shop-row")) {
      const name = row.querySelector<HTMLElement>(".ada-shop-name")!;
      row.style.height = units(shopRowHeight(name.getBoundingClientRect().height / unit));
    }
    const heights = chunks.map((chunk) => chunk.getBoundingClientRect().height / unit);
    const room = () => {
      const children = [...parts.body.children].filter(
        (child) => child instanceof HTMLElement && !child.hidden,
      );
      const others = children
        .filter((child) => child !== group)
        .reduce((total, child) => total + child.getBoundingClientRect().height / unit, 0);
      const end = parseFloat(getComputedStyle(parts.body, "::after").height) / unit;
      return (
        parts.body.clientHeight / unit -
        others -
        children.length * SPACING.gap -
        end -
        2 * FOCUS_RING.outset
      );
    };
    let pages = cardPages(room(), SPACING.gap, heights);
    if (pages.length > 1) {
      pager.node.hidden = false;
      pages = cardPages(room(), SPACING.gap, heights);
    }
    const currentPage = Math.min(page, pages.length - 1);
    pager.pages = pages.length;
    pager.count.textContent = (CONTENT.labels.achievementsPage ?? "")
      .replace("{page}", String(currentPage + 1))
      .replace("{pages}", String(pages.length));
    for (const [button, unavailable] of [
      [pager.previous, currentPage === 0],
      [pager.next, currentPage === pages.length - 1],
    ] as const) {
      button.hidden = unavailable;
    }
    group.replaceChildren(...pages[currentPage]!.map((index) => chunks[index]!));
    if (restoreFocus) {
      focusPage(parts, group, pager, pager.node.contains(focused) ? focused : undefined);
    }
    return currentPage;
  };

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
  let tab: StationTab | null = null;
  const shownTabs = () => stationTabs(options.services());
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
      if (tab === null || !shownTabs().includes(tab)) {
        render();
        return;
      }
      const action = rowAction(row.state);
      if (action === "select") {
        options.select(row.key);
        render();
        const selected = [...list.querySelectorAll<HTMLElement>(".ada-shop-row")].find(
          (entry) => entry.dataset.item === row.key,
        );
        if (selected) {
          focusTarget(selected);
        }
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

  const tabContent = (id: Exclude<StationTab, "exchange">, columns: number): HTMLElement[] => {
    const rows = options.rows(id);
    const chunks: HTMLElement[] = [];
    for (const kind of ["ammo", "items", "paint"] as const) {
      const entries = rows.filter((row) => row.group === kind);
      for (let index = 0; index < entries.length; index += columns) {
        const group = groupElement(entries.slice(index, index + columns));
        if (kind === "paint" && index === 0) {
          const block = document.createElement("div");
          block.className = "ada-shop-paint";
          const heading = document.createElement("div");
          heading.className = "ada-paint-heading";
          heading.textContent = labels.shipPaint;
          block.append(heading, group);
          chunks.push(block);
        } else {
          chunks.push(group);
        }
      }
    }
    return chunks;
  };

  // Measure the complete catalogs at natural widths, then bound rows before measuring heights.
  const fitList = (): void => {
    if (tab === null) {
      list.hidden = true;
      exchange.root.hidden = true;
      shopPager.node.hidden = true;
      return;
    }
    list.hidden = tab === "exchange";
    if (exchange) {
      exchange.root.hidden = tab !== "exchange";
    }
    if (tab === "exchange") {
      shopPager.node.hidden = true;
      exchange?.render();
      return;
    }
    const card = shopCard.card;
    const unit = readViewUnit(card);
    for (const name of ["--shop-row-width", "--shop-slot-width", "--shop-pill-width"]) {
      card.style.removeProperty(name);
    }
    const measure = document.createElement("div");
    measure.className = "ada-shop-measure";
    measure.append(
      ...shownTabs()
        .filter((id) => id !== "exchange")
        .flatMap((id) => options.rows(id).map(rowElement)),
    );
    card.append(measure);
    const widest = (selector: string) =>
      Math.max(
        0,
        ...[...measure.querySelectorAll<HTMLElement>(selector)].map(
          (node) => node.getBoundingClientRect().width / unit,
        ),
      );
    const pill = Math.ceil(widest(".ada-price"));
    const slot = Math.max(pill, Math.ceil(widest(".ada-owned")));
    const natural = shopRowWidth(Math.ceil(widest(".ada-shop-name")), slot);
    measure.remove();
    const available = card.clientWidth / unit;
    const row = Math.min(natural, available - 2 * SPACING.panelPadding - 2 * FOCUS_RING.outset);
    const columns = shopColumns(available, row);
    card.style.setProperty("--shop-pill-width", units(pill));
    card.style.setProperty("--shop-slot-width", units(slot));
    card.style.setProperty("--shop-row-width", units(row));
    card.style.setProperty("--shop-columns", String(columns));
    list.style.width = units(shopListWidth(columns, row) + 2 * FOCUS_RING.outset);
    shopPage = fitPages(shopCard, list, shopPager, tabContent(tab, columns), shopPage);
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
      const services = options.services();
      if (!stationJobsShown(services) || (job.state !== "held" && !services?.jobs)) {
        render();
        return;
      }
      if (jobAction(job.state) === "drop") {
        openDrop(job);
        return;
      }
      if (!options.acceptJob(job.id)) {
        jobsBusy.textContent = options.busyLine();
        jobsBusy.hidden = false;
        renderJobs();
        jobsCard.fit();
        const replacement = [...jobList.querySelectorAll<HTMLElement>(".ada-job-row")].find(
          (row) => row.dataset.job === job.id,
        );
        if (replacement) {
          focusTarget(replacement);
          refuse(replacement, options.reducedMotion());
        } else {
          focusPage(jobsCard, jobList, jobsPager);
        }
        return;
      }
      jobsBusy.hidden = true;
      jobsPage = 0;
      render();
      const inUse = jobList.querySelector<HTMLElement>("[data-state=inUse]");
      if (inUse) {
        focusTarget(inUse);
      }
    });
    return node;
  };

  const renderJobs = (): void => {
    const unit = readViewUnit(jobsCard.card);
    const measure = document.createElement("div");
    measure.className = "ada-shop-measure";
    const rows = options
      .jobs()
      .filter((job) => options.services()?.jobs || job.state === "held")
      .map(jobElement);
    measure.append(...rows);
    jobsCard.card.append(measure);
    measure.style.removeProperty("--job-action-width");
    const action = Math.max(
      0,
      ...[...measure.querySelectorAll<HTMLElement>(".ada-job-action")].map(
        (node) => node.getBoundingClientRect().width / unit,
      ),
    );
    jobList.style.setProperty("--job-action-width", units(action));
    measure.style.setProperty("--job-action-width", units(action));
    const natural = Math.max(0, ...rows.map((node) => node.getBoundingClientRect().width / unit));
    // Fit the natural list before bounding rows, so a previous card width cannot narrow names.
    jobList.style.width = units(natural + 2 * FOCUS_RING.outset);
    jobsCard.fit();
    const available = jobsCard.card.clientWidth / unit;
    const width = Math.min(natural, available - 2 * SPACING.panelPadding - 2 * FOCUS_RING.outset);
    const columns = shopColumns(available, width);
    jobList.style.setProperty("--shop-columns", String(columns));
    jobList.style.setProperty("--shop-row-width", units(width));
    jobList.style.width = units(shopListWidth(columns, width) + 2 * FOCUS_RING.outset);
    const chunks: HTMLElement[] = [];
    for (let index = 0; index < rows.length; index += columns) {
      const chunk = document.createElement("div");
      chunk.className = "ada-job-page-row";
      chunk.append(...rows.slice(index, index + columns));
      chunks.push(chunk);
    }
    measure.remove();
    jobsPage = fitPages(jobsCard, jobList, jobsPager, chunks, jobsPage);
  };

  const renderShop = (): void => {
    const available = shownTabs();
    if (tab === null || !available.includes(tab)) {
      tab = available[0] ?? null;
    }
    for (const [id, button] of tabButtons) {
      button.hidden = !shownTabs().includes(id);
      button.classList.toggle("ada-primary", id === tab);
      button.setAttribute("aria-selected", String(id === tab));
    }
  };

  const render = (): void => {
    openShop.hidden = shownTabs().length === 0;
    openJobs.hidden = !stationJobsShown(options.services());
    if ((view === "shop" && openShop.hidden) || (view === "jobs" && openJobs.hidden)) {
      closeConfirm();
      view = "card";
    }
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

  for (const [pager, kind] of [
    [shopPager, "shop"],
    [jobsPager, "jobs"],
  ] as const) {
    for (const [button, direction] of [
      [pager.previous, -1],
      [pager.next, 1],
    ] as const) {
      button.addEventListener("click", () => {
        if (button.hidden || pager.node.hidden) {
          return;
        }
        if (kind === "shop") {
          shopPage += direction;
        } else {
          jobsPage += direction;
        }
        render();
        focusPage(
          kind === "shop" ? shopCard : jobsCard,
          kind === "shop" ? list : jobList,
          pager,
          button,
        );
      });
    }
  }

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
    if (view === "shop" && tab === "exchange" && exchange?.back()) {
      return;
    }
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
    const target =
      view === "card"
        ? left === "jobs" && !openJobs.hidden
          ? openJobs
          : openShop.hidden
            ? undock
            : openShop
        : tab === null
          ? undefined
          : tabButtons.get(tab);
    if (target) {
      focusTarget(target);
    }
  };

  // The row width and columns follow the view; the card builder refits the card itself.
  const refit = (): void => {
    if (open && view !== "card") {
      render();
    }
  };
  window.addEventListener("resize", refit);
  window.addEventListener(VIEW_SCALE_EVENT, refit);

  openJobs.addEventListener("click", () => {
    if (!stationJobsShown(options.services())) {
      return;
    }
    view = "jobs";
    jobsPage = 0;
    jobsBusy.hidden = true;
    render();
    focusTarget(jobList.querySelector<HTMLElement>("button") ?? jobsCard.close);
  });
  jobsCard.close.addEventListener("click", back);
  dropCancel.addEventListener("click", back);
  drop.addEventListener("click", () => {
    closeConfirm();
    if (!stationJobsShown(options.services())) {
      render();
      return;
    }
    options.dropJob();
    render();
    focusTarget(
      view === "jobs"
        ? (jobList.querySelector<HTMLElement>("button") ?? jobsCard.close)
        : openShop.hidden
          ? undock
          : openShop,
    );
  });

  undock.addEventListener("click", options.undock);
  openShop.addEventListener("click", () => {
    if (shownTabs().length === 0) {
      return;
    }
    view = "shop";
    render();
    const tabButton = tab === null ? undefined : tabButtons.get(tab);
    if (tabButton) {
      focusTarget(tabButton);
    }
  });
  for (const [id, button] of tabButtons) {
    button.addEventListener("click", () => {
      if (!shownTabs().includes(id)) {
        return;
      }
      exchange.back();
      tab = id;
      shopPage = 0;
      render();
    });
  }
  stationCard.close.addEventListener("click", back);
  shopCard.close.addEventListener("click", back);
  confirmCard.close.addEventListener("click", back);
  cancel.addEventListener("click", back);
  buy.addEventListener("click", () => {
    const pending = confirm;
    const available = tab !== null && shownTabs().includes(tab);
    closeConfirm();
    if (pending && "key" in pending && available) {
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

  // A drag across a page must not activate the row where the gesture started.
  for (const group of [list, jobList]) {
    let start: { readonly x: number; readonly y: number } | undefined;
    let moved = false;
    group.addEventListener("pointerdown", (event) => {
      start = { x: event.clientX, y: event.clientY };
      moved = false;
    });
    group.addEventListener("pointermove", (event) => {
      if (start && !isTap(readViewUnit(group), start, { x: event.clientX, y: event.clientY })) {
        moved = true;
      }
    });
    group.addEventListener(
      "click",
      (event) => {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
        }
        moved = false;
        start = undefined;
      },
      true,
    );
    for (const type of ["pointerup", "pointercancel"] as const) {
      group.addEventListener(type, () => {
        start = undefined;
      });
    }
  }

  return {
    dispose(): void {
      window.removeEventListener("resize", refit);
      window.removeEventListener(VIEW_SCALE_EVENT, refit);
      exchange?.dispose();
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
      exchange?.back();
      jobsBusy.hidden = true;
      closeConfirm();
      if (open) {
        render();
        focusTarget(openShop.hidden ? (openJobs.hidden ? undock : openJobs) : openShop);
      }
    },
  };
}
