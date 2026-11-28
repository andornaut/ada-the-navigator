import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CONTENT } from "../../data/content.ts";
import type { UpgradeWeapon } from "../../data/economy.ts";
import { EXCHANGE_COPY } from "../../data/exchangeCopy.ts";
import { TASK_COLORS } from "../../data/taskCategories.ts";
import type { StationGreeting } from "../../model/keepers.ts";
import { fill } from "../../model/shop.ts";
import type { StationServices } from "../../model/stations/commerce/index.ts";
import {
  ADA_ACTION_HOLD_MS,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  inCurrentView,
} from "../actions/index.ts";
import { createDialoguePanel, type DialogueSpeaker } from "../conversation/index.ts";
import { createExchangeView, type ExchangePort } from "../exchange/index.ts";
import {
  type ItemDetail,
  itemDetailName,
  itemDetailProse,
  renderItemDetailHeader,
} from "../itemDetailContent.ts";
import { keeperName } from "../keeperBlock.ts";
import { CONFIRM_ITEM, SCROLL } from "../layout/index.ts";
import { readViewUnit } from "../layoutDom/index.ts";
import { createActions, createCard, isTap } from "../modal.ts";
import { createStandardCloseAction } from "../modalClose.ts";
import { createModalLayer } from "../modalLayer.ts";
import { refuse } from "../refusal.ts";
import { createStandardTextAction } from "../standardTextAction.ts";
import { applyButtonSkin } from "../uiSkin.ts";
import { mountStationDropDetails } from "./stationDropDetails.ts";
import { createStationItemIcon, type ItemGlyph } from "./stationItemIcon.ts";
import { type StationJobRowSchema, stationJobRowTree } from "./stationJobsTree.ts";
import {
  type StationMenuButton,
  type StationMenuSchema,
  stationMenuTree,
} from "./stationMenuTree.ts";
import { type StationShopRowSchema, stationShopRowTree } from "./stationShopTree.ts";
import { createStationTalk, type StationTalkVisit } from "./stationTalk.ts";

// The station card, the shop, the job board and their confirms (art/shop.md,
// gameplay/quests.md "Job board") on the shared card builder; every size comes from src/ui/layout
// (layout.md "Shop item row").

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
  readonly questReward: string;
  readonly shipPaint: string;
  readonly shop: string;
  readonly shopShip: string;
  readonly shopWeapons: string;
  readonly station: string;
  readonly stationWelcome: string;
  readonly undock: string;
}

type RowCatalogue = "projects" | "shop";

export interface StationShopGroup {
  readonly category: "weapons" | "equipment" | "ammo";
  readonly label: string;
  readonly offers: readonly StationRow[];
}

export type StationShopGroups = readonly [StationShopGroup, StationShopGroup];

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
  readonly brief?: string;
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
  /** The source row group, independent of the station’s pane assignment. */
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
      readonly about?: string;
      /** The primary action's label: Buy, or Accept for a project. */
      readonly action: string;
      readonly kind: "confirm";
      readonly item?: ItemDetail;
      readonly price: number;
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
  readonly rows: (catalog: "projects") => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly services: () => StationServices | null;
  /** Approved groups in display order, including any independently eligible story offer in its pane. */
  /** The docked station’s ordered Shop panes, or undefined when it offers no Shop. */
  readonly shopGroups: () => StationShopGroups | undefined;
  readonly stationTitle: () => string | undefined;
  /** Supplies the eligible current dock visit, including any due dialogue. */
  readonly talk?: () => StationTalkVisit | null;
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
  const bindings: { dispose(): void }[] = [];
  const shopBindings: typeof bindings = [];
  const jobBindings: typeof bindings = [];
  const clearBindings = (group: typeof bindings) => {
    for (const binding of group.splice(0)) {
      binding.dispose();
    }
  };
  const canUse = (element: HTMLButtonElement): boolean =>
    !disposed &&
    open &&
    parent.contains(element) &&
    inCurrentView(parent, element) &&
    !element.hidden &&
    !element.closest("[hidden], [inert]");
  const createRowButton = (run: (button: HTMLButtonElement) => void) => {
    const kit = createButton(document, {
      appearance: { layout: "caller" },
      content: { kind: "text", label: labels.shop },
      getAction: () => binding,
      getState: (button) => ({
        availability: button.hidden
          ? { kind: "omitted" }
          : button.disabled
            ? { kind: "disabled" }
            : { kind: "available" },
      }),
      rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
    });
    const button = kit.element;
    // The row layout provides its own name, face and direct children.
    button.replaceChildren();
    const binding = bindAdaAction(
      {
        click: {
          availability: () => (button.disabled ? { kind: "omitted" } : { kind: "available" }),
          run: () => run(button),
        },
        current: () => canUse(button),
        nativeClickOwner: "factory",
        slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
      },
      button,
    );
    return {
      button,
      dispose() {
        binding.dispose();
        kit.dispose();
      },
    };
  };
  const textAction = (
    label: string,
    role: "primary" | "secondary",
    run: () => void,
    actionId?: string,
  ) => {
    const action = createStandardTextAction(parent, label, {
      availability: (button) =>
        button?.disabled
          ? { kind: "disabled" }
          : button?.hidden
            ? { kind: "omitted" }
            : { kind: "available" },
      current: (): boolean => canUse(action.element),
      run,
      separateFace: true,
    });
    const button = action.element;
    if (actionId !== undefined) {
      button.dataset.action = actionId;
    }
    bindings.push(action);
    button.classList.toggle("ada-primary", role === "primary");
    setButtonRole(role, button);
    return action;
  };
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.dataset.station = "";
  modal.hidden = true;
  const confirmModal = document.createElement("div");
  confirmModal.className = "ada-modal";
  confirmModal.dataset.stationConfirm = "";
  confirmModal.hidden = true;

  const closeControl = (action: string) => {
    const close = createStandardCloseAction(parent, action, labels.close, {
      current: canUse,
      run: () => back(),
      slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
      slopThreshold: SCROLL.dragThreshold,
    });
    bindings.push(close);
    return close.element;
  };
  const stationCard = createDialoguePanel({
    close: closeControl("station-back"),
    title: labels.station,
  });
  stationCard.card.dataset.dialog = "station";
  stationCard.frame.classList.add("ada-station-frame");
  const showWelcome = () => {
    const welcome = stationWelcome(options.stationTitle() ?? labels.station, options.greeting());
    stationCard.showLine(welcome.speaker, welcome.text);
  };
  const readTalk = () => (options.talk && options.services() ? options.talk() : null);
  const talk =
    options.talk && createStationTalk(parent, stationCard, readTalk, canUse, audit, showWelcome);
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
  const menuActions: Record<StationMenuButton, () => void> = {
    exchange: () => showExchange(),
    jobs: () => showJobs(),
    shop: () => showShop(),
    talk: () => showTalk(),
    undock: options.undock,
  };
  const menuButtons = new Map<StationMenuButton, HTMLButtonElement>();
  const menuLayout = mountLayout<StationMenuSchema>(
    {
      components: {
        button: {
          create(initial) {
            const action = textAction(
              initial.label,
              initial.role,
              menuActions[initial.id],
              initial.actionId,
            );
            const button = action.element;
            menuButtons.set(initial.id, button);
            return {
              dispose() {},
              element: button,
              slots: {},
              update(data) {
                action.setLabel(data.label);
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
    stationMenuTree({
      ...labels,
      exchange: EXCHANGE_COPY.title,
      ...(talk && { talk: CONTENT.labels.talk ?? "" }),
    }),
  );
  const undock = menuButtons.get("undock")!;
  const openShop = menuButtons.get("shop")!;
  const openJobs = menuButtons.get("jobs")!;
  const openExchange = menuButtons.get("exchange")!;
  const openTalk = menuButtons.get("talk");
  const focusWelcome = () =>
    focusTarget(
      openTalk && !openTalk.hidden
        ? openTalk
        : !openShop.hidden
          ? openShop
          : !openJobs.hidden
            ? openJobs
            : openExchange,
    );

  const shopCard = createCard({
    close: closeControl("shop-back"),
    size: "large",
    title: labels.shop,
  });
  shopCard.card.dataset.dialog = "shop";
  shopCard.frame.hidden = true;
  const shopStock = document.createElement("div");
  shopStock.className = "ada-station-panes";
  shopCard.body.setAttribute("data-shop-stock", "");
  shopCard.body.append(shopStock);
  const exchangeCard = createCard({
    close: closeControl("exchange-back"),
    size: "large",
    title: EXCHANGE_COPY.title,
  });
  exchangeCard.card.dataset.dialog = "exchange";
  exchangeCard.frame.hidden = true;
  const exchange = createExchangeView(
    parent,
    exchangeCard.body,
    options.exchange,
    options.reducedMotion,
    () => render(),
  );

  const confirmCard = createCard({
    close: closeControl("confirm-cancel-x"),
    size: "small",
    title: "",
  });
  confirmCard.card.dataset.dialog = "confirm";
  const cancel = textAction(
    labels.confirmCancel,
    "secondary",
    () => back(),
    "confirm-cancel",
  ).element;
  const buyAction = textAction(labels.confirmBuy, "primary", () => buyConfirmed(), "confirm-buy");
  const buy = buyAction.element;
  const confirmActions = createActions([
    { button: cancel, role: "secondary" },
    { button: buy, role: "primary" },
  ]);

  const jobsCard = createCard({
    close: closeControl("jobs-back"),
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
  const contributionLabel = CONTENT.labels.projectContribution ?? "";
  const stardustLabel = CONTENT.labels.stardust ?? "";
  for (const [pane, label, term, category] of [
    [jobsPane, labels.jobs, CONTENT.labels.jobsRewards ?? "", "job"],
    [projectsPane, labels.communityProjects, CONTENT.labels.projectContributions ?? "", "project"],
  ] as const) {
    const heading = document.createElement("h3");
    heading.textContent = label;
    heading.style.color = TASK_COLORS[category];
    heading.setAttribute("aria-label", `${label} (${term} ${stardustLabel})`);
    const hint = document.createElement("span");
    hint.className = "ada-station-pane-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = term;
    heading.append(hint);
    pane.append(heading);
  }
  jobsPane.append(jobList);
  projectsPane.append(projectList);
  jobsPanes.append(jobsPane, projectsPane);
  jobsCard.body.append(jobsPanes);

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
  let stationLayer: ReturnType<typeof createModalLayer>;
  let confirmationLayer: ReturnType<typeof createModalLayer>;

  let open = false;
  let view: StationView = "card";
  const configuredStock = () => {
    const groups = options.services() ? options.shopGroups() : undefined;
    if (groups) {
      const offers = groups.flatMap((group) => group.offers);
      if (
        groups.length !== 2 ||
        groups[0].category === groups[1].category ||
        groups.some((group) => group.offers.length > 4) ||
        offers.some((offer) => offer.project) ||
        new Set(offers.map((offer) => offer.key)).size !== offers.length
      ) {
        throw new Error("Shop requires two distinct groups of up to four unique offers");
      }
    }
    return groups?.some((group) => group.offers.length > 0) ? groups : undefined;
  };
  const liveRows = (catalog: RowCatalogue): readonly StationRow[] => {
    if (catalog === "projects") {
      return options.services()?.projects ? options.rows(catalog) : [];
    }
    return configuredStock()?.flatMap((group) => group.offers) ?? [];
  };
  const focusShop = (key: string, index = 0): void => {
    const rows = [...shopStock.querySelectorAll<HTMLButtonElement>("button")].filter(
      (row) => !row.disabled,
    );
    const next =
      rows.find((row) => row.dataset.item === key) ??
      rows[Math.max(0, Math.min(index, rows.length - 1))];
    focusTarget(next ?? openShop);
  };

  let confirm:
    | {
        readonly catalog: RowCatalogue;
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
  const rowElement = (row: StationRow, catalog: RowCatalogue): HTMLButtonElement => {
    const control = createRowButton((node) => {
      const liveRow = liveRows(catalog).find((item) => item.key === row.key);
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
        if (view === "shop") {
          focusShop(row.key);
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
    });
    const node = control.button;
    (row.project ? jobBindings : shopBindings).push(control);
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
    if (row.project) {
      node.style.setProperty("--station-task-accent", TASK_COLORS.project);
    }
    return node;
  };

  const renderShop = (groups: StationShopGroups): void => {
    const previousBindings = shopBindings.splice(0);
    const previousLayouts = shopLayouts.splice(0);
    try {
      const sections = groups.map((group) => {
        const section = document.createElement("section");
        section.dataset.stockGroup = group.category;
        const heading = document.createElement("h3");
        heading.textContent = group.label;
        const rows = document.createElement("div");
        rows.className = "ada-stock-rows";
        rows.append(...group.offers.map((offer) => rowElement(offer, "shop")));
        section.append(heading, rows);
        audit(section);
        return section;
      });
      shopStock.replaceChildren(...sections);
      audit(shopCard.frame);
    } catch (error) {
      shopCard.frame.hidden = true;
      clearBindings(shopBindings);
      for (const layout of shopLayouts.splice(0)) {
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

  const jobLayouts: { dispose(): void }[] = [];
  const jobElement = (job: StationJob): HTMLButtonElement => {
    const control = createRowButton((node) => {
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
    });
    const node = control.button;
    jobBindings.push(control);
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
                node.className = "ada-shop-row ada-job-row";
                node.dataset.job = initial.id;
                node.style.setProperty("--station-task-accent", TASK_COLORS.job);
                node.dataset.state = initial.state;
                node.setAttribute("aria-label", initial.ariaLabel);
                return { dispose() {}, element: node, slots: { parts: node }, update() {} };
              },
              slots: ["parts"],
            },
            well: {
              create(initial) {
                const glyph = createStationItemIcon({
                  key: `icon-job-${initial.glyphType}`,
                  kind: "stateVector",
                });
                glyph.classList.add("ada-job-glyph");
                glyph.dataset.type = initial.glyphType;
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
      const projectRows = projects.map((row) => rowElement(row, "projects"));
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

  const refreshTalk = (): void => {
    const visit = readTalk();
    if (openTalk) {
      openTalk.hidden = visit === null;
    }
    if (view === "card" && !talk?.render(visit)) {
      showWelcome();
    }
  };
  const render = (): void => {
    const groups = configuredStock();
    const title = options.stationTitle() ?? labels.station;
    stationCard.title.textContent = title;
    stationCard.title.hidden = false;
    stationCard.frame.setAttribute("aria-label", title);
    openShop.hidden = !groups;
    openJobs.hidden = !stationJobsShown(options.services());
    if ((view === "shop" && openShop.hidden) || (view === "jobs" && openJobs.hidden)) {
      closeConfirm();
      view = "card";
    }
    refreshTalk();
    renderBalances();
    for (const [id, parts] of Object.entries(views)) {
      parts.frame.hidden = id !== view;
    }
    for (const [id, button] of menuButtons) {
      button.setAttribute(
        "aria-current",
        (id === "talk" ? "card" : id) === view ? "page" : "false",
      );
    }
    const parts = views[view];
    if (footer.parentElement !== parts.card) {
      parts.card.append(balances, footer);
    }
    if (view === "shop" && groups) {
      renderShop(groups);
    } else if (view === "jobs") {
      renderJobs();
    } else if (view === "exchange") {
      exchange.render();
    }
    parts.fit();
    syncPressView();
  };

  const showConfirmation = (
    title: string,
    parts: readonly HTMLElement[],
    action: string,
    item?: { readonly name: string; readonly icon: HTMLElement },
  ): void => {
    confirmCard.frame.hidden = false;
    dropHost.hidden = true;
    if (item) {
      renderItemDetailHeader(confirmCard.title, item.name, item.icon);
    } else {
      confirmCard.title.classList.remove("ada-detail-header");
      confirmCard.title.textContent = title;
    }
    confirmCard.frame.setAttribute("aria-label", title);
    buyAction.setLabel(action);
    confirmCard.body.replaceChildren(...parts, confirmActions);
    audit(confirmCard.frame);
    confirmModal.hidden = false;
    syncPressView();
    confirmCard.fit();
    focusTarget(buy);
  };
  const stardustLine = (label: string, value: number, spokenAmount: string): HTMLDivElement => {
    const line = document.createElement("div");
    line.className = "ada-confirm-stardust";
    const amount = document.createElement("span");
    amount.className = "ada-confirm-stardust-amount";
    amount.setAttribute("aria-hidden", "true");
    amount.textContent = `${label}: ${value}`;
    const spoken = document.createElement("span");
    spoken.className = "ada-confirm-stardust-spoken";
    spoken.textContent = `${label}: ${spokenAmount}`;
    line.append(amount, spoken);
    return line;
  };
  const contributionLine = (value: number): HTMLDivElement =>
    stardustLine(
      contributionLabel,
      value,
      fill(CONTENT.labels.stardustAmount ?? "", { amount: value }),
    );

  const openConfirm = (
    row: StationRow,
    request: Extract<StationRequest, { kind: "confirm" }>,
    catalog: RowCatalogue,
    origin: HTMLElement,
  ) => {
    confirm = {
      catalog,
      key: row.key,
      origin,
      ...(catalog === "projects" ? { projectAmount: request.price } : {}),
    };
    const detail = catalog === "shop" ? request.item : undefined;
    const parts: HTMLElement[] = [];
    if (detail) {
      if (detail.description.length > 0) {
        parts.push(itemDetailProse(detail.description));
      }
    } else {
      const item = well(row.glyph, true);
      item.dataset.inkTop = "0";
      parts.push(item);
      if (request.about) {
        parts.push(prose("ada-confirm-about", request.about));
      }
    }
    if (catalog === "projects") {
      parts.push(contributionLine(request.price));
    } else {
      const price = document.createElement("div");
      price.className = "ada-confirm-price";
      price.dataset.inkTop = "0";
      price.textContent = String(request.price);
      parts.push(price);
    }
    showConfirmation(
      request.title,
      parts,
      request.action,
      detail ? { icon: createStationItemIcon(row.glyph), name: itemDetailName(detail) } : undefined,
    );
  };

  const openJob = (job: StationJob, origin: HTMLElement): void => {
    confirm = { job: job.id, origin };
    const parts = [prose("ada-confirm-about", job.detail)];
    if (job.brief) {
      parts.push(prose("ada-confirm-about", job.brief));
    }
    parts.push(stardustLine(labels.questReward, job.reward, job.rewardText));
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
    const noStardust = options.balance().stardust === 0;
    const parts = [
      well(row.glyph, true),
      prose("ada-confirm-about", row.projectDetails ?? row.level),
      contributionLine(noStardust ? 0 : (row.price ?? 0)),
    ];
    if (noStardust) {
      const note = prose(
        "ada-confirm-about",
        "You have 0 Stardust. Any amount helps when you return.",
      );
      note.setAttribute("role", "status");
      parts.push(note);
    }
    showConfirmation(row.name, parts, labels.jobAccept);
  };

  // Drop asks first, naming the held job or the active activity.
  const openDrop = (job: StationJob, origin: HTMLElement): void => {
    confirm = { drop: true };
    dropOrigin = origin;
    const title = job.kind === "activity" ? labels.activityDrop : labels.jobDropTitle;
    const data = {
      ...(job.brief ? { brief: job.brief } : {}),
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
          actionRoot: parent,
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
      } else if (view === "shop") {
        focusShop(origin?.dataset.item ?? "");
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

  const showTalk = (): void => {
    if (!openTalk || !readTalk()) {
      return;
    }
    view = "card";
    render();
    focusTarget(openTalk);
  };
  const showJobs = (): void => {
    if (!stationJobsShown(options.services())) {
      return;
    }
    view = "jobs";
    render();
    focusTarget(openJobs);
  };
  const showExchange = (): void => {
    view = "exchange";
    render();
    focusTarget(openExchange);
  };
  const showShop = (): void => {
    if (!configuredStock()) {
      return;
    }
    view = "shop";
    render();
    focusTarget(openShop);
  };
  const buyConfirmed = (): void => {
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
    const shopIndex = [...shopStock.querySelectorAll<HTMLButtonElement>("button")]
      .filter((row) => !row.disabled)
      .indexOf(pending.origin as HTMLButtonElement);
    closeConfirm();
    if (liveRows(catalog).some((row) => row.key === key && row.requiresWeapon === undefined)) {
      options.buy(key);
    }
    if (open) {
      render();
      if (view === "jobs") {
        focusJobs(key);
      } else if (view === "shop") {
        focusShop(key, shopIndex);
      }
    }
  };

  // A drag across a page must not activate the row where the gesture started.
  for (const group of [shopStock, jobList, projectList]) {
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
      stationLayer?.dispose();
      confirmationLayer?.dispose();
      leavePress = undefined;
      leaveConfirmation = undefined;
      clearBindings(bindings);
      clearBindings(shopBindings);
      clearBindings(jobBindings);
      talk?.reset();
      exchange.dispose();
      for (const layout of jobLayouts) {
        layout.dispose();
      }
      for (const layout of shopLayouts) {
        layout.dispose();
      }
      menuLayout.dispose();
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
    /** Refreshes the caller's Talk projection after a model change. Hidden tabs keep their cursor. */
    refreshTalk(): void {
      if (open && !disposed && talk) {
        refreshTalk();
      }
    },
    /** Opens on the station card when docking and closes on undocking. */
    setOpen(value: boolean): void {
      if (value === open) {
        return;
      }
      open = value;
      modal.hidden = !open;
      view = "card";
      if (open) {
        render();
        focusWelcome();
      } else {
        talk?.reset();
        closeConfirm();
      }
    },
    settleDetails: () => dropDetails?.settle() ?? Promise.resolve(),
  };
  try {
    const scopes = [
      stationCard.frame,
      shopCard.frame,
      jobsCard.frame,
      exchangeCard.frame,
      confirmCard.frame,
      confirmActions,
    ];
    for (const scope of scopes) {
      assertAdaActionMetadata(scope);
    }
    parent.append(modal, confirmModal);
    stationLayer = createModalLayer(modal);
    confirmationLayer = createModalLayer(confirmModal);
    for (const scope of scopes) {
      if (scope.isConnected) {
        assertAdaActionBindings(scope);
      }
    }
  } catch (error) {
    station.dispose();
    throw error;
  }
  return station;
}
