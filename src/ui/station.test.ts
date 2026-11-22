import { existsSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import { TASK_COLORS } from "../data/taskCategories.ts";
import { fill } from "../model/shop.ts";
import type { StationServices } from "../model/stationServices.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { CONFIRM_ITEM } from "./layout/shopCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { isTap } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { currentView, inCurrentView, rootPressGuard } from "./pressScope.ts";
import * as stationSource from "./station.ts";
import {
  jobAction,
  rowAction,
  STATION_STYLE,
  stationBack,
  stationJobsRows,
  stationJobsShown,
  weaponItemGlyph,
} from "./station.ts";
import { stationJobRowTree } from "./stationJobsTree.ts";
import { stationMenuTree } from "./stationMenuTree.ts";
import { stationShopRowTree } from "./stationShopTree.ts";
import { buttonProperty } from "./uiSkin.ts";

describe("station card back steps", () => {
  it("returns from the shop and the job board to the station card and undocks only from it", () => {
    expect(stationBack("shop", false)).toBe("card");
    expect(stationBack("jobs", false)).toBe("card");
    expect(stationBack("card", false)).toBe("undock");
  });

  it("cancels an open confirm back to the card under it", () => {
    expect(stationBack("shop", true)).toBe("shop");
    expect(stationBack("jobs", true)).toBe("jobs");
  });
});

describe("job row taps", () => {
  it("presents Accept for offers and Drop for the held job", () => {
    expect(jobAction("offer")).toBe("accept");
    expect(jobAction("busy")).toBe("accept");
    expect(jobAction("held")).toBe("drop");
  });
});

it("reserves space for all unfunded projects and then takes jobs in canonical order", () => {
  const services: StationServices = {
    equipment: false,
    exchange: true,
    heldTask: true,
    jobs: true,
    projects: true,
    weaponsAmmo: false,
  };
  const job = (
    id: string,
    state: stationSource.StationJob["state"] = "offer",
  ): stationSource.StationJob => ({
    detail: "Detail",
    id,
    kind: "job",
    reward: 1,
    rewardText: "1 Stardust",
    state,
    title: id,
    type: "delivery",
  });
  const jobs = [job("held", "held"), job("featured"), job("first"), job("second"), job("third")];
  const project: stationSource.StationRow = {
    glyph: { key: "project", kind: "sprite" },
    group: "items",
    key: "project",
    level: "",
    name: "Project",
    price: 1,
    project: true,
    state: "forSale",
  };
  const ids = (rows: stationSource.StationJob[]) => rows.map(({ id }) => id);
  expect(
    ids(
      stationJobsRows(jobs, services, [
        project,
        { ...project, key: "secondProject", state: "unaffordable" },
      ]),
    ),
  ).toEqual(["held", "featured", "first"]);
  expect(ids(stationJobsRows(jobs, services, [{ ...project, state: "owned" }]))).toEqual([
    "held",
    "featured",
    "first",
    "second",
  ]);
  expect(ids(stationJobsRows(jobs, { ...services, jobs: false }, [project]))).toEqual(["held"]);
});

describe("shop row taps", () => {
  it("keeps unaffordable rows tappable so they refuse", () => {
    expect(rowAction("unaffordable")).toBe("request");
    expect(rowAction("forSale")).toBe("request");
  });

  it("applies an owned paint at once and ignores owned and in-use rows", () => {
    expect(rowAction("selectable")).toBe("select");
    expect(rowAction("owned")).toBe("none");
    expect(rowAction("inUse")).toBe("none");
  });
});

describe("weapon shop glyphs", () => {
  it("draws every weapon's two-frame shop sheet", () => {
    for (const weapon of [
      "laser",
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "scattershot",
      "phaser",
    ] as const) {
      expect(weaponItemGlyph(weapon)).toEqual({
        key: `icon-shop-weapon-${weapon}`,
        kind: "sprite",
      });
    }
    expect(STATION_STYLE).not.toContain("ada-glyph-weapon");
  });

  it("places an upgrade composite's weapon sheet at (0, 4) under its badge", () => {
    expect(STATION_STYLE).toContain(".ada-controls .ada-glyph-upgrade > .ada-glyph{");
    expect(STATION_STYLE).not.toContain(".ada-glyph-upgrade .ada-glyph-weapon{");
  });
});

describe("shop style", () => {
  it("draws rows with the ui-button-tile frames", () => {
    for (const tag of ["normal", "pressed", "disabled"] as const) {
      expect(STATION_STYLE).toContain(`var(${buttonProperty("ui-button-tile", tag)})`);
    }
  });

  it("draws every tile row's second line and Owned in row supporting, and busy rows in row disabled", () => {
    const rule = (selector: string) => {
      const from = STATION_STYLE.indexOf(`${selector}{`);
      expect(from, selector).toBeGreaterThanOrEqual(0);
      return STATION_STYLE.slice(from, STATION_STYLE.indexOf("}", from));
    };
    expect(rule(".ada-controls .ada-shop-level")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls [data-state=unaffordable] .ada-shop-level")).toContain(
      "color:#a6a2b8",
    );
    expect(rule(".ada-controls .ada-owned")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls .ada-shop-row[data-state=unaffordable]")).toContain("color:#a6a2b8");
  });

  it("uses each job type's sheet and compact board rows", () => {
    for (const type of ["survey", "delivery", "rescue", "hunt", "activity"]) {
      expect(
        existsSync(new URL(`../../public/art/ui/sprites/icon-job-${type}.png`, import.meta.url)),
      ).toBe(true);
    }
    expect(STATION_STYLE).toContain(".ada-controls .ada-station-panes .ada-shop-row{");
    // No row keeps a placeholder flat mark: the activity row takes its sheet too.
    expect(STATION_STYLE).not.toMatch(/ada-job-glyph\[data-type=/u);
  });
});

describe("canonical station service presentation", () => {
  const exchangeOnly: StationServices = {
    equipment: false,
    exchange: true,
    heldTask: false,
    jobs: false,
    projects: false,
    weaponsAmmo: false,
  };

  it.each([
    ["equipment", false],
    ["weaponsAmmo", false],
    ["jobs", true],
  ] as const)("shows the Jobs action only for the %s specialty with work", (service, jobs) => {
    expect(stationJobsShown({ ...exchangeOnly, [service]: true })).toBe(jobs);
  });

  it("keeps held-task Drop and existing Projects independent of specialist offers", () => {
    const held = { ...exchangeOnly, heldTask: true, projects: true };
    expect(stationJobsShown(held)).toBe(true);
    expect(stationJobsShown(exchangeOnly)).toBe(false);
  });

  it("keeps every existing hub capability and exposes nothing off dock", () => {
    const hub = {
      equipment: true,
      exchange: true as const,
      heldTask: true,
      jobs: true,
      projects: true,
      weaponsAmmo: true,
    };
    expect(stationJobsShown(hub)).toBe(true);
    expect(stationJobsShown(null)).toBe(false);
  });
});

const strictCleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of strictCleanup.splice(0)) {
    dispose();
  }
  vi.unstubAllGlobals();
});

function strictStation() {
  class Node extends EventTarget {
    readonly tagName: string;
    connected: boolean;
    constructor(tag = "div", connected = true) {
      super();
      this.tagName = tag.toUpperCase();
      this.button = tag === "button";
      this.connected = connected;
    }
    nodeType = 1;
    type = "";
    disabled = false;
    className = "";
    textContent = "";
    dataset: Record<string, string> = {};
    clientWidth = 400;
    clientHeight = 300;
    readonly properties = new Map<string, string>();
    readonly style = {
      getPropertyValue: (key: string) => this.properties.get(key) ?? "",
      removeProperty: (key: string) => this.properties.delete(key),
      setProperty: (key: string, value: string) => this.properties.set(key, value),
    };
    readonly classList = {
      add: (...names: string[]) => {
        for (const name of names) {
          this.classList.toggle(name, true);
        }
      },
      contains: (name: string) => this.className.split(" ").includes(name),
      remove: (name: string) => this.classList.toggle(name, false),
      toggle: (name: string, on: boolean) => {
        const names = new Set(this.className.split(" ").filter(Boolean));
        if (on) {
          names.add(name);
        } else {
          names.delete(name);
        }
        this.className = [...names].join(" ");
        return on;
      },
    };
    readonly attributes = new Map<string, string>();
    readonly children: Node[] = [];
    parentElement: Node | null = null;
    hidden = false;
    tabIndex = 0;
    button = false;
    get ownerDocument(): Document {
      return doc as unknown as Document;
    }
    get isConnected(): boolean {
      return this.parentElement?.isConnected ?? this.connected;
    }
    append(...nodes: Node[]) {
      for (const node of nodes) {
        this.insertBefore(node, null);
      }
    }
    insertBefore(node: Node, before: Node | null) {
      if (node === before) {
        return node;
      }
      node.remove();
      node.parentElement = this;
      this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
      return node;
    }
    onAttribute?: (name: string) => void;
    remove() {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      }
      this.parentElement = null;
    }
    replaceChildren(...nodes: Node[]) {
      for (const child of [...this.children]) {
        child.remove();
      }
      this.append(...nodes);
    }
    get parentNode() {
      return this.parentElement;
    }
    get nextSibling(): Node | null {
      return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
    }
    getBoundingClientRect() {
      return {
        bottom: 32,
        height:
          this.className.includes("ada-shop-row") || this.className.includes("page-row") ? 32 : 24,
        left: 0,
        right: 180,
        top: 0,
        width: this.className.includes("ada-shop-name")
          ? 84
          : this.className.includes("ada-price")
            ? 24
            : 180,
        x: 0,
        y: 0,
      };
    }
    getClientRects() {
      return this.isConnected && !this.closest("[hidden], [inert]")
        ? [this.getBoundingClientRect()]
        : [];
    }
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    hasAttribute(name: string) {
      return name === "hidden" ? this.hidden : this.attributes.has(name);
    }
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
      this.onAttribute?.(name);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    closest(selector: string): Node | null {
      return (selector.includes("hidden") && this.hidden) ||
        (selector.includes("inert") && this.hasAttribute("inert"))
        ? this
        : (this.parentElement?.closest(selector) ?? null);
    }
    matches(selector: string): boolean {
      if (this.nodeType !== 1) {
        return false;
      }
      return selector.split(",").some((part) => {
        const value = part.trim();
        if (value === ":disabled") {
          return this.disabled;
        }
        if (value === "button" || value === "img") {
          return this.tagName === value.toUpperCase();
        }
        if (value.startsWith(".")) {
          return this.className.split(" ").includes(value.slice(1));
        }
        if (value === "[data-action]") {
          return this.dataset.action !== undefined || this.getAttribute("data-action") !== null;
        }
        const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
        if (input) {
          return this.tagName === "INPUT" && (this.getAttribute("type") ?? this.type) === input[1];
        }
        const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
        if (role) {
          return this.getAttribute("role") === role[1];
        }
        const data = /^\[data-([a-z-]+)=["']?([^"'\]]+)["']?\]$/.exec(value);
        if (!data) {
          return false;
        }
        const key = data[1]!.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
        return (this.dataset[key] ?? this.getAttribute(`data-${data[1]}`)) === data[2];
      });
    }
    querySelectorAll(selector: string): Node[] {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector: string): Node | null {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    focus() {
      doc.activeElement = this;
    }
  }
  const doc = Object.assign(new EventTarget(), {
    activeElement: null as Node | null,
    defaultView: {
      HTMLElement: Node,
      MutationObserver: class {
        disconnect() {}
        observe() {}
        takeRecords() {
          return [];
        }
      },
      Node,
    },
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", Node);
  const parent = new Node(),
    modal = new Node(),
    confirmModal = new Node(),
    dropHost = new Node();
  const part = () => {
    const frame = new Node(),
      close = new Node("button");
    frame.className = "ada-card-frame";
    close.button = true;
    frame.append(close);
    return { close, frame };
  };
  const stationCard = part(),
    shopCard = part(),
    jobsCard = part(),
    confirmCard = part(),
    drop = part();
  modal.append(stationCard.frame, shopCard.frame, jobsCard.frame);
  dropHost.append(drop.frame);
  confirmModal.append(confirmCard.frame, dropHost);
  parent.append(modal, confirmModal);
  shopCard.frame.hidden = jobsCard.frame.hidden = confirmModal.hidden = dropHost.hidden = true;
  const stationLayer = createModalLayer(modal as unknown as HTMLElement),
    confirmationLayer = createModalLayer(confirmModal as unknown as HTMLElement);
  strictCleanup.push(() => {
    stationLayer.dispose();
    confirmationLayer.dispose();
  });
  const back = vi.fn();
  strictCleanup.push(
    registerAdaActionRoot({ permits: () => true }, parent as unknown as HTMLElement),
  );
  for (const parts of [stationCard, shopCard, jobsCard, confirmCard, drop]) {
    strictCleanup.push(
      bindAdaAction(
        {
          click: { availability: () => ({ kind: "available" }), run: back },
          current: () => true,
          slopPx: () => 8,
        },
        parts.close as unknown as HTMLElement,
      ).dispose,
    );
  }
  const context = createContext({
    HTMLElement: Node,
    assertAdaActionBindings,
    assertAdaActionMetadata,
    back,
    confirm: null,
    confirmCard,
    confirmModal,
    confirmationDialog: undefined,
    confirmationLayer,
    disposed: false,
    document: doc,
    dropHost,
    jobsCard,
    leaveConfirmation: undefined,
    leavePress: undefined,
    modal,
    open: true,
    pressDialog: undefined,
    shopCard,
    stationCard,
    stationLayer,
    view: "card",
    views: { card: stationCard, jobs: jobsCard, shop: shopCard },
  });
  const source = ts.createSourceFile(
    "station.ts",
    readFileSync(new URL("./station.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let initializer: ts.Expression | undefined;
  let auditInitializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "audit") {
      auditInitializer = node.initializer;
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "syncPressView") {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!initializer) {
    throw new Error("Missing Station foreground synchronizer");
  }
  if (!auditInitializer) {
    throw new Error("Missing Station construction audit");
  }
  context.audit = runInContext(
    ts.transpileModule(`(${auditInitializer.getText(source)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  );
  const sync = runInContext(
    ts.transpileModule(`(${initializer.getText(source)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  ) as () => void;
  return {
    Node,
    back,
    confirmCard,
    confirmModal,
    context,
    doc,
    drop,
    dropHost,
    jobsCard,
    modal,
    parent: parent as unknown as HTMLElement,
    shopCard,
    stationCard,
    sync,
  };
}

it("isolates the current Station page, invalidates replaced views and releases the closed station", () => {
  const f = strictStation(),
    guard = rootPressGuard(f.parent),
    before = guard.gate.capture();
  f.sync();
  expect(before()).toBe(false);
  expect(currentView(f.parent)).toBe(f.stationCard.frame);
  expect(f.stationCard.frame.hasAttribute("aria-modal")).toBe(true);
  expect(f.stationCard.frame.contains(f.doc.activeElement)).toBe(true);
  const cardPress = guard.gate.capture();
  f.context.view = "shop";
  f.stationCard.frame.hidden = true;
  f.shopCard.frame.hidden = false;
  f.sync();
  expect(cardPress()).toBe(false);
  expect(currentView(f.parent)).toBe(f.shopCard.frame);
  const shopPress = guard.gate.capture();
  f.context.open = false;
  f.modal.hidden = true;
  f.sync();
  expect(shopPress()).toBe(false);
  expect(currentView(f.parent)).toBe(f.parent);
  expect(f.back).not.toHaveBeenCalled();
});

it("uses the actual purchase or drop card as the strict dialog rather than its backdrop", () => {
  const f = strictStation();
  f.context.view = "jobs";
  f.stationCard.frame.hidden = true;
  f.jobsCard.frame.hidden = false;
  f.sync();
  f.jobsCard.close.focus();
  const before = rootPressGuard(f.parent).gate.capture();
  f.context.confirm = { key: "offer" };
  f.confirmModal.hidden = false;
  f.sync();
  expect(before()).toBe(false);
  expect(currentView(f.parent)).toBe(f.confirmCard.frame);
  expect(currentView(f.parent)).not.toBe(f.confirmModal);
  expect(f.modal.hasAttribute("inert")).toBe(true);
  f.context.confirm = { drop: true };
  f.confirmCard.frame.hidden = true;
  f.dropHost.hidden = false;
  f.sync();
  expect(currentView(f.parent)).toBe(f.drop.frame);
  expect(f.drop.frame.contains(f.doc.activeElement)).toBe(true);
  f.context.confirm = null;
  f.confirmModal.hidden = true;
  f.sync();
  expect(currentView(f.parent)).toBe(f.jobsCard.frame);
  expect(f.doc.activeElement).toBe(f.jobsCard.close);
  expect(f.back).not.toHaveBeenCalled();
});

type StationFixtureNode = InstanceType<ReturnType<typeof strictStation>["Node"]>;

function constructedStation(
  fault = "",
  connected = true,
  owned = true,
  permits: () => boolean = () => true,
  projectOnly = false,
  beforeCreate?: (parent: StationFixtureNode) => void,
  shopGroups?: () => stationSource.StationShopGroups | undefined,
) {
  const f = strictStation();
  const { Node } = f;
  const parent = new Node("div", connected);
  if (owned) {
    strictCleanup.push(registerAdaActionRoot({ permits }, parent as unknown as HTMLElement));
  }
  const state = { corruptConfirmation: false, corruptRow: "" };
  const native = new Map<string, ReturnType<typeof parts>>();
  const button = (label: string) =>
    Object.assign(new Node("button", false), { textContent: label });
  const actions = (items: { button: InstanceType<typeof Node> }[]) => {
    const row = new Node("div", false);
    row.append(...items.map((item) => item.button));
    if (
      fault === "confirm-actions" &&
      items.some((item) => item.button.dataset.action === "confirm-buy")
    ) {
      row.append(unbound());
    }
    return row;
  };
  function unbound() {
    const node = button("Unregistered");
    node.hidden = true;
    node.disabled = true;
    return node;
  }
  function parts(options: { closeAction: string; title: string }) {
    const frame = new Node("div", false),
      card = new Node("section", false),
      body = new Node("div", false),
      header = new Node("header", false),
      title = new Node("h2", false),
      close = button("Close"),
      choices = new Node("div", false),
      controls = new Node("div", false),
      skip = button("Skip");
    frame.className =
      options.closeAction === "station-back" ? "ada-dialogue-frame" : "ada-card-frame";
    body.className = "ada-card-body";
    const replace = body.replaceChildren.bind(body);
    body.replaceChildren = (...nodes) => {
      replace(...nodes);
      if (options.closeAction === "confirm-cancel-x" && state.corruptConfirmation) {
        body.append(unbound());
      }
    };
    frame.setAttribute("role", "dialog");
    close.dataset.action = options.closeAction;
    title.textContent = options.title;
    header.append(title);
    card.append(header, body);
    frame.append(card, close);
    if (options.closeAction === "station-back") {
      card.append(choices, controls);
      frame.append(skip);
    }
    if (fault === options.closeAction) {
      frame.append(unbound());
    }
    const result = {
      body,
      card,
      choices,
      close,
      controls,
      dispose: vi.fn(),
      fit: vi.fn(),
      frame,
      header,
      showLine: vi.fn(),
      skip,
      title,
    };
    native.set(options.closeAction, result);
    return result;
  }
  const doc = f.doc as typeof f.doc & { createElement: (tag: string) => InstanceType<typeof Node> };
  doc.createElement = (tag) => {
    const node = new Node(tag, false);
    node.onAttribute = (name) => {
      if (
        name === "aria-label" &&
        state.corruptRow &&
        (node.dataset.item === state.corruptRow || node.dataset.job === state.corruptRow)
      ) {
        node.append(unbound());
      }
    };
    return node;
  };
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1", height: "0" }));
  const labels = Object.fromEntries(
    [
      "close",
      "confirmBuy",
      "confirmCancel",
      "inUse",
      "jobAccept",
      "jobActive",
      "jobBoard",
      "jobBoardIntro",
      "activityDrop",
      "jobBusy",
      "jobDrop",
      "jobDropCancel",
      "jobDropTitle",
      "jobs",
      "jobsProjects",
      "continue",
      "owned",
      "projectFunded",
      "questReward",
      "communityProjects",
      "shipPaint",
      "shop",
      "shopShip",
      "shopWeapons",
      "station",
      "stationWelcome",
      "undock",
    ].map((key) => [key, key]),
  ) as unknown as stationSource.StationLabels;
  const rows: stationSource.StationRow[] = Array.from({ length: 8 }, (_, index) => ({
    glyph: { key: "icon-shop-weapon-laser", kind: "sprite" },
    group: "items",
    key: `item-${index}`,
    level: "",
    name: `Item ${index}`,
    price: 10,
    state: "forSale",
  }));
  let jobs: stationSource.StationJob[] = [
    {
      brief: "Keeper brief.",
      detail: "Detail",
      id: "job-1",
      kind: "job",
      reward: 10,
      rewardText: "10 Stardust",
      state: "offer",
      title: "Job",
      type: "freight",
    },
  ];
  const buy = vi.fn(),
    request = vi.fn((): stationSource.StationRequest => ({
      about: "About",
      action: "Buy",
      kind: "confirm" as const,
      price: 10,
      title: "Item",
    })),
    select = vi.fn(),
    undock = vi.fn(),
    acceptJob = vi.fn((id: string) => {
      jobs = jobs.map((job) => (job.id === id ? { ...job, state: "held" } : job));
      return true;
    });
  const options: stationSource.StationOptions = {
    acceptJob,
    balance: () => ({ ore: 25, stardust: 100 }),
    busyLine: () => "Busy",
    buy,
    dropJob: vi.fn(),
    exchange: {
      exchangeImmediately: () => ({ kind: "refused", reason: "unavailable" }),
      preview: () => ({ kind: "refused", reason: "unavailable" }),
    },
    greeting: () => ({
      count: 3,
      displayName: "Slate",
      index: 0,
      keeper: "slate",
      line: "Greeting",
    }),
    jobs: () => jobs,
    labels,
    reducedMotion: () => true,
    request,
    rows: () => [{ ...rows[0]!, key: "project:orchard", project: true }],
    select,
    services: () => ({
      equipment: !projectOnly,
      exchange: true,
      heldTask: false,
      jobs: !projectOnly,
      projects: projectOnly,
      weaponsAmmo: !projectOnly,
    }),
    shopGroups:
      shopGroups ??
      (() =>
        projectOnly
          ? undefined
          : [
              { category: "weapons", label: "Weapons", offers: rows.slice(0, 4) },
              { category: "equipment", label: "Equipment", offers: rows.slice(4) },
            ]),
    stationTitle: () => "Actual Station",
    undock,
  };
  beforeCreate?.(parent);
  const context = createContext({
    ...stationSource,
    CONFIRM_ITEM,
    CONTENT,
    EXCHANGE_COPY,
    HTMLElement: Node,
    SCROLL,
    SPRITES: "/art/",
    TASK_COLORS,
    assertAdaActionBindings,
    assertAdaActionMetadata,
    bindAdaAction,
    createActions: actions,
    createButton: button,
    createCard: parts,
    createDialoguePanel: parts,
    createExchangeView: (host: InstanceType<typeof Node>) => {
      const root = new Node("section", false);
      host.append(root);
      return { back: () => false, dispose: () => root.remove(), render: vi.fn(), root };
    },
    createModalLayer,
    createStationItemIcon: () => new Node("span", false),
    document: doc,
    fill,
    focusTarget: (node: InstanceType<typeof Node>) => node.focus(),
    getComputedStyle,
    inCurrentView,
    isTap,
    mountLayout,
    options,
    parent,
    readViewUnit,
    refuse: vi.fn(),
    setFooterAction: (intent: string, row: InstanceType<typeof Node>) => {
      row.dataset.footerAction = intent;
    },
    setStationItemTitle: (_glyph: unknown, text: string, node: InstanceType<typeof Node>) => {
      node.textContent = text;
    },
    stationJobRowTree,
    stationMenuTree,
    stationShopRowTree,
    window: win,
  });
  const source = ts.createSourceFile(
    "station.ts",
    readFileSync(new URL("./station.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declarations = source.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        ["well", "prose", "createStationView"].includes(node.name?.text ?? ""),
    )
    .map((node) => node.getText(source).replace(/^export /, ""));
  const station = runInContext(
    ts.transpileModule(`${declarations.join("\n")}\ncreateStationView(parent,options)`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  ) as ReturnType<typeof stationSource.createStationView>;
  strictCleanup.push(station.dispose);
  const activate = (node: InstanceType<typeof Node>) =>
    resolveAdaHoldAction(
      parent as unknown as HTMLElement,
      node as unknown as HTMLElement,
    )!.activate();
  const action = (name: string) => parent.querySelector(`[data-action="${name}"]`)!;
  return {
    Node,
    acceptJob,
    action,
    activate,
    buy,
    context,
    doc,
    jobs: () => jobs,
    labels,
    native,
    parent,
    request,
    rows,
    select,
    state,
    station,
    undock,
  };
}

it.each(["station-back", "shop-back", "jobs-back", "confirm-cancel-x", "confirm-actions"])(
  "rejects incomplete completed Station factory scope %s",
  (fault) => {
    expect(() => constructedStation(fault)).toThrow("no registered action binding");
  },
);

it("requires connected Station construction ownership without evaluating the live policy", () => {
  expect(() => constructedStation("", true, false)).toThrow("no live action root");
  const f = constructedStation("", false, false);
  expect(f.station.isOpen()).toBe(false);
  expect(f.buy).not.toHaveBeenCalled();
  f.station.dispose();
  const permits = vi.fn(() => {
    throw new Error("Construction must not evaluate root policy");
  });
  const active = constructedStation("", true, true, permits);
  expect(permits).not.toHaveBeenCalled();
  active.station.dispose();
});

it("publishes both hidden Station roots with their permanent actions bound", () => {
  const observed = vi.fn();
  const geometry = vi.fn(() => {
    throw Error("Station construction read connected geometry");
  });
  const f = constructedStation("", true, true, undefined, false, (parent) => {
    vi.stubGlobal("getComputedStyle", geometry);
    const append = parent.append.bind(parent);
    vi.spyOn(parent, "append").mockImplementation((...nodes) => {
      append(...nodes);
      observed(
        nodes.map((root) => {
          const unbound = root.querySelectorAll("button").flatMap((element) => {
            try {
              assertAdaActionMetadata(element as unknown as HTMLElement);
              return [];
            } catch {
              return [element.dataset.action ?? element.dataset.tab ?? element.textContent];
            }
          });
          return { connected: root.isConnected, hidden: root.hidden, unbound };
        }),
      );
    });
  });
  try {
    expect(observed).toHaveBeenCalledExactlyOnceWith([
      { connected: true, hidden: true, unbound: [] },
      { connected: true, hidden: true, unbound: [] },
    ]);
    expect(f.parent.children.map(({ dataset }) => Object.keys(dataset))).toEqual([
      ["station"],
      ["stationConfirm"],
    ]);
    expect(geometry).not.toHaveBeenCalled();
  } finally {
    f.station.dispose();
  }
});

it.each(["station-back", "confirm-actions"])(
  "keeps both Station roots private when the %s preflight fails",
  (fault) => {
    const published = vi.fn();
    expect(() =>
      constructedStation(fault, true, true, undefined, false, (parent) => {
        const append = parent.append.bind(parent);
        vi.spyOn(parent, "append").mockImplementation((...nodes) => {
          published();
          append(...nodes);
        });
      }),
    ).toThrow("no registered action binding");
    expect(published).not.toHaveBeenCalled();
  },
);

it("releases both Station roots and permanent bindings after a failed live-root audit", () => {
  const published = vi.fn();
  let parent: StationFixtureNode | undefined;
  let controls: HTMLElement[] = [];
  expect(() =>
    constructedStation("", true, false, undefined, false, (root) => {
      parent = root;
      const append = root.append.bind(root);
      vi.spyOn(root, "append").mockImplementation((...nodes) => {
        append(...nodes);
        published(nodes.length);
        controls = nodes.flatMap((node) =>
          node.querySelectorAll("button"),
        ) as unknown as HTMLElement[];
      });
    }),
  ).toThrow("no live action root");
  expect(published).toHaveBeenCalledExactlyOnceWith(2);
  expect(parent?.children).toEqual([]);
  expect(controls.length).toBeGreaterThan(1);
  for (const control of controls) {
    expect(() => assertAdaActionMetadata(control)).toThrow("no registered action binding");
  }
});

it("registers completed Shop rows and preserves confirmation and retry", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-shop"));
  const row = f.parent.querySelector('[data-item="item-0"]')!;
  expect(
    resolveAdaHoldAction(f.parent as unknown as HTMLElement, row as unknown as HTMLElement),
  ).not.toBeNull();
  f.activate(row);
  expect(f.request).toHaveBeenCalledExactlyOnceWith("item-0");
  const detail = f.native.get("confirm-cancel-x")!.body;
  expect(detail.querySelectorAll(".ada-confirm-left")).toEqual([]);
  expect(detail.querySelector(".ada-confirm-price")?.textContent).toBe("10");
  f.activate(f.action("confirm-cancel"));
  expect(f.buy).not.toHaveBeenCalled();
  const retry = f.parent.querySelector('[data-item="item-0"]')!;
  expect(f.doc.activeElement).toBe(retry);
  f.activate(retry);
  expect(detail.querySelectorAll(".ada-confirm-left")).toEqual([]);
  expect(detail.querySelector(".ada-confirm-price")?.textContent).toBe("10");
  f.activate(f.action("confirm-buy"));
  expect(f.buy).toHaveBeenCalledExactlyOnceWith("item-0");
});

function stationList(kind: "shop" | "jobs") {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action(kind === "shop" ? "open-shop" : "open-jobs"));
  const card = f.native.get(kind === "shop" ? "shop-back" : "jobs-back")!;
  const list = card.body.querySelector(kind === "shop" ? ".ada-station-panes" : ".ada-job-list")!;
  const row = list.querySelector(kind === "shop" ? '[data-item="item-0"]' : '[data-job="job-1"]')!;
  const action = resolveAdaHoldAction(
    f.parent as unknown as HTMLElement,
    row as unknown as HTMLElement,
  )!;
  const id = kind === "shop" ? "item-0" : "job-1";
  const calls = () =>
    kind === "shop"
      ? f.request.mock.calls
      : f.native.get("confirm-cancel-x")!.frame.closest("[hidden]")
        ? []
        : [[id]];
  const rect = row.getBoundingClientRect();
  const dispatch = (
    type: string,
    distance = 0,
    pointerId: number | null = 7,
    detail = 1,
    target = row,
  ) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      clientX: rect.left + 1 + distance,
      clientY: rect.top + 1,
      detail,
      ...(pointerId === null ? {} : { pointerId }),
    });
    list.dispatchEvent(event);
    if (type === "click" && target !== list && !event.defaultPrevented) {
      target.dispatchEvent(event);
    }
    return event;
  };
  return { ...f, action, calls, dispatch, id, list, row };
}

it.each([
  ["shop", "pointerup"],
  ["shop", "pointercancel"],
  ["jobs", "pointerup"],
  ["jobs", "pointercancel"],
] as const)(
  "allows the real %s row's semantic click after drag and %s without a click",
  (kind, end) => {
    const f = stationList(kind);
    expect(f.action.available()).toBe(true);
    f.dispatch("pointerdown");
    f.dispatch("pointermove", SCROLL.dragThreshold + 1);
    f.dispatch(end, SCROLL.dragThreshold + 1);
    expect(f.calls()).toEqual([]);
    f.row.focus();
    const keyboard = f.dispatch("click", 0, -1, 0);
    expect({ calls: f.calls(), prevented: keyboard.defaultPrevented }).toEqual({
      calls: [[f.id]],
      prevented: false,
    });
  },
);

it.each(["shop", "jobs"] as const)(
  "blocks a matching physical %s drag while preserving taps at the scaled bound",
  (kind) => {
    const f = stationList(kind);
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "2", height: "0" }));
    const limit = 2 * SCROLL.dragThreshold;
    f.dispatch("pointerdown");
    f.dispatch("pointermove", limit + 1, 8);
    expect(f.dispatch("click", 0, 7, 1, f.list).defaultPrevented).toBe(false);
    f.dispatch("pointermove", limit + 1);
    f.dispatch("pointerup", limit + 1, 8);
    f.dispatch("pointerup", limit + 1);
    expect(f.dispatch("click", 0, -1, 0, f.list).defaultPrevented).toBe(false);
    expect(f.dispatch("click", 0, 8, 1, f.list).defaultPrevented).toBe(false);
    expect(f.dispatch("click").defaultPrevented).toBe(true);
    expect(f.calls()).toEqual([]);

    // A physical MouseEvent without pointer identity still suppresses the release on this list.
    f.dispatch("pointerdown");
    f.dispatch("pointermove", limit + 1);
    f.dispatch("pointerup", limit + 1);
    expect(f.dispatch("click", 0, null).defaultPrevented).toBe(true);
    expect(f.calls()).toEqual([]);

    f.dispatch("pointerdown");
    f.dispatch("pointermove", limit);
    f.dispatch("pointerup", limit);
    expect(f.dispatch("click", limit).defaultPrevented).toBe(false);
    expect(f.calls()).toEqual([[f.id]]);
    if (kind === "jobs") {
      expect(f.acceptJob).not.toHaveBeenCalled();
      f.station.layers.inner.back();
    }
    f.station.dispose();
    expect(f.action.available()).toBe(false);
    f.action.activate();
    expect(f.calls()).toEqual(kind === "shop" ? [[f.id]] : []);
  },
);

it.each(["shop", "jobs"] as const)(
  "allows a fresh pointerless %s click after another pointer drags without a click",
  (kind) => {
    const f = stationList(kind);
    f.dispatch("pointerdown");
    f.dispatch("pointermove", SCROLL.dragThreshold + 1);
    f.dispatch("pointerup", SCROLL.dragThreshold + 1);
    expect(f.calls()).toEqual([]);

    f.dispatch("pointerdown", 0, 8);
    f.dispatch("pointerup", 0, 8);
    const click = f.dispatch("click", 0, null);
    expect({ calls: f.calls(), prevented: click.defaultPrevented }).toEqual({
      calls: [[f.id]],
      prevented: false,
    });
  },
);

it.each(["shop", "jobs"] as const)(
  "keeps the registered %s action available after a canceled drag",
  (kind) => {
    const f = stationList(kind);
    f.dispatch("pointerdown");
    f.dispatch("pointermove", SCROLL.dragThreshold + 1);
    f.dispatch("pointercancel", SCROLL.dragThreshold + 1);
    expect(f.dispatch("click", 0, null, 1, f.list).defaultPrevented).toBe(false);
    expect(f.action.available()).toBe(true);
    expect(f.action.rule.holdMs).toBe(500);
    f.action.activate();
    expect(f.calls()).toEqual([[f.id]]);
  },
);

it("audits prepared off-page Shop rows after inert measurement has been removed", () => {
  const f = constructedStation();
  f.state.corruptRow = "item-7";
  f.native.get("shop-back")!.body.clientHeight = 96;
  f.station.setOpen(true);
  expect(() => f.activate(f.action("open-shop"))).toThrow("no registered action binding");
  expect(f.parent.querySelectorAll(".ada-shop-measure")).toEqual([]);
  expect(f.parent.querySelector('[data-item="item-7"]')).toBeNull();
  expect(f.native.get("shop-back")!.frame.hidden).toBe(true);
  expect(f.buy).not.toHaveBeenCalled();
});

it("audits completed Jobs reconstruction before replacement-row focus", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-jobs"));
  const row = f.parent.querySelector('[data-job="job-1"]')!;
  f.activate(row);
  expect(f.acceptJob).not.toHaveBeenCalled();
  f.state.corruptRow = "job-1";
  expect(() => f.activate(f.action("confirm-buy"))).toThrow("no registered action binding");
  expect(f.acceptJob).toHaveBeenCalledExactlyOnceWith("job-1");
  expect(f.native.get("jobs-back")!.frame.hidden).toBe(true);
});

it("opens unmutated Jobs details then accepts and focuses the same active row", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-jobs"));
  const row = f.parent.querySelector('[data-job="job-1"]')!;
  expect(
    row.querySelectorAll(".ada-shop-name")[0]!.children.map((part) => part.textContent),
  ).toEqual(["Job", "Detail"]);
  f.activate(row);
  expect(f.acceptJob).not.toHaveBeenCalled();
  expect(f.native.get("confirm-cancel-x")!.title.textContent).toBe("Job");
  expect(f.action("confirm-buy").textContent).toBe(f.labels.jobAccept);
  const detail = f.native.get("confirm-cancel-x")!.body;
  expect(detail.children.slice(0, 2).map((part) => part.textContent)).toEqual([
    "Detail",
    "Keeper brief.",
  ]);
  const reward = detail.querySelector(".ada-confirm-stardust")!;
  expect(reward).not.toBeNull();
  expect(
    reward.children.map((child) => [child.textContent, child.getAttribute("aria-hidden")]),
  ).toEqual([
    [`${f.labels.questReward}: 10`, "true"],
    [`${f.labels.questReward}: 10 Stardust`, null],
  ]);
  expect(detail.querySelectorAll(".ada-confirm-left")).toEqual([]);
  f.activate(f.action("confirm-cancel"));
  expect(f.doc.activeElement).toBe(row);
  f.activate(row);
  f.activate(f.action("confirm-buy"));
  expect(f.acceptJob).toHaveBeenCalledExactlyOnceWith("job-1");
  expect(f.parent.querySelector('[data-state="inUse"]')).toBe(f.doc.activeElement);
});

it("audits rebuilt purchase confirmation before strict-dialog focus", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-shop"));
  f.native.get("confirm-cancel-x")!.body.className = "ada-card-body";
  f.state.corruptConfirmation = true;
  expect(() => f.activate(f.parent.querySelector('[data-item="item-0"]')!)).toThrow(
    "no registered action binding",
  );
  expect(f.buy).not.toHaveBeenCalled();
  expect(f.parent.children.find((node) => node.dataset.stationConfirm !== undefined)!.hidden).toBe(
    true,
  );
});

it("keeps the same Station footer and balances on welcome, Shop, Jobs and Exchange", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  const footer = f.parent.querySelector(".ada-station-footer")!;
  const balances = f.parent.querySelector(".ada-station-balances")!;
  expect(f.native.get("station-back")!.title.textContent).toBe("Actual Station");
  expect(f.native.get("station-back")!.frame.contains(f.action("open-shop"))).toBe(true);
  expect(f.native.get("station-back")!.skip.parentElement).toBeNull();
  expect(
    f.parent.querySelectorAll("button").some((button) => button.textContent === f.labels.continue),
  ).toBe(false);
  expect(footer.children.map((button) => button.dataset.action)).toEqual([
    "open-shop",
    "open-jobs",
    "open-exchange",
    "undock",
  ]);
  for (const [action, card] of [
    ["open-shop", "shop-back"],
    ["open-jobs", "jobs-back"],
    ["open-exchange", "exchange-back"],
  ] as const) {
    f.activate(f.action(action));
    const frame = f.native.get(card)!.frame;
    expect(frame.contains(footer)).toBe(true);
    expect(frame.contains(balances)).toBe(true);
    expect(f.parent.querySelectorAll(".ada-station-footer")).toEqual([footer]);
    expect(f.doc.activeElement).toBe(f.action(action));
  }
  f.station.layers.inner.back();
  expect(f.doc.activeElement).toBe(f.action("open-exchange"));
  expect(f.native.get("station-back")!.frame.contains(footer)).toBe(true);
});

it("gives each board heading one spoken Stardust hint", () => {
  const f = constructedStation("", true, true, undefined, true);
  f.station.setOpen(true);
  f.activate(f.action("open-jobs"));
  const hints = f.native.get("jobs-back")!.body.querySelectorAll(".ada-station-pane-hint");
  expect(hints.map((hint) => hint.parentElement?.getAttribute("aria-label"))).toEqual([
    `${f.labels.jobs} (Rewards Stardust)`,
    `${f.labels.communityProjects} (Contributions Stardust)`,
  ]);
  expect(hints.map((hint) => hint.textContent)).toEqual(["Rewards", "Contributions"]);
  expect(hints.map((hint) => hint.getAttribute("aria-hidden"))).toEqual(["true", "true"]);
});

function expectContribution(detail: StationFixtureNode, visible: number): void {
  const lines = detail.querySelectorAll(".ada-confirm-stardust");
  expect(lines).toHaveLength(1);
  const [amount, spoken] = lines[0]!.children;
  expect(amount?.textContent).toBe(`Contribution: ${visible}`);
  expect(amount?.getAttribute("aria-hidden")).toBe("true");
  expect(spoken?.textContent).toBe(`Contribution: ${visible} Stardust`);
  expect(spoken?.getAttribute("aria-hidden")).toBeNull();
}

it("keeps the Jobs & Projects route for Jobs without showing a Community projects pane", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  expect(f.action("open-jobs").textContent).toBe(f.labels.jobsProjects);
  f.activate(f.action("open-jobs"));
  const board = f.native.get("jobs-back")!;
  expect(board.title.textContent).toBe(f.labels.jobsProjects);
  const job = board.body.querySelector('[data-job="job-1"]')!;
  expect(job.closest("[hidden]")).toBeNull();
  const projects = board.body.querySelector(".ada-station-projects")!;
  expect(projects.parentElement?.hidden).toBe(true);
  expect(projects.children).toHaveLength(0);
});

it("opens Jobs and Projects and can donate at a project-only station", () => {
  const f = constructedStation("", true, true, undefined, true);
  f.station.setOpen(true);
  expect(f.action("open-shop").hidden).toBe(true);
  expect(f.action("open-jobs").hidden).toBe(false);
  f.activate(f.action("open-jobs"));
  expect(f.native.get("jobs-back")!.title.textContent).toBe(f.labels.jobsProjects);
  expect(f.parent.querySelectorAll("[data-job]")).toHaveLength(0);
  const projects = f.native.get("jobs-back")!.body.querySelector(".ada-station-projects")!;
  expect(projects.parentElement?.hidden).toBe(false);
  f.request.mockReturnValue({
    about: "Restore the orchard.",
    action: f.labels.jobAccept,
    kind: "confirm",
    price: 10,
    title: "Orchard",
  });
  f.activate(f.parent.querySelector('[data-item="project:orchard"]')!);
  const confirmation = f.native.get("confirm-cancel-x")!;
  expect(confirmation.title.textContent).toBe("Orchard");
  expect(confirmation.body.querySelector(".ada-confirm-about")?.textContent).toBe(
    "Restore the orchard.",
  );
  expectContribution(confirmation.body, 10);
  expect(confirmation.body.querySelectorAll(".ada-confirm-left")).toEqual([]);
  expect(f.action("confirm-buy").textContent).toBe(f.labels.jobAccept);
  f.activate(f.action("confirm-buy"));
  expect(f.buy).toHaveBeenCalledExactlyOnceWith("project:orchard");
  expect(f.doc.activeElement?.dataset.item).toBe("project:orchard");
});

it("labels a guarded project contribution without authorizing its purchase", () => {
  const f = constructedStation("", true, true, undefined, true);
  f.station.setOpen(true);
  f.activate(f.action("open-jobs"));
  const row = f.parent.querySelector('[data-item="project:orchard"]')!;
  f.request.mockReturnValue({ kind: "refused" });
  f.activate(row);
  const confirmation = f.native.get("confirm-cancel-x")!;
  expectContribution(confirmation.body, 10);
  expect(confirmation.body.querySelectorAll(".ada-confirm-left")).toEqual([]);
  f.activate(f.action("confirm-buy"));
  expect(f.buy).not.toHaveBeenCalled();
  expect(confirmation.frame.hidden).toBe(false);
  f.activate(f.action("confirm-cancel"));
  expect(f.doc.activeElement).toBe(row);
});

it.each(["shop", "job", "project", "guarded project"] as const)(
  "cancels the %s confirmation once with its top-right X and returns focus",
  (kind) => {
    const project = kind === "project" || kind === "guarded project";
    const f = constructedStation("", true, true, undefined, project);
    f.station.setOpen(true);
    f.activate(f.action(kind === "shop" ? "open-shop" : "open-jobs"));
    if (kind === "guarded project") {
      f.request.mockReturnValue({ kind: "refused" });
    }
    const selector =
      kind === "shop"
        ? '[data-item="item-0"]'
        : project
          ? '[data-item="project:orchard"]'
          : '[data-job="job-1"]';
    const row = f.parent.querySelector(selector)!;
    f.activate(row);
    const confirm = f.native.get("confirm-cancel-x")!;
    const cancel = confirm.body
      .querySelectorAll("button")
      .filter((button) => button.dataset.action === "confirm-cancel");
    expect(cancel).toHaveLength(1);
    expect(confirm.frame.contains(f.action("confirm-cancel-x"))).toBe(true);
    expect(confirm.body.contains(f.action("confirm-cancel-x"))).toBe(false);
    if (kind === "guarded project") {
      f.activate(f.action("confirm-buy"));
      expect(confirm.frame.closest("[hidden]")).toBeNull();
    }
    f.activate(f.action("confirm-cancel-x"));
    expect(confirm.frame.closest("[hidden]")).not.toBeNull();
    expect(f.doc.activeElement).toBe(row);
    expect(f.buy).not.toHaveBeenCalled();
    expect(f.acceptJob).not.toHaveBeenCalled();
    expect(f.undock).not.toHaveBeenCalled();
  },
);

it("audits the completed welcome view before strict focus on reopening", () => {
  const f = constructedStation();
  const unbound = new f.Node("button", false);
  unbound.hidden = true;
  f.native.get("station-back")!.frame.append(unbound);
  expect(() => f.station.setOpen(true)).toThrow("no registered action binding");
  expect(f.doc.activeElement).toBeNull();
});

const stockOffer = (key: string, name = key): stationSource.StationRow => ({
  glyph: { key: "icon-shop-weapon-laser", kind: "sprite" },
  group: "items",
  key,
  level: "Offer details",
  name,
  price: 10,
  state: "forSale",
});
const stockFixture = (groups: () => stationSource.StationShopGroups | undefined) =>
  constructedStation("", true, true, undefined, false, undefined, groups);
const approvedGroups = (
  left: readonly stationSource.StationRow[],
  right: readonly stationSource.StationRow[],
): stationSource.StationShopGroups => [
  { category: "ammo", label: "Ammo", offers: left },
  { category: "equipment", label: "Equipment", offers: right },
];

it("renders all eight ordered fixed Shop offers, using the same guarded Buy and focus path", () => {
  const left = ["ammo0", "ammo1", "ammo2", "ammo3"].map((id) => stockOffer(id));
  const right = ["equipment0", "equipment1", "equipment2", "holodisk"].map((id) => stockOffer(id));
  let groups = approvedGroups(left, right);
  const f = stockFixture(() => groups);
  f.station.setOpen(true);
  f.activate(f.action("open-shop"));
  const body = f.native.get("shop-back")!.body;
  const offers = () => body.querySelectorAll("button");
  expect(offers().map((node) => node.dataset.item)).toEqual(
    [...left, ...right].map(({ key }) => key),
  );
  expect(body.querySelectorAll(".ada-shop-tabs")).toHaveLength(0);
  expect(body.querySelectorAll(".ada-station-pager")).toHaveLength(0);
  const row = offers()[5]!;
  f.activate(row);
  expect(f.buy).not.toHaveBeenCalled();
  expect(f.native.get("confirm-cancel-x")!.body.querySelectorAll(".ada-well")).toHaveLength(1);
  f.activate(f.action("confirm-cancel"));
  expect(f.doc.activeElement).toBe(row);
  f.activate(row);
  f.activate(f.action("confirm-buy"));
  expect(f.buy).toHaveBeenCalledExactlyOnceWith("equipment1");
  expect(f.doc.activeElement?.dataset.item).toBe("equipment1");

  f.activate(offers()[5]!);
  groups = approvedGroups(left, [right[0]!, right[2]!, right[3]!]);
  f.activate(f.action("confirm-buy"));
  expect(f.buy).toHaveBeenCalledOnce();
  expect(f.doc.activeElement?.dataset.item).toBe("equipment2");
});

it("keeps sparse panes and hides Shop when its provider has no stock", () => {
  let groups: stationSource.StationShopGroups | undefined = approvedGroups(
    [],
    [stockOffer("holodisk")],
  );
  const f = stockFixture(() => groups);
  f.station.setOpen(true);
  f.activate(f.action("open-shop"));
  const body = f.native.get("shop-back")!.body;
  expect(body.querySelectorAll(".ada-stock-rows").map((list) => list.children.length)).toEqual([
    0, 1,
  ]);
  expect(body.querySelectorAll("button").map((node) => node.dataset.item)).toEqual(["holodisk"]);
  groups = undefined;
  f.station.layers.inner.back();
  expect(f.action("open-shop").hidden).toBe(true);
  expect(f.native.get("shop-back")!.frame.hidden).toBe(true);
  expect(f.action("open-jobs").hidden).toBe(false);
  expect(f.action("open-exchange").hidden).toBe(false);
  expect(body.querySelectorAll(".ada-shop-tabs")).toEqual([]);
  expect(body.querySelectorAll(".ada-station-pager")).toEqual([]);
});

it("rejects an oversized fixed stock batch without silently dropping eligible rows", () => {
  const f = stockFixture(() =>
    approvedGroups(
      Array.from({ length: 5 }, (_, i) => stockOffer(String(i))),
      [],
    ),
  );
  expect(() => f.station.setOpen(true)).toThrow(
    "Shop requires two distinct groups of up to four unique offers",
  );
  expect(f.native.get("shop-back")!.frame.hidden).toBe(true);
  expect(f.buy).not.toHaveBeenCalled();
});

it("keeps an unbound fixed Shop offer out of the mounted pane", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.state.corruptRow = "item-0";
  expect(() => f.activate(f.action("open-shop"))).toThrow("no registered action binding");
  const shop = f.native.get("shop-back")!;
  expect(shop.frame.hidden).toBe(true);
  expect(shop.body.querySelectorAll("[data-item]")).toEqual([]);
  expect(f.request).not.toHaveBeenCalled();
});
