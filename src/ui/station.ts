import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CONTENT } from "../data/content.ts";
import type { UpgradeWeapon } from "../data/economy.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import type { StationGreeting } from "../model/keepers.ts";
import type { StationServices } from "../model/stationServices.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { createDialoguePanel, type DialogueSpeaker } from "./dialoguePanel.ts";
import { createExchangeView, type ExchangePort } from "./exchange.ts";
import { keeperName } from "./keeperBlock.ts";
import { cardPages } from "./layout/cardPages.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import { frameSize } from "./layout/frameBox.ts";
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
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import { refuse } from "./refusal.ts";
import { mountStationDropDetails } from "./stationDropDetails.ts";
import { createStationItemIcon, type ItemGlyph } from "./stationItemIcon.ts";
import { type StationJobRowSchema, stationJobRowTree } from "./stationJobsTree.ts";
import {
  type StationMenuButton,
  type StationMenuSchema,
  stationMenuTree,
} from "./stationMenuTree.ts";
import { type StationPagerSchema, stationPagerTree } from "./stationPagerTree.ts";
import {
  type StationShopRowSchema,
  stationShopRowTree,
  type StationShopSchema,
  stationShopTree,
} from "./stationShopTree.ts";
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
  readonly communityProjects: string;
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
  readonly jobsProjects: string;
  /** The keeper block's name while it shows the next line. */
  readonly continue: string;
  readonly owned: string;
  readonly projectFunded: string;
  readonly shipPaint: string;
  readonly shop: string;
  readonly shopShip: string;
  readonly shopWeapons: string;
  readonly station: string;
  readonly stationWelcome: string;
  readonly undock: string;
}

export type StationTab = "ship" | "weapons";
type StationCatalog = StationTab | "projects";

/** Visible shop tabs come only from the docked station's authoritative capabilities. */
export function stationTabs(services: StationServices | null): readonly StationTab[] {
  return services === null
    ? []
    : [
        ...(services.weaponsAmmo ? ["weapons" as const] : []),
        ...(services.equipment ? ["ship" as const] : []),
      ];
}

/** Held tasks remain accessible for Drop at every station. */
export function stationJobsShown(services: StationServices | null): boolean {
  return services !== null && (services.jobs || services.heldTask || services.projects);
}

/** The station's cards: the station card, the shop and the job board. */
export type StationView = "card" | "shop" | "jobs" | "exchange";

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
  readonly projectDetails?: string;
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
  readonly requiresWeapon?: UpgradeWeapon;
  readonly reason?: string;
  readonly state: StationRowState;
}

export type StationRequest =
  | {
      readonly about: string;
      /** The primary action's label: Buy, or Accept for a project. */
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
    title,
  };
}

export interface StationOptions {
  /** Accept takes an offer at once; false refuses it while Ada holds a job. */
  readonly acceptJob: (id: string) => boolean;
  /** Why Accept refuses while the galaxy's slot is taken: a job or an activity holds it. */
  readonly busyLine: () => string;
  readonly balance: () => { readonly ore: number; readonly stardust: number };
  readonly buy: (key: string) => void;
  readonly exchange: ExchangePort;
  readonly dropJob: () => void;
  /** The docked station keeper's line on show, or null for the generic welcome. */
  readonly greeting: () => StationGreeting | null;
  readonly jobs: () => readonly StationJob[];
  readonly labels: StationLabels;
  readonly reducedMotion: () => boolean;
  readonly request: (key: string) => StationRequest;
  readonly rows: (tab: StationCatalog) => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly services: () => StationServices | null;
  readonly stationTitle: () => string | undefined;
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

/** Which decision the selected job details present. */
export function jobAction(state: StationJob["state"]): "accept" | "drop" {
  return state === "held" ? "drop" : "accept";
}

/** Job projection keeps an active row and reserves the offer slots needed by projects. */
export function stationJobsRows(
  jobs: readonly StationJob[],
  services: StationServices | null,
  projects: readonly StationRow[],
): StationJob[] {
  const active = jobs.filter((job) => job.state === "held");
  if (!services?.jobs) {
    return active;
  }
  const projectOffers = projects.filter((project) => project.state !== "owned").length;
  const room = Math.min(4 - active.length, 4 - projectOffers);
  return [...active, ...jobs.filter((job) => job.state !== "held").slice(0, Math.max(0, room))];
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
  const audit = (scope: HTMLElement) => {
    try {
      assertAdaActionMetadata(scope);
      if (scope.isConnected) {
        assertAdaActionBindings(scope);
      }
    } catch (error) {
      scope.hidden = true;
      throw error;
    }
  };
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
  stationCard.skip.remove();
  const balances = document.createElement("div");
  balances.className = "ada-station-balances";
  const balanceParts = {
    ore: document.createElement("span"),
    stardust: document.createElement("span"),
  };
  for (const key of ["stardust", "ore"] as const) {
    const part = balanceParts[key];
    part.dataset.balance = key;
    balances.append(part);
  }
  const footer = document.createElement("footer");
  footer.className = "ada-station-footer";
  const menuButtons = new Map<StationMenuButton, HTMLButtonElement>();
  const menuLayout = mountLayout<StationMenuSchema>(
    {
      components: {
        button: {
          create(initial) {
            const button = createButton(initial.label, initial.role);
            if (initial.actionId !== undefined) {
              button.dataset.action = initial.actionId;
            }
            menuButtons.set(initial.id, button);
            return {
              dispose() {},
              element: button,
              slots: {},
              update(data) {
                button.textContent = data.label;
              },
            };
          },
          slots: [],
        },
        stationMenu: {
          create() {
            return {
              dispose() {},
              element: footer,
              slots: { controls: footer },
              update() {},
            };
          },
          slots: ["controls"],
        },
      },
      host: document.createElement("div"),
    },
    stationMenuTree({ ...labels, exchange: EXCHANGE_COPY.title }),
  );
  const undock = menuButtons.get("undock")!;
  const openShop = menuButtons.get("shop")!;
  const openJobs = menuButtons.get("jobs")!;
  const openExchange = menuButtons.get("exchange")!;
  const focusWelcome = () =>
    focusTarget(!openShop.hidden ? openShop : !openJobs.hidden ? openJobs : openExchange);

  const shopCard = createCard({
    closeAction: "shop-back",
    closeLabel: labels.close,
    size: "large",
    title: labels.shop,
  });
  shopCard.card.dataset.dialog = "shop";
  shopCard.frame.hidden = true;
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
  shopCard.body.append(tabs, list);
  const exchangeCard = createCard({
    closeAction: "exchange-back",
    closeLabel: labels.close,
    size: "large",
    title: EXCHANGE_COPY.title,
  });
  exchangeCard.card.dataset.dialog = "exchange";
  exchangeCard.frame.hidden = true;
  const exchange = createExchangeView(exchangeCard.body, options.exchange, () => render());

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
    title: labels.jobsProjects,
  });
  jobsCard.card.dataset.dialog = "jobs";
  jobsCard.frame.hidden = true;
  const jobList = document.createElement("div");
  jobList.className = "ada-job-list";
  const projectList = document.createElement("div");
  projectList.className = "ada-station-projects";
  const jobsPanes = document.createElement("div");
  jobsPanes.className = "ada-station-panes";
  const jobsPane = document.createElement("section");
  const projectsPane = document.createElement("section");
  for (const [pane, label] of [
    [jobsPane, labels.jobs],
    [projectsPane, labels.communityProjects],
  ] as const) {
    const heading = document.createElement("h3");
    heading.textContent = label;
    pane.append(heading);
  }
  jobsPane.append(jobList);
  projectsPane.append(projectList);
  jobsPanes.append(jobsPane, projectsPane);
  jobsCard.body.append(jobsPanes);

  const pagerLayouts: ReturnType<typeof mountLayout<StationPagerSchema>>[] = [];
  const makePager = (host: HTMLElement) => {
    const node = document.createElement("div");
    node.className = "ada-station-pager";
    let previous!: HTMLButtonElement;
    let next!: HTMLButtonElement;
    let count!: HTMLParagraphElement;
    pagerLayouts.push(
      mountLayout<StationPagerSchema>(
        {
          components: {
            button: {
              create(initial) {
                const button = createButton(initial.label);
                button.classList.add(`ada-station-${initial.direction}`);
                if (initial.direction === "previous") {
                  previous = button;
                } else {
                  next = button;
                }
                return {
                  dispose() {},
                  element: button,
                  slots: {},
                  update(data) {
                    button.textContent = data.label;
                  },
                };
              },
              slots: [],
            },
            count: {
              create() {
                count = document.createElement("p");
                count.setAttribute("role", "status");
                count.setAttribute("aria-live", "polite");
                return { dispose() {}, element: count, slots: {}, update() {} };
              },
              slots: [],
            },
            pager: {
              create() {
                return { dispose() {}, element: node, slots: { controls: node }, update() {} };
              },
              slots: ["controls"],
            },
          },
          host,
        },
        stationPagerTree({
          next: CONTENT.labels.next ?? "",
          previous: CONTENT.labels.previous ?? "",
        }),
      ),
    );
    return { count, next, node, pages: 1, previous };
  };
  const shopPager = makePager(shopCard.body);
  let shopPage = 0;

  const focusPage = (
    parts: Pick<typeof shopCard, "close">,
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
    parts: Pick<typeof shopCard, "close" | "fit" | "frame"> & { readonly body: HTMLElement },
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
      row.style.height = units(shopRowHeight(frameSize(name).height / unit));
    }
    const heights = chunks.map((chunk) => frameSize(chunk).height / unit);
    const room = () => {
      const children = [...parts.body.children].filter(
        (child) => child instanceof HTMLElement && !child.hidden,
      );
      const others = children
        .filter((child) => child !== group)
        .reduce((total, child) => total + frameSize(child).height / unit, 0);
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
    try {
      for (const chunk of chunks) {
        audit(chunk);
      }
      audit(parts.frame);
    } catch (error) {
      parts.frame.hidden = true;
      throw error;
    }
    if (restoreFocus) {
      focusPage(parts, group, pager, pager.node.contains(focused) ? focused : undefined);
    }
    return currentPage;
  };

  const dropHost = document.createElement("div");
  dropHost.hidden = true;
  let dropDetails: ReturnType<typeof mountStationDropDetails> | undefined;
  let dropOrigin: HTMLElement | null = null;

  const views = { card: stationCard, exchange: exchangeCard, jobs: jobsCard, shop: shopCard };
  for (const parts of Object.values(views)) {
    parts.card.classList.add("ada-station-page");
    modal.append(parts.frame);
  }
  stationCard.card.append(balances, footer);
  confirmModal.append(confirmCard.frame, dropHost);
  parent.append(modal, confirmModal);
  const stationLayer = createModalLayer(modal);
  const confirmationLayer = createModalLayer(confirmModal);

  let open = false;
  let view: StationView = "card";
  let tab: StationTab | null = null;
  const shownTabs = () => stationTabs(options.services());
  let confirm:
    | {
        readonly catalog: StationCatalog;
        readonly key: string;
        readonly origin: HTMLElement;
        readonly projectAmount?: number;
      }
    | { readonly job: string; readonly origin: HTMLElement }
    | { readonly drop: true }
    | null = null;
  let pressDialog: HTMLElement | undefined;
  let confirmationDialog: HTMLElement | undefined;
  let leavePress: (() => void) | undefined;
  let leaveConfirmation: (() => void) | undefined;
  const syncPressView = () => {
    const next = open && !disposed ? views[view].frame : undefined;
    const nextConfirmation =
      !open || disposed || !confirm
        ? undefined
        : "drop" in confirm
          ? (dropHost.querySelector<HTMLElement>(".ada-card-frame") ?? undefined)
          : confirmCard.frame;
    if (next !== pressDialog) {
      if (next) {
        audit(next);
      }
      leaveConfirmation?.();
      leaveConfirmation = undefined;
      confirmationDialog = undefined;
      leavePress?.();
      pressDialog = next;
      leavePress = next
        ? stationLayer.open({ backdrop: modal, close: () => back(), isolation: "dialog" }, next)
        : undefined;
    }
    if (nextConfirmation !== confirmationDialog) {
      if (nextConfirmation === confirmCard.frame) {
        audit(nextConfirmation);
      }
      leaveConfirmation?.();
      confirmationDialog = nextConfirmation;
      leaveConfirmation = nextConfirmation
        ? confirmationLayer.open(
            { backdrop: confirmModal, close: () => back(), isolation: "dialog" },
            nextConfirmation,
          )
        : undefined;
    }
  };

  const renderBalances = (): void => {
    const balance = options.balance();
    for (const key of ["stardust", "ore"] as const) {
      const part = balanceParts[key];
      part.textContent = String(balance[key]);
      part.setAttribute("aria-label", `${balance[key]} ${CONTENT.labels[key]}`);
    }
  };

  const shopLayouts: { dispose(): void }[] = [];
  const rowElement = (row: StationRow, interactive = true): HTMLButtonElement => {
    const node = document.createElement("button");
    const host = document.createElement("div");
    const layout = mountLayout<StationShopRowSchema>(
      {
        components: {
          name: {
            create(initial) {
              const name = document.createElement("span");
              name.className = "ada-shop-name";
              const title = document.createElement("span");
              title.textContent = initial.title;
              name.append(title);
              if (initial.level) {
                const level = document.createElement("span");
                level.className = "ada-shop-level";
                level.textContent = initial.level;
                name.append(level);
              }
              if (initial.reason) {
                const reason = document.createElement("span");
                reason.className = "ada-shop-level";
                reason.textContent = initial.reason;
                name.append(reason);
              }
              return { dispose() {}, element: name, slots: {}, update() {} };
            },
            slots: [],
          },
          row: {
            create(initial) {
              node.type = "button";
              node.className = "ada-shop-row";
              node.dataset.item = initial.id;
              node.dataset.state = initial.state;
              node.disabled =
                initial.requiresWeapon !== undefined ||
                (row.project === true && row.state === "owned");
              node.setAttribute("aria-disabled", String(node.disabled));
              node.setAttribute("aria-label", initial.ariaLabel);
              return { dispose() {}, element: node, slots: { parts: node }, update() {} };
            },
            slots: ["parts"],
          },
          trailing: {
            create(initial) {
              const slot = document.createElement("span");
              slot.className = "ada-shop-slot";
              const trailing = document.createElement("span");
              trailing.className = initial.className;
              trailing.textContent = initial.text;
              slot.append(trailing);
              return { dispose() {}, element: slot, slots: {}, update() {} };
            },
            slots: [],
          },
          well: {
            create(initial) {
              return { dispose() {}, element: well(initial.glyph), slots: {}, update() {} };
            },
            slots: [],
          },
        },
        host,
      },
      stationShopRowTree(labels, row),
    );
    (row.project ? jobLayouts : shopLayouts).push(layout);
    if (interactive) {
      register(
        node,
        () => {
          const catalog = row.project ? "projects" : tab;
          if (
            catalog === null ||
            (catalog === "projects"
              ? !options.services()?.projects
              : !shownTabs().includes(catalog))
          ) {
            render();
            return;
          }
          const liveRow = options.rows(catalog).find((item) => item.key === row.key);
          if (!liveRow) {
            render();
            return;
          }
          if (liveRow.project) {
            openProject(liveRow, node);
            return;
          }
          if (liveRow.requiresWeapon !== undefined) {
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
          openConfirm(liveRow, request, catalog, node);
        },
        row.project ? jobBindings : shopBindings,
      );
    }
    return node;
  };

  const tabContent = (id: StationTab, columns: number): HTMLElement[] => {
    const rows = options.rows(id);
    const chunks: HTMLElement[] = [];
    for (const tree of stationShopTree({ columns, paintHeading: labels.shipPaint }, rows)) {
      let chunk!: HTMLDivElement;
      shopLayouts.push(
        mountLayout<StationShopSchema>(
          {
            components: {
              group: {
                create(initial) {
                  const group = document.createElement("div");
                  group.className = "ada-shop-group";
                  group.append(...initial.indices.map((index) => rowElement(rows[index]!)));
                  chunk = group;
                  if (initial.heading !== null) {
                    const block = document.createElement("div");
                    block.className = "ada-shop-paint";
                    const heading = document.createElement("div");
                    heading.className = "ada-paint-heading";
                    heading.textContent = initial.heading;
                    block.append(heading, group);
                    chunk = block;
                  }
                  return { dispose() {}, element: chunk, slots: {}, update() {} };
                },
                slots: [],
              },
            },
            host: document.createElement("div"),
          },
          tree,
        ),
      );
      chunks.push(chunk);
    }
    return chunks;
  };

  // Measure the complete catalogs at natural widths, then bound rows before measuring heights.
  const fitListContent = (): void => {
    clearBindings(shopBindings);
    list.hidden = tab === null;
    if (tab === null) {
      shopPager.node.hidden = true;
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
      ...shownTabs().flatMap((id) => options.rows(id).map((row) => rowElement(row, false))),
    );
    card.append(measure);
    const widest = (selector: string) =>
      Math.max(
        0,
        ...[...measure.querySelectorAll<HTMLElement>(selector)].map(
          (node) => frameSize(node).width / unit,
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

  const fitList = (): void => {
    const previousLayouts = shopLayouts.splice(0);
    fitListContent();
    for (const layout of previousLayouts) {
      layout.dispose();
    }
  };

  const jobLayouts: { dispose(): void }[] = [];
  const jobElement = (job: StationJob): HTMLButtonElement => {
    const node = document.createElement("button");
    const host = document.createElement("div");
    jobLayouts.push(
      mountLayout<StationJobRowSchema>(
        {
          components: {
            mark: {
              create(initial) {
                const slot = document.createElement("span");
                slot.className = "ada-shop-slot";
                const mark = document.createElement("span");
                mark.className = initial.className;
                mark.textContent = initial.text;
                slot.append(mark);
                return { dispose() {}, element: slot, slots: {}, update() {} };
              },
              slots: [],
            },
            name: {
              create(initial) {
                const name = document.createElement("span");
                name.className = "ada-shop-name";
                const title = document.createElement("span");
                title.textContent = initial.title;
                const detail = document.createElement("span");
                detail.className = "ada-shop-level";
                detail.textContent = initial.detail;
                name.append(title, detail);
                return { dispose() {}, element: name, slots: {}, update() {} };
              },
              slots: [],
            },
            row: {
              create(initial) {
                node.type = "button";
                node.className = "ada-shop-row ada-job-row";
                node.dataset.job = initial.id;
                node.dataset.state = initial.state;
                node.setAttribute("aria-label", initial.ariaLabel);
                return { dispose() {}, element: node, slots: { parts: node }, update() {} };
              },
              slots: ["parts"],
            },
            well: {
              create(initial) {
                const glyph = document.createElement("span");
                glyph.className = "ada-glyph ada-glyph-sprite ada-job-glyph";
                glyph.dataset.type = initial.glyphType;
                glyph.style.setProperty(
                  "--sheet",
                  `url('${SPRITES}icon-job-${glyph.dataset.type}.png')`,
                );
                glyph.setAttribute("aria-hidden", "true");
                const jobWell = document.createElement("span");
                jobWell.className = "ada-well";
                jobWell.append(glyph);
                return { dispose() {}, element: jobWell, slots: {}, update() {} };
              },
              slots: [],
            },
          },
          host,
        },
        stationJobRowTree(labels, job),
      ),
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
          openDrop(liveJob, node);
        } else {
          openJob(liveJob, node);
        }
      },
      jobBindings,
    );
    return node;
  };

  const renderJobs = (): void => {
    const services = options.services();
    const projects = services?.projects ? options.rows("projects") : [];
    projectsPane.hidden = !services?.projects;
    const previousBindings = jobBindings.splice(0);
    const previousLayouts = jobLayouts.splice(0);
    try {
      const rows = stationJobsRows(options.jobs(), services, projects).map(jobElement);
      const projectRows = projects.map((row) => rowElement(row));
      for (const row of [...rows, ...projectRows]) {
        audit(row);
      }
      jobList.replaceChildren(...rows);
      projectList.replaceChildren(...projectRows);
      audit(jobsCard.frame);
    } catch (error) {
      jobsCard.frame.hidden = true;
      clearBindings(jobBindings);
      for (const layout of jobLayouts.splice(0)) {
        layout.dispose();
      }
      throw error;
    } finally {
      clearBindings(previousBindings);
      for (const layout of previousLayouts) {
        layout.dispose();
      }
    }
  };

  const focusJobs = (id?: string): void => {
    const rows = [
      ...jobList.querySelectorAll<HTMLElement>("button"),
      ...projectList.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((row) => !row.matches(":disabled"));
    focusTarget(
      rows.find((row) => (row.dataset.job ?? row.dataset.item) === id) ?? rows[0] ?? openJobs,
    );
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
    const welcome = stationWelcome(options.stationTitle() ?? labels.station, options.greeting());
    stationCard.title.textContent = welcome.title;
    stationCard.title.hidden = false;
    stationCard.frame.setAttribute("aria-label", welcome.title);
    stationCard.showLine(welcome.speaker, welcome.text);
    openShop.hidden = shownTabs().length === 0;
    openJobs.hidden = !stationJobsShown(options.services());
    if ((view === "shop" && openShop.hidden) || (view === "jobs" && openJobs.hidden)) {
      closeConfirm();
      view = "card";
    }
    renderBalances();
    for (const [id, parts] of Object.entries(views)) {
      parts.frame.hidden = id !== view;
    }
    for (const [id, button] of menuButtons) {
      button.setAttribute("aria-current", id === view ? "page" : "false");
    }
    const parts = views[view];
    if (footer.parentElement !== parts.card) {
      parts.card.append(balances, footer);
    }
    if (view === "shop") {
      renderShop();
      fitList();
    } else if (view === "jobs") {
      renderJobs();
    } else if (view === "exchange") {
      exchange.render();
    }
    parts.fit();
    syncPressView();
  };

  for (const [button, direction] of [
    [shopPager.previous, -1],
    [shopPager.next, 1],
  ] as const) {
    register(button, () => {
      if (button.hidden || shopPager.node.hidden) {
        return;
      }
      shopPage += direction;
      render();
      focusPage(shopCard, list, shopPager, button);
    });
  }

  const showConfirmation = (title: string, parts: readonly HTMLElement[], action: string): void => {
    confirmCard.frame.hidden = false;
    dropHost.hidden = true;
    confirmCard.title.textContent = title;
    confirmCard.frame.setAttribute("aria-label", title);
    buy.textContent = action;
    confirmCard.body.replaceChildren(...parts, confirmActions);
    audit(confirmCard.frame);
    confirmModal.hidden = false;
    syncPressView();
    confirmCard.fit();
    focusTarget(buy);
  };
  const openConfirm = (
    row: StationRow,
    request: Extract<StationRequest, { kind: "confirm" }>,
    catalog: StationCatalog,
    origin: HTMLElement,
  ) => {
    confirm = {
      catalog,
      key: row.key,
      origin,
      ...(catalog === "projects" ? { projectAmount: request.price } : {}),
    };
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
    showConfirmation(request.title, parts, request.action);
  };

  const openJob = (job: StationJob, origin: HTMLElement): void => {
    confirm = { job: job.id, origin };
    const parts = [
      prose("ada-confirm-about", job.detail),
      prose("ada-confirm-left", job.rewardText),
    ];
    if (job.state === "busy") {
      const busy = prose("ada-confirm-about", options.busyLine());
      busy.setAttribute("role", "status");
      parts.push(busy);
    }
    showConfirmation(job.title, parts, labels.jobAccept);
  };

  const openProject = (row: StationRow, origin: HTMLElement): void => {
    if (row.state === "owned") {
      return;
    }
    const request = options.request(row.key);
    if (request.kind === "confirm") {
      openConfirm(row, request, "projects", origin);
      return;
    }
    confirm = { catalog: "projects", key: row.key, origin };
    const parts = [
      well(row.glyph, true),
      prose("ada-confirm-about", row.projectDetails ?? row.level),
      prose("ada-confirm-price", String(row.price ?? 0)),
    ];
    showConfirmation(row.name, parts, labels.jobAccept);
  };

  // Drop asks first, naming the held job or the active activity.
  const openDrop = (job: StationJob, origin: HTMLElement): void => {
    confirm = { drop: true };
    dropOrigin = origin;
    const title = job.kind === "activity" ? labels.activityDrop : labels.jobDropTitle;
    const data = {
      cancelLabel: labels.jobDropCancel,
      closeLabel: labels.close,
      detail: job.detail,
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
            stationJobsShown(options.services()) &&
            options.jobs().some((job) => job.state === "held")
              ? { kind: "available" }
              : { kind: "unavailable", reason: options.busyLine() },
          onCancel: back,
          onDrop: () => {
            const id = dropOrigin?.dataset.job;
            closeConfirm();
            if (
              !stationJobsShown(options.services()) ||
              !options.jobs().some((row) => row.id === id && row.state === "held")
            ) {
              render();
              return;
            }
            options.dropJob();
            render();
            if (view === "jobs") {
              focusJobs(id);
            } else {
              focusTarget(openShop.hidden ? undock : openShop);
            }
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
    const step = stationBack(view, confirm !== null);
    if (step === "undock") {
      options.undock();
      return;
    }
    if (confirm) {
      const origin = "origin" in confirm ? confirm.origin : dropOrigin;
      closeConfirm();
      if (origin?.isConnected && !origin.closest("[hidden], [inert]")) {
        focusTarget(origin);
      } else if (view === "jobs") {
        focusJobs(origin?.dataset.job ?? origin?.dataset.item);
      }
      return;
    }
    const left = view;
    view = step;
    render();
    const target = left !== "card" ? menuButtons.get(left) : undock;
    if (target) {
      focusTarget(target);
    }
  };

  // The row width and columns follow the view; the card builder refits the card itself.
  const refit = (): void => {
    if (open && view === "shop" && !confirm) {
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
    render();
    focusTarget(openJobs);
  });
  register(jobsCard.close, back);
  register(openExchange, () => {
    view = "exchange";
    render();
    focusTarget(openExchange);
  });
  register(exchangeCard.close, back);

  register(undock, options.undock);
  register(openShop, () => {
    if (shownTabs().length === 0) {
      return;
    }
    view = "shop";
    render();
    focusTarget(openShop);
  });
  for (const [id, button] of tabButtons) {
    register(button, () => {
      if (!shownTabs().includes(id)) {
        return;
      }
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
    if (!pending || "drop" in pending) {
      return;
    }
    if ("job" in pending) {
      const services = options.services();
      const projects = services?.projects ? options.rows("projects") : [];
      const live = stationJobsRows(options.jobs(), services, projects).find(
        (row) => row.id === pending.job && row.state !== "held",
      );
      if (live && !options.acceptJob(live.id)) {
        if (open && view === "jobs") {
          openJob({ ...live, state: "busy" }, pending.origin);
          refuse(buy, options.reducedMotion());
        }
        return;
      }
      closeConfirm();
      if (open) {
        render();
        if (view === "jobs") {
          focusJobs(pending.job);
        }
      }
      return;
    }
    const { catalog, key } = pending;
    if (catalog === "projects") {
      const live =
        options.services()?.projects && options.rows("projects").find((row) => row.key === key);
      const request = live && options.request(key);
      if (!request || request.kind === "refused") {
        refuse(buy, options.reducedMotion());
        return;
      }
      if (live && request.price !== pending.projectAmount) {
        openConfirm(live, request, catalog, pending.origin);
        return;
      }
    }
    closeConfirm();
    const available =
      catalog === "projects" ? options.services()?.projects : shownTabs().includes(catalog);
    if (available && options.rows(catalog).some((row) => row.key === key)) {
      options.buy(key);
    }
    if (open) {
      render();
      if (catalog === "projects" && view === "jobs") {
        focusJobs(key);
        return;
      }
      const rows = [...list.querySelectorAll<HTMLButtonElement>("button")];
      focusTarget(
        rows.find((row) => row.dataset.item === key && !row.disabled) ??
          rows.find((row) => !row.disabled) ??
          (catalog === "projects" ? openJobs : openShop),
      );
    }
  });

  // A drag across a page must not activate the row where the gesture started.
  for (const group of [list, jobList, projectList]) {
    let start: { readonly pointerId: number; readonly x: number; readonly y: number } | undefined;
    let draggedPointer: number | undefined;
    let latestPointer: number | undefined;
    group.addEventListener("pointerdown", (event) => {
      latestPointer = event.pointerId;
      start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      if (draggedPointer === event.pointerId) {
        draggedPointer = undefined;
      }
    });
    group.addEventListener("pointermove", (event) => {
      if (
        start?.pointerId === event.pointerId &&
        !isTap(readViewUnit(group), start, { x: event.clientX, y: event.clientY })
      ) {
        draggedPointer = event.pointerId;
      }
    });
    group.addEventListener(
      "click",
      (event) => {
        // Legacy physical clicks can only be attributed to the latest pointer press.
        const pointerId = typeof event.pointerId === "number" ? event.pointerId : latestPointer;
        if (event.detail === 0 || draggedPointer === undefined || pointerId !== draggedPointer) {
          return;
        }
        draggedPointer = undefined;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
    for (const type of ["pointerup", "pointercancel"] as const) {
      group.addEventListener(type, (event) => {
        if (start?.pointerId === event.pointerId) {
          start = undefined;
        }
        if (type === "pointercancel" && draggedPointer === event.pointerId) {
          draggedPointer = undefined;
        }
      });
    }
  }

  const station = {
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      stationLayer.dispose();
      confirmationLayer.dispose();
      leavePress = undefined;
      leaveConfirmation = undefined;
      clearBindings(bindings);
      clearBindings(shopBindings);
      clearBindings(jobBindings);
      window.removeEventListener("resize", refit);
      window.removeEventListener(VIEW_SCALE_EVENT, refit);
      exchange.dispose();
      for (const layout of jobLayouts) {
        layout.dispose();
      }
      for (const layout of shopLayouts) {
        layout.dispose();
      }
      menuLayout.dispose();
      for (const pagerLayout of pagerLayouts) {
        pagerLayout.dispose();
      }
      stationCard.dispose();
      shopCard.dispose();
      jobsCard.dispose();
      exchangeCard.dispose();
      confirmCard.dispose();
      dropDetails?.dispose();
      dropOrigin = null;
      modal.remove();
      confirmModal.remove();
    },
    inspectDetails: (viewport: import("@andornaut/game-kit/runtime/rect").Rect) =>
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
      closeConfirm();
      if (open) {
        render();
        focusWelcome();
      }
    },
    settleDetails: () => dropDetails?.settle() ?? Promise.resolve(),
  };
  try {
    for (const scope of [
      stationCard.frame,
      shopCard.frame,
      jobsCard.frame,
      exchangeCard.frame,
      confirmCard.frame,
      confirmActions,
    ]) {
      audit(scope);
    }
  } catch (error) {
    station.dispose();
    throw error;
  }
  return station;
}
