import { existsSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import type { StationServices } from "../model/stationServices.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { cardPages } from "./layout/cardPages.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import { frameSize } from "./layout/frameBox.ts";
import * as shopCardLayout from "./layout/shopCard.ts";
import { SPACING } from "./layout/tokens.ts";
import { VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { isTap } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { currentView, inCurrentView, rootPressGuard } from "./pressScope.ts";
import * as stationSource from "./station.ts";
import {
  jobAction,
  rowAction,
  STATION_STYLE,
  stationBack,
  stationJobsShown,
  stationTabs,
  weaponItemGlyph,
} from "./station.ts";
import { stationJobRowTree, stationJobsTree } from "./stationJobsTree.ts";
import { stationMenuTree } from "./stationMenuTree.ts";
import { stationPagerTree } from "./stationPagerTree.ts";
import { stationShopRowTree, stationShopTree } from "./stationShopTree.ts";
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
  it("accept offers, keep refused offers tappable so they refuse, and drop the held job", () => {
    expect(jobAction("offer")).toBe("accept");
    expect(jobAction("busy")).toBe("accept");
    expect(jobAction("held")).toBe("drop");
  });
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

  it("gives job rows their type's sheet and a compact action that takes no press of its own", () => {
    for (const type of ["survey", "delivery", "rescue", "hunt", "activity"]) {
      expect(
        existsSync(new URL(`../../public/art/ui/sprites/icon-job-${type}.png`, import.meta.url)),
      ).toBe(true);
    }
    expect(STATION_STYLE).toContain(".ada-controls .ada-job-action.ada-compact{");
    expect(STATION_STYLE).toContain("pointer-events:none");
    expect(STATION_STYLE).toContain("var(--ui-button-primary-disabled)");
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
    ["equipment", ["ship", "exchange"], false],
    ["weaponsAmmo", ["weapons", "exchange"], false],
    ["jobs", ["exchange"], true],
  ] as const)("shows only the %s specialty while retaining Exchange", (service, tabs, jobs) => {
    const actual = { ...exchangeOnly, [service]: true };
    expect(stationTabs(actual)).toEqual(tabs);
    expect(stationJobsShown(actual)).toBe(jobs);
  });

  it("keeps held-task Drop and existing Projects independent of specialist offers", () => {
    const held = { ...exchangeOnly, heldTask: true, projects: true };
    expect(stationJobsShown(held)).toBe(true);
    expect(stationTabs(held)).toEqual(["projects", "exchange"]);
    expect(stationTabs(exchangeOnly)).toEqual(["exchange"]);
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
    expect(stationTabs(hub)).toEqual(["weapons", "ship", "projects", "exchange"]);
    expect(stationJobsShown(hub)).toBe(true);
    expect(stationTabs(null)).toEqual([]);
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
    onRemove?: () => void;
    onAttribute?: (name: string) => void;
    remove() {
      this.onRemove?.();
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
          this.className.includes("ada-shop-row") ||
          this.className.includes("page-row") ||
          this.className.includes("ada-shop-group")
            ? 32
            : 24,
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

function constructedStation(
  fault = "",
  connected = true,
  owned = true,
  permits: () => boolean = () => true,
) {
  const f = strictStation();
  const { Node } = f;
  const parent = new Node("div", connected);
  if (owned) {
    strictCleanup.push(registerAdaActionRoot({ permits }, parent as unknown as HTMLElement));
  }
  const state = { corruptConfirmation: false, corruptRow: "", greetingIndex: 0 };
  const measurements: { ids: string[]; registered: boolean[] }[] = [];
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
      controls.append(skip);
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
    node.onRemove = () => {
      if (node.className === "ada-shop-measure" && node.isConnected) {
        const rows = node.querySelectorAll("button");
        measurements.push({
          ids: rows.map((row) => row.dataset.item ?? row.dataset.job ?? ""),
          registered: rows.map(
            (row) =>
              resolveAdaHoldAction(
                parent as unknown as HTMLElement,
                row as unknown as HTMLElement,
              ) !== null,
          ),
        });
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
      "nextLine",
      "owned",
      "projectFunded",
      "projects",
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
    request = vi.fn(() => ({
      about: "About",
      action: "Buy",
      kind: "confirm" as const,
      left: "Left",
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
    advanceGreeting: () => {
      state.greetingIndex++;
    },
    balance: () => ({ amount: 100, text: "100 Stardust" }),
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
      index: state.greetingIndex,
      keeper: "slate",
      line: "Greeting",
    }),
    jobs: () => jobs,
    labels,
    reducedMotion: () => true,
    request,
    rows: () => rows,
    select,
    services: () => ({
      equipment: true,
      exchange: true,
      heldTask: false,
      jobs: true,
      projects: false,
      weaponsAmmo: true,
    }),
    undock,
  };
  const context = createContext({
    ...stationSource,
    ...shopCardLayout,
    CONTENT,
    EXCHANGE_COPY,
    FOCUS_RING,
    HTMLElement: Node,
    SCROLL,
    SCROLL_RESERVE_CLASS: "ada-scroll-reserve",
    SPACING,
    SPRITES: "/art/",
    VIEW_SCALE_EVENT,
    assertAdaActionBindings,
    assertAdaActionMetadata,
    bindAdaAction,
    cardPages,
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
    focusTarget: (node: InstanceType<typeof Node>) => node.focus(),
    frameSize,
    getComputedStyle,
    inCurrentView,
    isTap,
    mountLayout,
    options,
    parent,
    readViewUnit: () => 1,
    refuse: vi.fn(),
    setFooterAction: (intent: string, row: InstanceType<typeof Node>) => {
      row.dataset.footerAction = intent;
    },
    setStationItemTitle: (_glyph: unknown, text: string, node: InstanceType<typeof Node>) => {
      node.textContent = text;
    },
    stationJobRowTree,
    stationJobsTree,
    stationMenuTree,
    stationPagerTree,
    stationShopRowTree,
    stationShopTree,
    units,
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
    measurements,
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

it("keeps inert measurement rows unregistered and registers only completed real Shop rows", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-shop"));
  expect(f.measurements.length).toBeGreaterThan(0);
  expect(
    f.measurements.every((sample) => sample.registered.every((registered) => !registered)),
  ).toBe(true);
  expect(f.parent.querySelectorAll(".ada-shop-measure")).toEqual([]);
  const row = f.parent.querySelector('[data-item="item-0"]')!;
  expect(
    resolveAdaHoldAction(f.parent as unknown as HTMLElement, row as unknown as HTMLElement),
  ).not.toBeNull();
  f.activate(row);
  expect(f.request).toHaveBeenCalledExactlyOnceWith("item-0");
  f.activate(f.action("confirm-buy"));
  expect(f.buy).toHaveBeenCalledExactlyOnceWith("item-0");
});

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
  f.state.corruptRow = "job-1";
  expect(() => f.activate(row)).toThrow("no registered action binding");
  expect(f.acceptJob).toHaveBeenCalledExactlyOnceWith("job-1");
  expect(f.native.get("jobs-back")!.frame.hidden).toBe(true);
});

it("retains original Jobs accept and replacement-row registration", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  f.activate(f.action("open-jobs"));
  const row = f.parent.querySelector('[data-job="job-1"]')!;
  f.activate(row);
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

it("does not rescan completed Station controls for greeting text changes", () => {
  const f = constructedStation();
  f.station.setOpen(true);
  const frame = f.native.get("station-back")!.frame;
  const queries = vi.spyOn(frame, "querySelectorAll");
  const next = frame
    .querySelectorAll("button")
    .find((node) => node.textContent === f.labels.nextLine)!;
  queries.mockClear();
  f.activate(next);
  expect(f.state.greetingIndex).toBe(1);
  expect(queries).not.toHaveBeenCalled();
});

it("audits the completed welcome view before strict focus on reopening", () => {
  const f = constructedStation();
  const unbound = new f.Node("button", false);
  unbound.hidden = true;
  f.native.get("station-back")!.frame.append(unbound);
  expect(() => f.station.setOpen(true)).toThrow("no registered action binding");
  expect(f.doc.activeElement).toBeNull();
});
