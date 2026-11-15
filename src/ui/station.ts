import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { CONTENT } from "../data/content.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import type { StationGreeting } from "../model/keepers.ts";
import type { StationServices } from "../model/stationServices.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { createDialoguePanel, type DialogueSpeaker } from "./dialoguePanel.ts";
import { createExchangeView, type ExchangePort } from "./exchange.ts";
import { keeperName } from "./keeperBlock.ts";
import { cardPages } from "./layout/cardPages.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import {
  CONFIRM_ITEM,
  shopColumns,
  shopListWidth,
  shopRowHeight,
  shopRowWidth,
} from "./layout/shopCard.ts";
import { STATION_SPRITES } from "./layout/stationStyle.ts";
import { SPACING } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";
import { enterPressView, inCurrentView } from "./pressScope.ts";
import { refuse } from "./refusal.ts";
import { mountStationDropDetails } from "./stationDropDetails.ts";
import { createStationItemIcon, type ItemGlyph, setStationItemTitle } from "./stationItemIcon.ts";
import { applyButtonSkin } from "./uiSkin.ts";

// The station card, the shop, the job board and their confirms (art/shop.md,
// gameplay/quests.md "Job board") on the shared card builder; every size comes from src/ui/layout
// (layout.md "Shop item row").

const SPRITES = STATION_SPRITES;

export { STATION_STYLE } from "./layout/stationStyle.ts";
export type { ItemGlyph } from "./stationItemIcon.ts";
export { weaponItemGlyph } from "./stationItemIcon.ts";

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

function well(glyph: ItemGlyph, large = false): HTMLElement {
  const node = document.createElement("span");
  node.className = large ? "ada-well ada-large" : "ada-well";
  if (large) {
    node.style.setProperty("--glyph-scale", String(CONFIRM_ITEM.glyphScale));
  }
  node.append(createStationItemIcon(glyph));
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
  let disposed = false;
  const bindings: ReturnType<typeof bindAdaAction>[] = [];
  const shopBindings: ReturnType<typeof bindAdaAction>[] = [];
  const jobBindings: ReturnType<typeof bindAdaAction>[] = [];
  const clearBindings = (group: typeof bindings) => {
    for (const binding of group.splice(0)) {
      binding.dispose();
    }
  };
  const register = (element: HTMLButtonElement, run: () => void, group = bindings) => {
    group.push(
      bindAdaAction(
        {
          click: {
            availability: () => (element.disabled ? { kind: "omitted" } : { kind: "available" }),
            run,
          },
          current: () =>
            !disposed &&
            open &&
            parent.contains(element) &&
            inCurrentView(parent, element) &&
            !element.hidden &&
            !element.closest("[hidden], [inert]"),
          slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
        },
        element,
      ),
    );
  };
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
  register(nextGreeting, () => {
    options.advanceGreeting();
    keeper.render(options.greeting());
    if (nextGreeting.hidden) {
      focusTarget(openShop);
    }
  });
  register(stationCard.skip, () => {
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

  const dropHost = document.createElement("div");
  dropHost.hidden = true;
  let dropDetails: ReturnType<typeof mountStationDropDetails> | undefined;
  let dropOrigin: HTMLElement | null = null;

  modal.append(stationCard.frame, shopCard.frame, jobsCard.frame);
  confirmModal.append(confirmCard.frame, dropHost);
  parent.append(modal, confirmModal);

  let open = false;
  let view: StationView = "card";
  let tab: StationTab | null = null;
  const shownTabs = () => stationTabs(options.services());
  let confirm: { readonly key: string } | { readonly drop: true } | null = null;
  let pressDialog: HTMLElement | undefined;
  let leavePress: (() => void) | undefined;
  const syncPressView = () => {
    const next =
      !open || disposed
        ? undefined
        : confirm
          ? confirmModal
          : view === "shop"
            ? shopCard.frame
            : view === "jobs"
              ? jobsCard.frame
              : stationCard.frame;
    if (next !== pressDialog) {
      leavePress?.();
      pressDialog = next;
      leavePress = next ? enterPressView(parent, next) : undefined;
    }
  };

  const renderBalances = (): void => {
    const balance = options.balance();
    stationBalance.textContent = balance.text;
    shopBalance.textContent = String(balance.amount);
    jobsBalance.textContent = String(balance.amount);
  };

  const rowElement = (row: StationRow, interactive = true): HTMLButtonElement => {
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
    if (interactive) {
      register(
        node,
        () => {
          if (tab === null || !shownTabs().includes(tab)) {
            render();
            return;
          }
          const liveRow = options
            .rows(tab as Exclude<StationTab, "exchange">)
            .find((item) => item.key === row.key);
          if (!liveRow) {
            render();
            return;
          }
          const action = rowAction(liveRow.state);
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
          openConfirm(liveRow, request);
        },
        shopBindings,
      );
    }
    return node;
  };

  const groupElement = (rows: readonly StationRow[]): HTMLDivElement => {
    const group = document.createElement("div");
    group.className = "ada-shop-group";
    group.append(...rows.map((row) => rowElement(row)));
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
    clearBindings(shopBindings);
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
        .flatMap((id) => options.rows(id).map((row) => rowElement(row, false))),
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
    register(
      node,
      () => {
        const services = options.services();
        const liveJob = options.jobs().find((item) => item.id === job.id);
        if (
          !liveJob ||
          !stationJobsShown(services) ||
          (liveJob.state !== "held" && !services?.jobs)
        ) {
          render();
          return;
        }
        if (jobAction(liveJob.state) === "drop") {
          openDrop(liveJob);
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
      },
      jobBindings,
    );
    return node;
  };

  const renderJobs = (): void => {
    clearBindings(jobBindings);
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
    syncPressView();
  };

  for (const [pager, kind] of [
    [shopPager, "shop"],
    [jobsPager, "jobs"],
  ] as const) {
    for (const [button, direction] of [
      [pager.previous, -1],
      [pager.next, 1],
    ] as const) {
      register(button, () => {
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
    confirmCard.frame.hidden = false;
    dropHost.hidden = true;
    setStationItemTitle(row.glyph, request.title, confirmCard.title);
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
    syncPressView();
    confirmCard.fit();
    focusTarget(buy);
  };
  // Drop asks first, naming the held job or the active activity.
  const openDrop = (job: StationJob): void => {
    confirm = { drop: true };
    dropOrigin =
      [...jobList.querySelectorAll<HTMLElement>(".ada-job-row")].find(
        (row) => row.dataset.job === job.id,
      ) ?? null;
    const title = job.kind === "activity" ? labels.activityDrop : labels.jobDropTitle;
    const data = {
      cancelLabel: labels.jobDropCancel,
      closeLabel: labels.close,
      dropLabel: labels.jobDrop,
      subject: job.title,
      title,
    };
    if (dropDetails) {
      dropDetails.update(data);
    } else {
      dropDetails = mountStationDropDetails(
        {
          active: () => open && !disposed && confirm !== null && "drop" in confirm,
          artReady: applyButtonSkin(parent),
          availability: () =>
            stationJobsShown(options.services())
              ? { kind: "available" }
              : { kind: "unavailable", reason: options.busyLine() },
          onCancel: () => {
            const origin = dropOrigin;
            back();
            if (origin?.isConnected && !origin.closest("[hidden]")) {
              focusTarget(origin);
            }
          },
          onDrop: () => {
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
          },
        },
        dropHost,
        data,
      );
    }
    confirmCard.frame.hidden = true;
    dropHost.hidden = false;
    confirmModal.hidden = false;
    syncPressView();
    void dropDetails.settle().then(
      () => {
        if (!disposed && !confirmModal.hidden && confirm && "drop" in confirm) {
          dropDetails?.focusCancel();
        }
      },
      () => {
        // Failed art readiness leaves physical inspection unavailable.
      },
    );
  };
  const closeConfirm = (): void => {
    confirm = null;
    confirmModal.hidden = true;
    dropHost.hidden = true;
    dropOrigin = null;
    syncPressView();
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

  register(openJobs, () => {
    if (!stationJobsShown(options.services())) {
      return;
    }
    view = "jobs";
    jobsPage = 0;
    jobsBusy.hidden = true;
    render();
    focusTarget(jobList.querySelector<HTMLElement>("button") ?? jobsCard.close);
  });
  register(jobsCard.close, back);

  register(undock, options.undock);
  register(openShop, () => {
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
    register(button, () => {
      if (!shownTabs().includes(id)) {
        return;
      }
      exchange.back();
      tab = id;
      shopPage = 0;
      render();
    });
  }
  register(stationCard.close, back);
  register(shopCard.close, back);
  register(confirmCard.close, back);
  register(cancel, back);
  register(buy, () => {
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
      if (disposed) {
        return;
      }
      disposed = true;
      leavePress?.();
      leavePress = undefined;
      clearBindings(bindings);
      clearBindings(shopBindings);
      clearBindings(jobBindings);
      window.removeEventListener("resize", refit);
      window.removeEventListener(VIEW_SCALE_EVENT, refit);
      exchange?.dispose();
      stationCard.dispose();
      shopCard.dispose();
      jobsCard.dispose();
      confirmCard.dispose();
      dropDetails?.dispose();
      dropOrigin = null;
      modal.remove();
      confirmModal.remove();
    },
    inspectDetails: (viewport: import("@andornaut/game-kit/rect").Rect) =>
      dropDetails?.inspect(viewport) ?? null,
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
    settleDetails: () => dropDetails?.settle() ?? Promise.resolve(),
  };
}
