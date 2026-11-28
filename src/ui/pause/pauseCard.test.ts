import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { ControlState } from "../../input/state.ts";
import type { LocalMap, MapPlace } from "../../model/map.ts";
import * as actionBinding from "../actions/actionBinding.ts";
import { fixtureActionRoot } from "../actions/actionRootFixture.ts";
import { inCurrentView } from "../actions/pressScope.ts";
import * as mapUI from "../map/index.ts";
import { mapScreenLabels } from "../map/index.ts";
import type { MapScreenState } from "../map/mapScreen.ts";
import * as pauseActions from "../pause.ts";
import * as refusal from "../refusal.ts";
import { createShipPaintCard, type ShipPaintOptions, type ShipView } from "../ship/index.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "./pauseCard.ts";

// Every focus() call, latest last, with the options of the latest.
const focusLog: FakeElement[] = [];
const focused = () => focusLog.at(-1);
let lastFocusOptions: unknown;

// The cards' document, where the kit tracks input modality.
function createDocument() {
  return Object.assign(new EventTarget(), {
    activeElement: null as FakeElement | null,
    body: null as FakeElement | null,
    createElement: (tagName: string): FakeElement =>
      Object.assign(new FakeElement(), { tagName: tagName.toUpperCase() }),
    createElementNS: (): FakeElement => new FakeElement(),
    createTextNode: (text: string): FakeElement =>
      Object.assign(new FakeElement(), { nodeType: 3, nodeValue: text }),
    defaultView: Object.assign(new EventTarget(), {
      Element: FakeElement,
      get HTMLElement() {
        return FakeElement;
      },
      get Node() {
        return FakeElement;
      },
      getComputedStyle: () => ({}),
    }),
    fonts: Object.assign(new EventTarget(), { status: "loaded" }),
  });
}
let PAGE: ReturnType<typeof createDocument>;

function dispatchEscape() {
  const target = PAGE.activeElement;
  const event = (type: string) =>
    Object.assign(new Event(type, { cancelable: true }), {
      code: "Escape",
      composedPath: () => [target, PAGE, PAGE.defaultView],
      key: "Escape",
    });
  const down = event("keydown");
  PAGE.defaultView.dispatchEvent(down);
  PAGE.defaultView.dispatchEvent(event("keyup"));
  return down;
}

// A stand-in for the few DOM members the pause cards and the map screen's construction use.
class FakeElement {
  readonly attributes = new Map<string, string>();
  nodeType = 1;
  readonly childNodes: FakeElement[] = [];
  private data = "";
  get children(): FakeElement[] {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }
  get firstChild(): FakeElement | null {
    return this.childNodes[0] ?? null;
  }
  get nodeValue(): string | null {
    return this.nodeType === 3 ? this.data : null;
  }
  set nodeValue(value: string | null) {
    if (this.nodeType === 3) {
      this.data = value ?? "";
    }
  }
  get textContent(): string {
    return this.nodeType === 3
      ? this.data
      : this.childNodes.map((node) => node.textContent).join("");
  }
  set textContent(value: string) {
    if (this.nodeType === 3) {
      this.data = value;
    } else {
      this.replaceChildren(...(value ? [PAGE.createTextNode(value)] : []));
    }
  }
  parentElement: FakeElement | null = null;
  readonly clientWidth = 720;
  readonly clientHeight = 360;
  tabIndex = 0;
  tagName = "DIV";
  get isConnected(): boolean {
    return this === PAGE.body || (this.parentElement?.isConnected ?? false);
  }
  className = "";
  readonly classList = {
    add: (name: string) => {
      this.className = [...new Set([...this.className.split(" "), name])].filter(Boolean).join(" ");
    },
    remove: (name: string) => {
      this.className = this.className
        .split(" ")
        .filter((value) => value !== name)
        .join(" ");
    },
    toggle: (name: string, on: boolean) => {
      if (on) {
        this.classList.add(name);
      } else {
        this.classList.remove(name);
      }
    },
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, ((event: Event) => void)[]>();
  readonly ownerDocument = PAGE;
  readonly style: Record<string, unknown> = {
    getPropertyValue: () => "",
    removeProperty: vi.fn(),
    setProperty: vi.fn(),
  };
  type = "";
  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== listener),
    );
  }
  get parentNode(): FakeElement | null {
    return this.parentElement;
  }
  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }
  get nextSibling(): FakeElement | null {
    const siblings = this.parentElement?.childNodes;
    return siblings?.[siblings.indexOf(this) + 1] ?? null;
  }
  insertBefore(node: FakeElement, before: FakeElement | null): FakeElement {
    if (node === before) {
      return node;
    }
    node.remove();
    node.parentElement = this;
    this.childNodes.splice(
      before ? this.childNodes.indexOf(before) : this.childNodes.length,
      0,
      node,
    );
    return node;
  }
  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(...nodes: FakeElement[]): void {
    const before = this.firstChild;
    for (const node of nodes) {
      this.insertBefore(node, before);
    }
  }
  click(): void {
    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "detail", { value: 0 });
    for (const listener of this.listeners.get("click") ?? []) {
      listener(event);
    }
  }
  closest(selector: string): FakeElement | null {
    if (
      (selector.includes("hidden") && this.hidden) ||
      (selector.includes("inert") && this.attributes.has("inert"))
    ) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }
  contains(node: unknown): boolean {
    return this === node || this.childNodes.some((child) => child.contains(node));
  }
  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  matches(selector = "button"): boolean {
    return selector.split(",").some((part) => {
      const rule = part.trim();
      if (rule === ":disabled") {
        return Boolean((this as unknown as HTMLButtonElement).disabled);
      }
      if (rule.startsWith(".")) {
        return this.className.split(" ").includes(rule.slice(1));
      }
      const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(rule);
      if (attribute) {
        const name = attribute[1]!;
        const value = name.startsWith("data-")
          ? this.dataset[name.slice(5)]
          : this.getAttribute(name);
        return attribute[2] === undefined
          ? value !== undefined && value !== null
          : value === attribute[2];
      }
      const tag = /^(\w+)(?:\[type="([^"]+)"\])?$/.exec(rule);
      return Boolean(
        tag &&
        this.tagName.toLowerCase() === tag[1] &&
        (tag[2] === undefined || this.type === tag[2]),
      );
    });
  }
  focus(options?: unknown): void {
    PAGE.activeElement = this;
    focusLog.push(this);
    lastFocusOptions = options;
  }
  getBoundingClientRect() {
    return { height: this.clientHeight, left: 0, top: 0, width: this.clientWidth, x: 0, y: 0 };
  }
  getContext(): null {
    return null;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector?: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  cloneNode(): FakeElement {
    return Object.assign(new FakeElement(), { className: this.className });
  }
  remove(): void {
    if (this.parentElement) {
      const siblings = this.parentElement.childNodes;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  replaceChildren(...nodes: FakeElement[]): void {
    for (const node of [...this.childNodes]) {
      node.remove();
    }
    this.append(...nodes);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, on: boolean): void {
    if (on) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
}

// DOM image decoding completes asynchronously without fetching assets in Node.
class FakeImage extends FakeElement {
  alt = "";
  draggable = true;
  loading = "auto";
  src = "";
  decode(): Promise<void> {
    return Promise.resolve();
  }
}

const LABELS: PauseLabels = {
  achievements: "Achievements",
  backToTitle: "Back to title",
  cheats: "Cheats",
  close: "Close",
  map: "Map",
  mapScreen: mapScreenLabels(CONTENT.labels),
  resume: "Resume",
  settings: "Settings",
  ship: "Ship",
  shipHeadings: {
    ammo: CONTENT.labels.ammo!,
    cargo: "Cargo",
    equipment: "Equipment",
    weapons: CONTENT.labels.shopWeapons!,
  },
  shipRows: CONTENT.labels,
  title: "Paused",
};

const SHIP: ShipView = {
  aboard: null,
  engine: 1,
  holodisks: 2,
  ore: 12,
  paint: "Sky blue",
  shield: 2,
  stardust: 1234,
  tractor: 1,
  weapons: [{ ammo: null, id: "laser", level: 1 }],
};

beforeEach(() => {
  PAGE = createDocument();
  PAGE.body = new FakeElement();
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal(
    "MutationObserver",
    class {
      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("document", PAGE);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(async () => {
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const MAP: LocalMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  mapped: 25,
  places: [],
  player: { x: 0, y: 0 },
  quests: [],
  searchArea: null,
};
const state = (change: Partial<PauseState> = {}): PauseState => ({
  canMap: true,
  carrying: false,
  field: null,
  inDanger: false,
  job: null,
  map: MAP,
  place: "flight",
  ship: SHIP,
  stardust: 50,
  towing: false,
  ...change,
});

function mountedRoot() {
  const root = fixtureActionRoot(new FakeElement());
  PAGE.body!.append(root);
  return root;
}

function shipPaintFixture() {
  const root = mountedRoot();
  let selected = "classic";
  const select = vi.fn((id: string) => {
    selected = id;
  });
  const card = createShipPaintCard(root as unknown as HTMLElement, {
    applyLabel: "Apply",
    backLabel: "Back",
    closeLabel: "Close",
    current: () => selected,
    inUseLabel: "In use",
    onClose: vi.fn(),
    schemes: () => [
      { id: "classic", name: "Classic" },
      { id: "cobalt", name: "Cobalt" },
    ],
    select,
    title: "Ship paint",
  });
  return { card, root, select };
}

it("retains the attached paint buttons, selection guard and focus transfer", () => {
  const { card, root, select } = shipPaintFixture();
  try {
    card.open();
    const [classic, cobalt] = root.querySelectorAll('[data-action="apply-ship-paint"]');
    const stack = root.querySelector(".ada-ship-paint-grid")!.children[0]!;
    const [row] = stack.children;
    expect(stack.matches(".ui-layout-stack")).toBe(true);
    expect(row!.getAttribute("data-ui-layout-sizing")).toBe("equal");
    expect(row!.children.map((tile) => tile.dataset.paint)).toEqual([
      "classic",
      "cobalt",
      undefined,
    ]);
    expect(classic!.textContent).toBe("In use");
    expect(classic!.matches(":disabled")).toBe(true);
    classic!.click();
    expect(select).not.toHaveBeenCalled();
    expect(cobalt!.getAttribute("aria-describedby")).toBe("ada-ship-paint-name-cobalt");
    cobalt!.focus();
    actionBinding
      .resolveAdaHoldAction(root as unknown as HTMLElement, cobalt as unknown as HTMLElement)!
      .activate();
    expect(select).toHaveBeenCalledExactlyOnceWith("cobalt");
    expect(root.querySelectorAll('[data-action="apply-ship-paint"]')).toEqual([classic, cobalt]);
    expect(classic!.textContent).toBe("Apply");
    expect(cobalt!.textContent).toBe("In use");
    expect(focused()).toBe(classic);
  } finally {
    card.dispose();
  }
});

it("rejects a paint button missing its binding before publishing the grid", () => {
  const { card, root, select } = shipPaintFixture();
  const grid = root.querySelector(".ada-ship-paint-grid")!;
  const append = vi.spyOn(grid, "append");
  const bind = actionBinding.bindAdaAction;
  const registered: HTMLElement[] = [];
  vi.spyOn(actionBinding, "bindAdaAction")
    .mockImplementationOnce((options, button) => {
      registered.push(button);
      return bind(options, button);
    })
    .mockImplementationOnce(() => ({ activate: () => false, dispose() {}, update() {} }));
  try {
    expect(() => card.open()).toThrow("no registered action binding");
    expect(append).not.toHaveBeenCalled();
    expect(grid.children).toEqual([]);
    expect(card.isOpen()).toBe(false);
    expect(registered).toHaveLength(1);
    expect(() => actionBinding.assertAdaActionMetadata(registered[0]!)).toThrow(
      "no registered action binding",
    );
    expect(select).not.toHaveBeenCalled();
  } finally {
    card.dispose();
  }
});

function cards(
  detached = false,
  beforeCreate?: (root: FakeElement) => void,
  paint?: ShipPaintOptions,
) {
  const root = detached ? new FakeElement() : mountedRoot();
  beforeCreate?.(root);
  const options = {
    ...(paint ? { paint } : {}),
    labels: LABELS,
    onAchievements: vi.fn(),
    onBackToTitle: vi.fn(),
    onCheats: vi.fn(),
    onGalaxies: vi.fn(),
    onOpenChange: vi.fn(),
    onSettings: vi.fn(),
    onTravel: vi.fn(),
    reducedMotion: () => true,
  };
  const pause = createPauseCards(root as unknown as HTMLElement, options);
  const modal = root.children[0]!;
  const body = modal.children[0]!.children[0]!.children[1]!;
  const ship = modal.children[1]!;
  return { body, modal, options, pause, root, ship };
}

// The grid's buttons in reading order, with Resume last.
const buttonsOf = (actions: FakeElement) => actions.querySelectorAll("button");

const shownActions = (actions: FakeElement) =>
  buttonsOf(actions)
    .filter((button) => !button.hidden)
    .map((button) => button.dataset.action);

const button = (actions: FakeElement, action: string) =>
  buttonsOf(actions).find((node) => node.dataset.action === action)!;

// Every text node under a node, depth first.
const texts = (node: FakeElement): string[] => [
  ...(node.textContent ? [node.textContent] : []),
  ...node.children.flatMap(texts),
];

it("uses the standard parent actions with stable nodes, hidden Map and one native listener", () => {
  const { modal, pause, root } = cards();
  const map = button(modal, "pause-map");
  const resume = button(modal, "pause-resume");
  const resolve = (target: FakeElement) =>
    actionBinding.resolveAdaHoldAction(
      root as unknown as HTMLElement,
      target as unknown as HTMLElement,
    );
  pause.setState(state());
  pause.open();
  for (const control of [map, resume]) {
    expect(control.matches(".ui-standard-button")).toBe(true);
    expect(control.querySelector(".ada-pause-cap-label")?.textContent).toBe(control.textContent);
    expect(control.listeners.get("click")).toHaveLength(1);
    expect(resolve(control)?.available()).toBe(true);
  }
  pause.setState(state({ canMap: false }));
  expect(button(modal, "pause-map")).toBe(map);
  expect(button(modal, "pause-resume")).toBe(resume);
  expect(map.hidden).toBe(true);
  expect(resolve(map)?.available()).toBe(false);
  map.click();
  expect(pause.isOpen()).toBe(true);
  expect(pause.mapOpen()).toBe(false);
  pause.dispose();
  expect(resume.listeners.get("click")).toEqual([]);
  expect(resolve(resume)).toBeNull();
});

it("keeps a declared unavailable action focusable and refuses native and held dispatch", () => {
  const ordered = pauseActions.pauseActions;
  vi.spyOn(pauseActions, "pauseActions").mockImplementation((labels) =>
    ordered(labels).map((action) =>
      action.id === "backToTitle" ? { ...action, available: false } : action,
    ),
  );
  const cue = vi.spyOn(refusal, "refuse");
  const { modal, options, pause, root } = cards();
  pause.setState(state());
  pause.open();
  const exit = button(modal, "pause-backToTitle");
  expect(exit.matches(".ui-standard-button")).toBe(true);
  expect(exit.getAttribute("aria-disabled")).toBe("true");
  expect(exit.getAttribute("aria-description")).toBe("Action unavailable.");
  expect(exit.matches(":disabled")).toBe(false);
  exit.click();
  expect(cue).toHaveBeenCalledTimes(1);
  const held = actionBinding.resolveAdaHoldAction(
    root as unknown as HTMLElement,
    exit as unknown as HTMLElement,
  );
  expect(held?.available()).toBe(true);
  held?.activate();
  expect(cue).toHaveBeenCalledTimes(2);
  expect(options.onBackToTitle).not.toHaveBeenCalled();
  expect(pause.isOpen()).toBe(true);
  pause.dispose();
});

it("admits the visible Pause X alongside Resume and excludes it under Ship", () => {
  const { modal, pause, root } = cards();
  const scoped = (element: FakeElement) =>
    inCurrentView(root as unknown as HTMLElement, element as unknown as HTMLElement);
  const close = button(modal, "close-pause");
  pause.setState(state());
  pause.open();
  expect(scoped(button(modal, "pause-resume"))).toBe(true);
  expect(scoped(close)).toBe(true);
  expect(close.className).toContain("ui-standard-button");
  expect(close.listeners.get("click")).toHaveLength(1);

  button(modal, "pause-ship").click();
  const shipClose = button(modal, "close-ship");
  expect(scoped(shipClose)).toBe(true);
  expect(shipClose.className).toContain("ui-standard-button");
  expect(shipClose.listeners.get("click")).toHaveLength(1);
  expect(scoped(close)).toBe(false);
  pause.dispose();
  expect(close.listeners.get("click")).toHaveLength(0);
  expect(shipClose.listeners.get("click")).toHaveLength(0);
});

function standaloneMap(root = mountedRoot()) {
  const onClose = vi.fn();
  const map = mapUI.createMapScreen(root as unknown as HTMLElement, {
    labels: LABELS.mapScreen,
    onClose,
    onGalaxies: () => {},
    onQuests: () => {},
    onTravel: () => {},
    reducedMotion: () => true,
  });
  return { map, onClose, root };
}

it.each(["map-close", "map-close-x"])("binds the standalone Map %s once", (id) => {
  const { map, onClose, root } = standaloneMap();
  const footer = root.querySelectorAll().find((node) => node.dataset.action === "map-close")!;
  const close = root.querySelectorAll().find((node) => node.dataset.action === "map-close-x")!;
  expect(footer.textContent).toBe("Close");
  expect(close.className.split(" ")).toEqual(
    expect.arrayContaining(["ada-close", "ui-standard-button"]),
  );
  expect(close.getAttribute("aria-label")).toBe("Close");
  const target = id === "map-close" ? footer : close;
  target.click();
  expect(onClose).not.toHaveBeenCalled();
  map.open();
  target.click();
  expect(onClose).toHaveBeenCalledOnce();
  map.dispose();
  target.click();
  expect(onClose).toHaveBeenCalledOnce();
});

const STATION: MapPlace = {
  id: "station:0,0",
  job: false,
  kind: "station",
  label: "Station",
  objective: false,
  symbol: "station",
  travel: true,
  x: 400,
  y: 600,
};
function mapState(places: readonly MapPlace[]): MapScreenState {
  return {
    carrying: false,
    field: null,
    inDanger: false,
    job: null,
    map: { ...MAP, places },
    stardust: 50,
    towing: false,
  };
}
function mapMeasurement() {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "", length: 0 }));
  vi.stubGlobal("devicePixelRatio", 1);
}

it("keeps the Local Map tools named, registered once and revoked when the map closes", () => {
  mapMeasurement();
  const { map, root } = standaloneMap();
  const tools = [
    ["zoomOut", LABELS.mapScreen.zoomOut],
    ["zoomIn", LABELS.mapScreen.zoomIn],
    ["recentre", LABELS.mapScreen.centerOnAda],
  ] as const;
  try {
    map.setState(mapState([STATION]));
    map.open();
    const actions = tools.map(([id, label]) => {
      const tool = button(root, `map-${id}`);
      expect(tool.getAttribute("aria-label")).toBe(label);
      expect(tool.children.map(({ className }) => className)).toEqual(["ada-disc"]);
      expect(tool.listeners.get("click")).toHaveLength(1);
      const action = actionBinding.resolveAdaHoldAction(
        root as unknown as HTMLElement,
        tool as unknown as HTMLElement,
      )!;
      expect(action.available()).toBe(true);
      expect(action.rule.holdMs).toBe(500);
      return { action, tool };
    });
    map.close();
    for (const { action } of actions) {
      expect(action.available()).toBe(false);
    }
    map.dispose();
    for (const { action, tool } of actions) {
      expect(action.available()).toBe(false);
      expect(tool.listeners.get("click")).toHaveLength(0);
    }
  } finally {
    map.dispose();
  }
});

it("keeps the priced Travel here button visible and disabled below 50 Stardust", () => {
  mapMeasurement();
  const { map, root } = standaloneMap();
  try {
    map.setState({ ...mapState([STATION]), stardust: 49 });
    map.open();
    map.locate(STATION.id);
    const travel = root.querySelector('[data-action="map-travel"]')!;
    expect(travel.hidden).toBe(false);
    expect(travel.matches(":disabled")).toBe(true);
    expect(travel.getAttribute("aria-label")).toBe("Travel here, 50 Stardust");
    expect(travel.querySelector(".ui-control-label")?.textContent).toBe("Travel here");
    expect(travel.querySelector(".ada-map-travel-cost")?.textContent).toBe("50");
    map.setState(mapState([STATION]));
    expect(root.querySelector('[data-action="map-travel"]')).toBe(travel);
    expect(travel.matches(":disabled")).toBe(false);
  } finally {
    map.dispose();
  }
});

it.each([
  [false, true, 1, "quest-close"],
  [true, true, 1, "close-quests"],
  [false, false, 2, "quest-close"],
] as const)(
  "opens and returns from selected place quests (blocked=%s, travel=%s, count=%s)",
  (inDanger, travelOffered, count, dismiss) => {
    mapMeasurement();
    const { modal, pause, root } = cards();
    const entries = [
      {
        galaxy: 1 as const,
        id: "story:1:1",
        line: { kind: "story" as const, target: null, text: "Bring food" },
        locations: [],
      },
      {
        galaxy: 1 as const,
        id: "job:1:held",
        line: { kind: "job" as const, target: null, text: "Deliver a parcel" },
        locations: [],
      },
      {
        galaxy: 2 as const,
        id: "story:2:1",
        line: { kind: "story" as const, target: null, text: "Unrelated" },
        locations: [],
      },
    ];
    const site = {
      ...STATION,
      questLinks: entries.slice(0, count).map(({ id, line }) => ({ id, label: line.text })),
      travel: travelOffered,
    };
    pause.setState(
      state({ galaxy: 1, inDanger, map: { ...MAP, places: [site] }, questEntries: entries }),
    );
    pause.open();
    button(modal, "pause-map").click();
    const map = root.children.find((node) => node.dataset.dialog === "map")!;
    const chip = buttonsOf(map).find((node) => node.dataset.place === site.id)!;
    chip.click();
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    const travel = button(map, "map-travel");
    const quest = button(map, "map-quest");
    expect(travel.parentElement?.children).toEqual([travel, quest]);
    expect(travel.hidden).toBe(!travelOffered);
    expect(quest.hidden).toBe(false);
    expect(quest.getAttribute("aria-label")).toBe(count === 1 ? "Quest: Bring food" : "Quest");
    quest.focus();
    quest.click();
    const dialog = root.children.find((node) => node.className.includes("ada-quests-screen"))!;
    expect(dialog.hidden).toBe(false);
    if (count === 2) {
      const rows = buttonsOf(dialog).filter((node) => node.dataset.questId);
      expect(rows.map(({ dataset }) => dataset.questId)).toEqual(
        entries.slice(0, 2).map(({ id }) => id),
      );
      rows[1]!.click();
      expect(texts(dialog)).toContain("Deliver a parcel");
      button(dialog, "quest-back").click();
    } else {
      expect(texts(dialog)).toContain("Bring food");
    }
    button(dialog, dismiss).click();
    expect(dialog.hidden).toBe(true);
    expect(pause.mapOpen()).toBe(true);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(focused()).toBe(quest);
    pause.setState(
      state({
        galaxy: 1,
        map: { ...MAP, places: [{ ...site, questLinks: [] }] },
        questEntries: entries,
      }),
    );
    expect(quest.hidden).toBe(true);
    pause.dispose();
  },
);

function isMapTravelBinding(
  options: actionBinding.AdaActionOptions,
  element: HTMLElement,
): boolean {
  // The factory binds the labelled button before Map assigns data-action.
  return (
    options.nativeClickOwner === "factory" &&
    options.ownAriaDisabled === "refusal-feedback" &&
    element.textContent === LABELS.mapScreen.travelHere
  );
}

it.each(["map-zoomIn", "map-travel"])(
  "rejects missing %s metadata in the completed Map layout before publication",
  (id) => {
    const bind = actionBinding.bindAdaAction;
    const bindings = new WeakMap<HTMLElement, ReturnType<typeof bind>>();
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) => {
      if (id === "map-travel" && isMapTravelBinding(options, element)) {
        return { activate: () => false, dispose() {}, update() {} };
      }
      const binding = bind(options, element);
      bindings.set(element, binding);
      return binding;
    });
    // The Travel leaf is mounted in the hidden panel even without a selection or an action root.
    const root = id === "map-travel" ? new FakeElement() : mountedRoot();
    const append = vi.spyOn(root, "append");
    const observe = vi.fn();
    const assertMetadata = actionBinding.assertAdaActionMetadata;
    vi.spyOn(actionBinding, "assertAdaActionMetadata").mockImplementation((screen) => {
      const target = screen.querySelector<HTMLElement>(`[data-action="${id}"]`);
      // The native tool is bound before it receives its action marker.
      if (id === "map-zoomIn" && target) {
        bindings.get(target)?.dispose();
      }
      observe({
        actionPresent: target !== null,
        connected: screen.isConnected,
        panelHidden: screen.querySelector<HTMLElement>(".ada-map-panel")?.hidden,
      });
      assertMetadata(screen);
    });
    expect(() => standaloneMap(root)).toThrow("no registered action binding");
    expect(observe).toHaveBeenCalledExactlyOnceWith({
      actionPresent: true,
      connected: false,
      panelHidden: true,
    });
    expect(append).not.toHaveBeenCalled();
    expect(root.children).toEqual([]);
  },
);

it("publishes the hidden Local Map field and its nine chrome nodes already bound", () => {
  const root = mountedRoot();
  const append = root.append.bind(root);
  const registered = new Set<HTMLElement>();
  const observed = vi.fn();
  const style = vi.fn(() => {
    throw Error("Map construction read connected geometry");
  });
  vi.stubGlobal("getComputedStyle", style);
  const bind = actionBinding.bindAdaAction;
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) => {
    const binding = bind(options, element);
    registered.add(element);
    return binding;
  });
  vi.spyOn(root, "append").mockImplementation((...nodes) => {
    append(...nodes);
    const screen = nodes[0]!;
    expect(screen.isConnected).toBe(true);
    const controls = screen
      .querySelectorAll("button")
      .map((node) => {
        try {
          actionBinding.assertAdaActionMetadata(node as unknown as HTMLElement);
          return node.dataset.action!;
        } catch {
          return `${node.dataset.action} (unbound)`;
        }
      })
      .sort();
    observed({
      controls,
      field: registered.has(screen as unknown as HTMLElement),
      hidden: screen.hidden,
      travelHidden: screen.querySelector(".ada-map-panel")!.hidden,
    });
  });
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  const { map } = standaloneMap(root);
  try {
    expect(observed).toHaveBeenCalledExactlyOnceWith({
      controls: [
        "map-close",
        "map-close-x",
        "map-galaxies",
        "map-quest",
        "map-quests",
        "map-recentre",
        "map-travel",
        "map-zoomIn",
        "map-zoomOut",
      ],
      field: true,
      hidden: true,
      travelHidden: true,
    });
    expect(audit.mock.calls).toEqual([[map.element]]);
    expect(style).not.toHaveBeenCalled();
  } finally {
    map.dispose();
  }
});

it("rejects a missing Map chrome binding before publication and releases owned bindings", () => {
  const root = mountedRoot();
  const append = vi.spyOn(root, "append");
  const buttons: HTMLElement[] = [];
  const disposals: (() => void)[] = [];
  const bind = actionBinding.bindAdaAction;
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) => {
    if (isMapTravelBinding(options, element)) {
      return { activate: () => false, dispose() {}, update() {} };
    }
    const binding = bind(options, element);
    disposals.push(vi.spyOn(binding, "dispose"));
    if (element.tagName === "BUTTON") {
      buttons.push(element);
    }
    return binding;
  });
  expect(() => standaloneMap(root)).toThrow("no registered action binding");
  expect(append).not.toHaveBeenCalled();
  expect(disposals).toHaveLength(9);
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledOnce();
  }
  expect(buttons).toHaveLength(8);
  for (const element of buttons) {
    expect(() => actionBinding.assertAdaActionMetadata(element)).toThrow(
      "no registered action binding",
    );
  }
});

it("rolls back Local Map attachment when its connected action root audit fails", () => {
  const root = new FakeElement();
  PAGE.body!.append(root);
  const append = root.append.bind(root);
  let close: FakeElement | null = null;
  vi.spyOn(root, "append").mockImplementation((...nodes) => {
    append(...nodes);
    close = nodes[0]!.querySelector('[data-action="map-close"]');
  });
  expect(() => standaloneMap(root)).toThrow("no live action root");
  expect(root.children).toEqual([]);
  expect(close).not.toBeNull();
  expect(() => actionBinding.assertAdaActionMetadata(close as unknown as HTMLElement)).toThrow(
    "no registered action binding",
  );
});

it("audits a detached Map when it first opens in an owning root", () => {
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  const { map, root } = standaloneMap(new FakeElement());
  try {
    expect(audit).not.toHaveBeenCalled();
    expect(() => map.open()).toThrow("no live action root");
    expect(map.isOpen()).toBe(false);
    mountedRoot().append(root);
    map.open();
    map.close();
    map.open();
    expect(audit.mock.calls).toEqual([[map.element], [map.element]]);
  } finally {
    map.dispose();
  }
});

it.each(["open", "update"] as const)(
  "rejects an unbound Map chip before attaching its batch during %s",
  (phase) => {
    mapMeasurement();
    const { map, root } = standaloneMap();
    if (phase === "update") {
      map.setState(mapState([STATION]));
      map.open();
      map.locate(STATION.id);
    }
    const layer = root.querySelector(".ada-map-places")!;
    const previous = [...layer.children];
    const insert = vi.spyOn(layer, "insertBefore");
    const bind = actionBinding.bindAdaAction;
    const staged: HTMLElement[] = [];
    const disposers: (() => void)[] = [];
    const bindings = vi
      .spyOn(actionBinding, "bindAdaAction")
      .mockImplementation((options, element) => {
        staged.push(element);
        const binding =
          staged.length === 1
            ? bind(options, element)
            : {
                activate: () => false,
                dispose() {},
                update() {},
              };
        const dispose = vi.fn(binding.dispose);
        disposers.push(dispose);
        return { ...binding, dispose };
      });
    const next = mapState([
      { ...STATION, id: "station:0,1" },
      { ...STATION, id: "station:0,2" },
    ]);
    const apply = () => {
      map.setState(next);
      if (phase === "open") {
        map.open();
      }
    };
    try {
      expect(apply).toThrow("no registered action binding");
      expect(staged).toHaveLength(2);
      expect(insert).not.toHaveBeenCalled();
      expect(staged.every((chip) => !chip.isConnected)).toBe(true);
      expect(layer.children).toEqual(previous);
      expect(map.isOpen()).toBe(phase === "update");
      if (phase === "update") {
        expect(previous[0]?.getAttribute("aria-pressed")).toBe("true");
      }
      for (const dispose of disposers) {
        expect(dispose).toHaveBeenCalledOnce();
      }
      bindings.mockRestore();
      apply();
      expect(layer.children.map((chip) => chip.dataset.place).sort()).toEqual([
        "station:0,1",
        "station:0,2",
      ]);
    } finally {
      map.dispose();
    }
    for (const dispose of disposers) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  },
);

it("audits Map chrome once and each newly attached chip without consulting action policy", () => {
  mapMeasurement();
  const bind = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw new Error("construction evaluated runtime action policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
    bind(
      { ...options, click: { ...options.click, availability: policy }, current: policy },
      element,
    ),
  );
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  const { map } = standaloneMap();
  try {
    map.setState(mapState([STATION]));
    map.open();
    const chip = map.element.querySelector(".ada-map-place");
    expect(chip).not.toBeNull();
    expect(audit.mock.calls).toEqual([[map.element], [chip]]);
    map.setState(mapState([{ ...STATION, y: 900 }]));
    map.close();
    map.open();
    expect(audit).toHaveBeenCalledTimes(2);
    map.setState(mapState([]));
    expect(chip?.isConnected).toBe(false);
    map.setState(mapState([STATION]));
    const added = map.element.querySelector(".ada-map-place");
    expect(added).not.toBeNull();
    expect(added).not.toBe(chip);
    expect(audit.mock.calls).toEqual([[map.element], [chip], [added]]);
    expect(policy).not.toHaveBeenCalled();
  } finally {
    map.dispose();
  }
});

describe("Paused card", () => {
  it("Back returns the local map to Pause and keeps held input blocked until Resume", () => {
    const original = mapUI.createMapScreen;
    let mapOpen = false;
    const spy = vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => {
      const map = original(...args);
      return {
        ...map,
        close: () => {
          map.element.hidden = true;
          mapOpen = false;
        },
        isOpen: () => mapOpen,
        open: () => {
          map.element.hidden = false;
          mapOpen = true;
        },
      };
    });
    try {
      const controls = new ControlState();
      controls.keyDown("KeyD");
      expect(controls.sample().move.x).toBe(1);
      const { body, options, pause, root } = cards();
      options.onOpenChange.mockImplementation((open: boolean) => {
        if (open) {
          controls.openModal();
        } else {
          controls.closeModal();
        }
      });
      pause.setState(state());
      pause.open();
      button(body.children[0]!, "pause-map").click();
      expect(pause.mapOpen()).toBe(true);
      expect(controls.accepts()).toBe(false);
      const footer = root.querySelectorAll().find((entry) => entry.dataset.action === "map-close")!;
      expect(footer.textContent).toBe("Back");
      const close = root
        .querySelectorAll()
        .find((entry) => entry.dataset.action === "map-close-x")!;
      close.click();
      expect(pause.mapOpen()).toBe(false);
      expect(pause.isOpen()).toBe(true);
      expect(controls.accepts()).toBe(false);
      expect(options.onOpenChange.mock.calls).toEqual([[true]]);
      expect(focused()).toBe(button(body.children[0]!, "pause-map"));
      button(body.children[0]!, "pause-resume").click();
      expect(pause.isOpen()).toBe(false);
      expect(controls.accepts()).toBe(true);
      expect(controls.sample()).toMatchObject({ move: { x: 0, y: 0 }, use: false });
      expect(options.onOpenChange).toHaveBeenLastCalledWith(false);
      pause.dispose();
    } finally {
      spy.mockRestore();
    }
  });

  it("registers and releases the map's font completion listener", () => {
    const fonts = document.fonts;
    const add = vi.spyOn(fonts, "addEventListener");
    const remove = vi.spyOn(fonts, "removeEventListener");
    const { pause } = cards();
    expect(add).toHaveBeenCalledWith("loadingdone", expect.any(Function));
    expect(() => fonts.dispatchEvent(new Event("loadingdone"))).not.toThrow();
    pause.dispose();
    expect(remove).toHaveBeenCalledWith("loadingdone", add.mock.calls[0]![1]);
  });

  it("builds the alphabetical and fixed columns in native focus order with Resume primary", () => {
    const { body, pause } = cards();
    pause.setState(state({ job: "Chart the Sleepy Tug" }));
    expect(body.children).toHaveLength(1);
    const actions = body.children[0]!;
    expect(actions.className).toContain("ada-stack");
    expect(actions.children[0]!.className).toBe("ui-layout-columns");
    expect(actions.children).toHaveLength(1);
    const [left, right] = actions.children[0]!.children;
    expect(left?.className).toBe("ui-layout-stack");
    expect(right?.className).toBe("ui-layout-stack");
    expect(shownActions(left!)).toEqual([
      "pause-cheats",
      "pause-map",
      "pause-quests",
      "pause-ship",
    ]);
    expect(shownActions(right!)).toEqual([
      "pause-achievements",
      "pause-settings",
      "pause-backToTitle",
      "pause-resume",
    ]);
    expect(right?.children.at(-1)?.className).toContain("ada-primary");
    expect(buttonsOf(actions).map((node) => node.textContent)).toEqual([
      "Cheats",
      "Map",
      "Quests",
      "Ship",
      "Achievements",
      "Settings",
      "Back to title",
      "Resume",
    ]);
  });

  it("keeps every action, Back to title included, available in danger", () => {
    const { body, options, pause } = cards();
    pause.setState(state({ inDanger: true }));
    pause.open();
    const actions = buttonsOf(body.children[0]!);
    expect(actions.map((node) => node.getAttribute("aria-disabled"))).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    button(body.children[0]!, "pause-backToTitle").click();
    expect(options.onBackToTitle).toHaveBeenCalledOnce();
  });

  it("builds the full-screen map hidden beside the Paused card", () => {
    const { root } = cards();
    const screen = root.children.find((node) => node.className === "ada-map-screen");
    expect(screen?.dataset.dialog).toBe("map");
    expect(screen?.hidden).toBe(true);
  });
});

describe("Ship card", () => {
  it("opens from Ship in the Paused card's place, titled Ship, its rows built and focus on primary Back", () => {
    const { body, modal, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    expect(ship.hidden).toBe(true);
    button(body.children[0]!, "pause-ship").click();
    expect(pause.shipOpen()).toBe(true);
    expect(ship.hidden).toBe(false);
    expect(modal.children[0]!.hidden).toBe(true);
    expect(ship.getAttribute("aria-label")).toBe("Ship");
    expect(ship.dataset.cardSize).toBe("large");
    const close = ship.children[1]!;
    expect(close.dataset.action).toBe("close-ship");
    expect(focused()?.dataset.action).toBe("back-ship");
    const shown = texts(ship.children[0]!);
    expect(shown).toEqual(
      expect.arrayContaining(["Ship", "Cargo", "Equipment", "1,234", "Shield [2]", "Weapons"]),
    );
  });

  it("shows the installed Shield tier, live HP and warning, then restores the Ship row", () => {
    const { body, pause, root, ship } = cards();
    pause.setState(
      state({
        ship: { ...SHIP, shieldHealth: { capacity: 15, rechargeDelay: 3, shield: 8.2 } },
      }),
    );
    pause.open();
    button(body.children[0]!, "pause-ship").click();
    const shield = buttonsOf(ship).find((node) => node.dataset.item === "equipment:shield")!;
    shield.click();

    const dismiss = button(root, "dismiss-resource");
    expect(dismiss.textContent).toBe("Back");
    const shown = texts(root);
    expect(shown).toContain("8 / 15 HP");
    expect(shown.some((text) => text.includes("Absorbs damage and recharges"))).toBe(true);
    expect(shown.some((text) => text.includes("you lose all carried ore"))).toBe(true);
    expect(focused()).toBe(dismiss);
    dismiss.click();
    expect(focused()).toBe(shield);
  });

  it("returns to the Paused card on its Ship button from the X and from back", () => {
    const { body, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    const shipButton = button(body.children[0]!, "pause-ship");
    shipButton.click();
    ship.children[1]!.click();
    expect(pause.shipOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    expect(ship.hidden).toBe(true);
    expect(focused()).toBe(shipButton);
    shipButton.click();
    focusLog.length = 0;
    pause.closeShip();
    expect(pause.shipOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    expect(focused()).toBe(shipButton);
  });

  it("moves focus with no focus ring after a touch and the ring after a key", () => {
    const { body, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    const shipButton = button(body.children[0]!, "pause-ship");
    PAGE.dispatchEvent(new Event("touchstart"));
    shipButton.click();
    expect(focused()).toBe(
      ship.querySelectorAll().find((button) => button.dataset.action === "back-ship"),
    );
    expect(lastFocusOptions).toEqual({ focusVisible: false, preventScroll: true });
    PAGE.dispatchEvent(new Event("keydown"));
    pause.closeShip();
    expect(focused()).toBe(shipButton);
    expect(lastFocusOptions).toBeUndefined();
  });

  it("rebuilds its rows when the ship changes while it shows", () => {
    const { body, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    button(body.children[0]!, "pause-ship").click();
    pause.setState(state({ ship: { ...SHIP, stardust: 5 } }));
    expect(texts(ship.children[0]!)).toContain("5");
    expect(texts(ship.children[0]!)).not.toContain("1,234");
  });

  it("leaves focus alone on a galaxy map close while the local map is closed", () => {
    const { pause } = cards();
    pause.setState(state());
    pause.open();
    focusLog.length = 0;
    pause.focusGalaxies();
    expect(focusLog).toEqual([]);
  });
});

it("opens the existing Quests route directly from carried cargo and preserves pause until closed", () => {
  const original = mapUI.createMapScreen;
  let mapOpen = false;
  const spy = vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => ({
    ...original(...args),
    close: () => {
      mapOpen = false;
    },
    isOpen: () => mapOpen,
    open: () => {
      mapOpen = true;
    },
  }));
  const { options, pause, root } = cards();
  pause.setState(state({ carrying: true }));
  pause.openQuests();
  expect(
    root.querySelectorAll().find((node) => node.dataset.action === "quest-close")!.textContent,
  ).toBe("Back");
  expect(pause.isOpen()).toBe(true);
  expect(pause.mapOpen()).toBe(true);
  expect(options.onOpenChange).toHaveBeenLastCalledWith(true);
  pause.closeMap();
  expect(pause.mapOpen()).toBe(true);
  expect(pause.isOpen()).toBe(true);
  pause.close();
  expect(pause.isOpen()).toBe(false);
  expect(options.onOpenChange).toHaveBeenLastCalledWith(false);
  pause.dispose();
  spy.mockRestore();
});

it("opens Quests from the pause menu and keeps pause through both back layers until Resume", () => {
  const original = mapUI.createMapScreen;
  let mapOpen = false;
  const spy = vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => ({
    ...original(...args),
    close: () => {
      mapOpen = false;
    },
    isOpen: () => mapOpen,
    open: () => {
      mapOpen = true;
    },
  }));
  try {
    const { body, options, pause, root } = cards();
    pause.setState(state({ map: { ...MAP, quests: [] } }));
    pause.open();
    button(body.children[0]!, "pause-quests").click();
    expect(
      root.querySelectorAll().find((node) => node.dataset.action === "quest-close")!.textContent,
    ).toBe("Back");
    expect(
      root.children.find((child) => child.className.includes("ada-quests-screen"))?.hidden,
    ).toBe(false);
    expect(pause.mapOpen()).toBe(false);
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    expect(options.onTravel).not.toHaveBeenCalled();
    expect(options.onBackToTitle).not.toHaveBeenCalled();
    pause.closeMap();
    expect(pause.mapOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    pause.closeMap();
    expect(pause.mapOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    expect(focused()?.dataset.action).toBe("pause-quests");
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    button(body.children[0]!, "pause-resume").click();
    expect(pause.isOpen()).toBe(false);
    expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
    pause.dispose();
  } finally {
    spy.mockRestore();
  }
});

describe("published modal layer routing", () => {
  it("closes Ship before Paused on separate Escape presses and releases its inert marks", () => {
    const { body, modal, pause } = cards();
    pause.setState(state());
    pause.open();
    const shipButton = button(body.children[0]!, "pause-ship");
    shipButton.click();
    expect(pause.shipOpen()).toBe(true);
    expect(modal.children[0]!.hasAttribute("inert")).toBe(true);
    const escape = () => {
      expect(dispatchEscape().defaultPrevented).toBe(true);
    };
    escape();
    expect(pause.shipOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    expect(focused()).toBe(shipButton);
    escape();
    expect(pause.isOpen()).toBe(false);
    expect(modal.children.every((child) => !child.hasAttribute("inert"))).toBe(true);
    pause.dispose();
  });
});

it("opens a held quest directly, returns All quests to its list, and resumes only on Close", () => {
  const { options, pause, root } = cards();
  const entry = {
    galaxy: 1 as const,
    id: "story:1:1",
    line: {
      description: "Approved full description",
      kind: "story" as const,
      nextStep: "Deliver Food",
      progress: "1 / 1",
      target: null,
      text: "Food objective",
    },
    locations: [],
  };
  pause.setState(state({ galaxy: 1, questEntries: [entry] }));
  pause.openQuest(entry.id, "flight");
  const quests = root.children.find((child) => child.className.includes("ada-quests-screen"))!;
  expect(quests.hidden).toBe(false);
  expect(pause.isOpen()).toBe(true);
  expect(pause.mapOpen()).toBe(false);
  expect(texts(quests)).toContain("Approved full description");
  const find = (action: string) =>
    quests.querySelectorAll().find((button) => button.dataset.action === action)!;
  expect(find("quest-other").textContent).toBe("All quests");
  expect(find("quest-other").matches(".ui-standard-button")).toBe(true);
  expect(find("quest-close").textContent).toBe("Close");
  find("quest-other").click();
  const row = quests.querySelectorAll().find((button) => button.dataset.questId === entry.id)!;
  row.click();
  expect(find("quest-back")).toBeDefined();
  expect(find("quest-other")).toBeUndefined();
  find("quest-back").click();
  expect(quests.querySelectorAll().some((button) => button.dataset.questId === entry.id)).toBe(
    true,
  );
  expect(focused()?.dataset.questId).toBe(entry.id);
  find("quest-close").click();
  expect(pause.isOpen()).toBe(false);
  expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
  pause.dispose();
});

it.each(["close-quests", "quest-close", "Escape", "back"])(
  "returns direct HUD detail to flight through %s",
  (method) => {
    const { pause, root } = cards();
    pause.setState(
      state({
        questEntries: [
          {
            galaxy: 1,
            id: "held",
            line: { kind: "job", reward: "17 Stardust", target: null, text: "Held job" },
            locations: [],
          },
        ],
      }),
    );
    pause.openQuest("held", "flight");
    if (method === "Escape") {
      dispatchEscape();
    } else if (method === "back") {
      pause.close();
    } else {
      root.children
        .find((child) => child.className.includes("ada-quests-screen"))!
        .querySelectorAll()
        .find((button) => button.dataset.action === method)!
        .click();
    }
    expect(pause.isOpen()).toBe(false);
    const quests = root.children.find((child) => child.className.includes("ada-quests-screen"))!;
    expect(quests.hidden).toBe(true);
    pause.dispose();
  },
);

it.each(["close-quests", "quest-back", "Escape", "back"])(
  "returns list detail to the list through %s without resuming",
  (method) => {
    const { pause, root } = cards();
    pause.setState(
      state({
        questEntries: [
          {
            galaxy: 1,
            id: "held",
            line: { kind: "job", target: null, text: "Held job" },
            locations: [],
          },
        ],
      }),
    );
    pause.openQuest("held", "flight");
    root
      .querySelectorAll()
      .find((button) => button.dataset.action === "quest-other")!
      .click();
    root
      .querySelectorAll()
      .find((button) => button.dataset.questId === "held")!
      .click();
    if (method === "Escape") {
      dispatchEscape();
    } else if (method === "back") {
      pause.closeMap();
    } else {
      root.children
        .find((child) => child.className.includes("ada-quests-screen"))!
        .querySelectorAll()
        .find((button) => button.dataset.action === method)!
        .click();
    }
    expect(pause.isOpen()).toBe(true);
    expect(root.querySelectorAll().some((button) => button.dataset.questId === "held")).toBe(true);
    pause.dispose();
  },
);

it("hides Map without canonical permission and shows it once permitted", () => {
  const { body, options, pause } = cards();
  const actions = body.children[0]!;
  pause.setState(state({ canMap: false }));
  const [left, right] = actions.children[0]!.children;
  expect(shownActions(left!)).toEqual(["pause-cheats", "pause-quests", "pause-ship"]);
  expect(shownActions(right!)).toEqual([
    "pause-achievements",
    "pause-settings",
    "pause-backToTitle",
    "pause-resume",
  ]);
  button(actions, "pause-map").click();
  expect(pause.mapOpen()).toBe(false);
  expect(options.onGalaxies).not.toHaveBeenCalled();
  const { canMap: permission, ...withoutPermission } = state();
  expect(permission).toBe(true);
  pause.setState(withoutPermission);
  expect(shownActions(actions)).not.toContain("pause-map");
  pause.setState(state({ canMap: true }));
  expect(shownActions(left!).slice(0, 2)).toEqual(["pause-cheats", "pause-map"]);
  expect(shownActions(right!)).toEqual([
    "pause-achievements",
    "pause-settings",
    "pause-backToTitle",
    "pause-resume",
  ]);
  expect(button(actions, "pause-map").getAttribute("aria-disabled")).toBe(null);
  pause.dispose();
});

it.each(["back-ship", "close-ship", "Escape", "back"])(
  "returns Ship to Paused through %s without resuming gameplay",
  (method) => {
    const { body, options, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    const opener = button(body.children[0]!, "pause-ship");
    opener.click();
    const footer = ship.querySelectorAll().find((button) => button.dataset.action === "back-ship")!;
    expect(footer.textContent).toBe("Back");
    expect(footer.className).toContain("ada-primary");
    expect(footer.className).toContain("ui-standard-button");
    expect(footer.tagName).toBe("BUTTON");
    expect(footer.listeners.get("click")).toHaveLength(1);
    if (method === "Escape") {
      dispatchEscape();
    } else if (method === "back") {
      pause.closeShip();
    } else {
      ship
        .querySelectorAll()
        .find((button) => button.dataset.action === method)!
        .click();
    }
    expect(pause.shipOpen()).toBe(false);
    expect(pause.isOpen()).toBe(true);
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    expect(focused()).toBe(opener);
    pause.dispose();
    expect(footer.listeners.get("click")).toHaveLength(0);
  },
);

it.each([
  "resource:ore",
  "equipment:engine",
  "equipment:shield",
  "equipment:tractor",
  "equipment:paint",
  "cargo:holodisks",
  "cargo:carrying:spares",
  "cargo:towing:tug",
  "weapon:laser",
])("returns %s details to the same Ship and item context", (item) => {
  const { body, modal, options, pause, root, ship } = cards();
  const populated = {
    ...SHIP,
    carrying: [{ id: "spares", name: "Spare parts" }],
    towing: { id: "tug", name: "Sleepy Tug" },
  };
  pause.setState(state({ ship: populated }));
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  const origin = ship.querySelectorAll().find((node) => node.dataset.item === item)!;
  expect(origin).toBeDefined();
  const snapshot = structuredClone(populated);
  origin.click();
  expect(modal.hidden).toBe(true);
  expect(pause.shipOpen()).toBe(true);
  const detail = root.children.find(
    (node) => node !== modal && node.className === "ada-modal" && !node.hidden,
  )!;
  const kind = item.startsWith("weapon:") ? "weapon-detail" : "resource";
  if (item === "cargo:holodisks") {
    const header = detail.querySelector(".ada-detail-header")!;
    const quantity = detail.querySelector(".ada-detail-quantity")!;
    const [description, amount] = quantity.parentElement!.children;
    expect(header.children.at(-1)?.textContent).toBe("Holodisks");
    expect(description?.textContent).toBe(CONTENT.labels.holodiskAbout);
    expect(amount).toBe(quantity);
    expect(quantity.hidden).toBe(false);
    expect(quantity.children.at(-1)?.textContent).toBe("2 of 6");
  }
  if (item.startsWith("cargo:") && item !== "cargo:holodisks") {
    const header = detail.querySelector(".ada-detail-header")!;
    const quantity = detail.querySelector(".ada-detail-quantity")!;
    expect(header.children.at(-1)?.textContent).toBe(
      item === "cargo:carrying:spares" ? "Spare parts" : "Sleepy Tug",
    );
    expect(quantity.hidden).toBe(true);
  }
  const dismiss = button(detail, `dismiss-${kind}`);
  expect(dismiss.textContent).toBe("Back");
  expect(detail.querySelector(".ada-actions")?.dataset.footerAction).toBe("back");
  dismiss.click();
  expect(pause.shipOpen()).toBe(true);
  expect(modal.hidden).toBe(false);
  expect(focused()).toBe(origin);
  expect(populated).toEqual(snapshot);
  expect(options.onBackToTitle).not.toHaveBeenCalled();
  expect(options.onGalaxies).not.toHaveBeenCalled();
  origin.click();
  button(detail, `close-${kind}`).click();
  expect(detail.hidden).toBe(true);
  expect(modal.hidden).toBe(false);
  expect(focused()).toBe(origin);
  expect(options.onOpenChange.mock.calls).toEqual([[true]]);
  pause.dispose();
});

it.each(["dismiss-ship-paint", "close-ship-paint"])(
  "returns Paint to its Ship row through %s with a Back footer",
  (action) => {
    const select = vi.fn();
    const { body, modal, options, pause, root, ship } = cards(false, undefined, {
      applyLabel: "Apply",
      current: () => "classic",
      inUseLabel: "In use",
      schemes: () => [{ id: "classic", name: "Classic" }],
      select,
      title: "Ship paint",
    });
    pause.setState(state());
    pause.open();
    button(body.children[0]!, "pause-ship").click();
    const origin = ship.querySelector('[data-item="equipment:paint"]')!;
    origin.click();
    expect(modal.hidden).toBe(true);
    const detail = root.children.find(
      (node) => node !== modal && node.className === "ada-modal" && !node.hidden,
    )!;
    const dismiss = button(detail, "dismiss-ship-paint");
    expect(dismiss.textContent).toBe("Back");
    expect(detail.querySelector(".ada-actions")?.dataset.footerAction).toBe("back");
    button(detail, action).click();
    expect(detail.hidden).toBe(true);
    expect(modal.hidden).toBe(false);
    expect(pause.shipOpen()).toBe(true);
    expect(focused()).toBe(origin);
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    expect(select).not.toHaveBeenCalled();
    pause.dispose();
  },
);

it("returns held cargo quest details directly to the same Ship", () => {
  const { body, modal, pause, root, ship } = cards();
  pause.setState(
    state({
      questEntries: [
        {
          galaxy: 1,
          id: "held",
          line: { kind: "job", reward: "17 Stardust", target: null, text: "Held job" },
          locations: [],
        },
      ],
      ship: { ...SHIP, aboard: { kind: "carrying", name: "Supplies" }, aboardQuestId: "held" },
    }),
  );
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  const origin = ship.querySelectorAll().find((node) => node.dataset.item === "cargo:aboard")!;
  origin.click();
  expect(modal.hidden).toBe(true);
  const detail = root.children.find((node) => node.className.includes("ada-quests-screen"))!;
  expect(
    detail.querySelectorAll().find((node) => node.dataset.action === "quest-close")!.textContent,
  ).toBe("Back");
  expect(detail.querySelectorAll().some((node) => node.dataset.action === "quest-other")).toBe(
    false,
  );
  pause.closeShip();
  expect(modal.hidden).toBe(false);
  expect(pause.shipOpen()).toBe(true);
  expect(focused()).toBe(origin);
});

it("does not route cargo to a quest absent from current membership and retains Ship focus", () => {
  const { body, modal, pause, root, ship } = cards();
  pause.setState(
    state({
      questEntries: [],
      ship: { ...SHIP, aboard: { kind: "carrying", name: "Supplies" }, aboardQuestId: "expired" },
    }),
  );
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  const origin = ship.querySelectorAll().find((node) => node.dataset.item === "cargo:aboard")!;
  origin.click();
  expect(modal.hidden).toBe(true);
  expect(
    root.children.some((node) => node.className.includes("ada-quests-screen") && !node.hidden),
  ).toBe(false);
  expect(
    root.children.some(
      (node) =>
        node.className === "ada-modal" &&
        !node.hidden &&
        node.querySelectorAll().some((button) => button.dataset.action === "close-resource"),
    ),
  ).toBe(true);
  pause.closeShip();
  expect(modal.hidden).toBe(false);
  expect(pause.shipOpen()).toBe(true);
  expect(focused()).toBe(origin);
  pause.dispose();
});

it.each([
  ["cargo:carrying:story-item:1:map", "story:1:held"],
  ["cargo:carrying:job:1:delivery", "job:1:delivery"],
  ["cargo:towing:job:1:rescue", "job:1:rescue"],
])("routes %s to its own quest and returns to the same Ship row", (item, questId) => {
  const { body, modal, options, pause, root, ship } = cards();
  pause.setState(
    state({
      questEntries: ["story:1:held", "job:1:delivery", "job:1:rescue"].map((id) => ({
        galaxy: 1,
        id,
        line: { kind: "job" as const, reward: "17 Stardust", target: null, text: `Quest ${id}` },
        locations: [],
      })),
      ship: {
        ...SHIP,
        aboardQuestId: "wrong-legacy-id",
        carrying: [
          { id: "story-item:1:map", name: "Supplies", questId: "story:1:held" },
          { id: "job:1:delivery", name: "Supplies", questId: "job:1:delivery" },
        ],
        towing: { id: "job:1:rescue", name: "Sleepy Tug", questId: "job:1:rescue" },
      },
    }),
  );
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  const origin = ship.querySelectorAll().find((node) => node.dataset.item === item)!;
  expect(origin).toBeDefined();
  origin.click();
  const detail = root.children.find((node) => node.className.includes("ada-quests-screen"))!;
  expect(modal.hidden).toBe(true);
  expect(detail.hidden).toBe(false);
  expect(detail.textContent).toContain(`Quest ${questId}`);
  expect(
    detail.querySelectorAll().find((node) => node.dataset.action === "quest-close")!.textContent,
  ).toBe("Back");
  pause.closeShip();
  expect(modal.hidden).toBe(false);
  expect(pause.shipOpen()).toBe(true);
  expect(focused()).toBe(origin);
  expect(options.onBackToTitle).not.toHaveBeenCalled();
  pause.dispose();
});

it.each(["settings", "cheats"] as const)(
  "retains the Pause ancestor through %s until Resume",
  (child) => {
    const { body, modal, options, pause } = cards();
    pause.setState(state());
    pause.open();
    button(body.children[0]!, `pause-${child}`).click();
    expect(child === "settings" ? options.onSettings : options.onCheats).toHaveBeenCalledOnce();
    expect(modal.hidden).toBe(true);
    expect(pause.isOpen()).toBe(true);
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    pause.restorePaused(child);
    expect(focused()).toBe(button(body.children[0]!, `pause-${child}`));
    expect(modal.hidden).toBe(false);
    expect(pause.isOpen()).toBe(true);
    button(body.children[0]!, "pause-resume").click();
    expect(pause.isOpen()).toBe(false);
    expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
  },
);

it.each([1, 2])(
  "returns %i contextual quests to gameplay without a hidden Map ancestor",
  (count) => {
    const { options, pause, root } = cards();
    const entries = Array.from({ length: count }, (_, index) => ({
      galaxy: 1 as const,
      id: `story:1:${index}`,
      line: { kind: "story" as const, target: null, text: `Known objective ${index}` },
      locations: [],
    }));
    pause.setState(state({ galaxy: 1, questEntries: entries }));
    expect(pause.openContextQuests({ quests: entries, targetId: "known" })).toBe(true);
    const quests = root.children.find((node) => node.className.includes("ada-quests-screen"))!;
    const find = (action: string) =>
      quests.querySelectorAll().find((node) => node.dataset.action === action)!;
    expect(pause.mapOpen()).toBe(false);
    expect(find("quest-close").textContent).toBe("Close");
    if (count === 2) {
      quests
        .querySelectorAll()
        .find((node) => node.dataset.questId === entries[0]!.id)!
        .click();
      expect(find("quest-back").textContent).toBe("Back");
      find("quest-back").click();
      expect(find("quest-close").textContent).toBe("Close");
      expect(pause.isOpen()).toBe(true);
      expect(quests.querySelectorAll().filter((node) => node.dataset.questId)).toHaveLength(2);
    }
    find("quest-close").click();
    expect(pause.isOpen()).toBe(false);
    expect(pause.mapOpen()).toBe(false);
    expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
    pause.dispose();
  },
);

it("returns through a borrowed Locate Map to the contextual quest, then to unpaused flight", () => {
  const original = mapUI.createMapScreen;
  let mapOpen = false;
  const locate = vi.fn();
  vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => ({
    ...original(...args),
    close: () => {
      mapOpen = false;
    },
    isOpen: () => mapOpen,
    locate,
    open: () => {
      mapOpen = true;
    },
  }));
  const { options, pause, root } = cards();
  const known: MapPlace = {
    id: "growers",
    job: false,
    kind: "destination",
    label: "Growers",
    objective: true,
    symbol: "growers",
    travel: true,
    x: 0,
    y: 0,
  };
  const quest = {
    galaxy: 1 as const,
    id: "story:1:1",
    line: { kind: "story" as const, target: known.id, text: "Known objective" },
    locations: [{ id: known.id, label: known.label, symbol: known.symbol }],
  };
  pause.setState(state({ galaxy: 1, map: { ...MAP, places: [known] }, questEntries: [quest] }));
  expect(pause.openContextQuests({ quests: [quest], targetId: known.id })).toBe(true);
  const dialog = root.children.find((node) => node.className.includes("ada-quests-screen"))!;
  const endpoint = () =>
    dialog.querySelectorAll().find((node) => node.className === "ada-quest-endpoint")!;
  endpoint().click();
  expect(locate).toHaveBeenCalledExactlyOnceWith(known.id);
  expect(dialog.hidden).toBe(true);
  expect(pause.mapOpen()).toBe(true);
  pause.closeMap();
  expect(pause.mapOpen()).toBe(false);
  expect(dialog.hidden).toBe(false);
  expect(focused()).toBe(endpoint());
  dialog
    .querySelectorAll()
    .find((node) => node.dataset.action === "quest-close")!
    .click();
  expect(pause.isOpen()).toBe(false);
  expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(options.onTravel).not.toHaveBeenCalled();
  pause.dispose();
});

it("retains a real label node through native presentation moves and action queries", () => {
  const button = PAGE.createElement("button");
  button.dataset.action = "dismiss-resource";
  button.textContent = "Close";
  const label = button.firstChild!;
  expect(label.nodeType).toBe(3);
  const icon = PAGE.createElement("img");
  button.prepend(icon);
  expect(button.childNodes).toEqual([icon, label]);
  expect(button.children).toEqual([icon]);
  const presentation = PAGE.createElement("span");
  presentation.append(label);
  button.append(presentation);
  label.nodeValue = "Back";
  expect(button.textContent).toBe("Back");
  expect(button.contains(label)).toBe(true);
  const footer = PAGE.createElement("div");
  footer.append(button);
  expect(footer.querySelector('[data-action="dismiss-resource"]')).toBe(button);
  expect(presentation.firstChild).toBe(label);
});

it("opens the shared Achievements child and restores the invoking Pause action", () => {
  const { body, modal, options, pause } = cards();
  pause.setState(state());
  pause.open();
  const achievement = button(body.children[0]!, "pause-achievements");
  achievement.click();
  expect(options.onAchievements).toHaveBeenCalledOnce();
  expect(options.onBackToTitle).not.toHaveBeenCalled();
  expect(modal.hidden).toBe(true);
  expect(pause.isOpen()).toBe(true);
  pause.restorePaused("achievements");
  expect(modal.hidden).toBe(false);
  expect(focused()).toBe(achievement);
  expect(options.onOpenChange.mock.calls).toEqual([[true]]);
  pause.dispose();
});

it("retains native Pause button identities across Map permission updates", () => {
  const { body, options, pause } = cards();
  pause.setState(state());
  pause.open();
  const actions = body.children[0]!;
  const initial = [...buttonsOf(actions)];
  pause.setState(state({ canMap: false }));
  expect(buttonsOf(actions)).toEqual(initial);
  expect(button(actions, "pause-map").hidden).toBe(true);
  pause.setState(state());
  expect(buttonsOf(actions)).toEqual(initial);
  expect(button(actions, "pause-map").hidden).toBe(false);
  button(actions, "pause-backToTitle").click();
  expect(options.onBackToTitle).toHaveBeenCalledOnce();
  pause.dispose();
  for (const control of initial) {
    expect(control.listeners.get("click")).toEqual([]);
  }
});

it("audits completed Ship rows after parent attachment and only when sections change", () => {
  const { body, pause, root } = cards();
  const original = actionBinding.assertAdaActionBindings;
  const audit = vi.fn();
  vi.spyOn(actionBinding, "assertAdaActionBindings").mockImplementation((scope) => {
    if ((scope as unknown as FakeElement).matches(".ada-ship-sections")) {
      audit(scope);
    }
    expect(scope.isConnected).toBe(true);
    expect(root.contains(scope)).toBe(true);
    expect(scope.classList).toBeDefined();
    original(scope);
  });
  pause.setState(state());
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  expect(audit).toHaveBeenCalledTimes(1);
  pause.setState(state());
  expect(audit).toHaveBeenCalledTimes(1);
  pause.setState(state({ ship: { ...SHIP, stardust: 7 } }));
  expect(audit).toHaveBeenCalledTimes(2);
  expect(focused()?.dataset.action).toBe("back-ship");
  pause.dispose();
});

it("rejects attached Ship rows outside an owning root before parent focus", () => {
  const { body, pause } = cards();
  pause.setState(state());
  pause.open();
  const shipButton = button(body.children[0]!, "pause-ship");
  const focusBefore = focused();
  const outside = new FakeElement();
  PAGE.body!.append(outside);
  // Move only the next completed Ship sections into a connected but unregistered tree.
  const original = FakeElement.prototype.replaceChildren;
  vi.spyOn(FakeElement.prototype, "replaceChildren").mockImplementation(function (
    this: FakeElement,
    ...nodes
  ) {
    original.apply(this, nodes);
    if (nodes.length === 1 && nodes[0]?.matches(".ada-ship-sections")) {
      outside.append(nodes[0]);
    }
  });
  expect(() => shipButton.click()).toThrow("no live action root");
  expect(focused()).toBe(focusBefore);
  expect(outside.isConnected).toBe(true);
  pause.dispose();
});

it("publishes the hidden Pause and Ship controls already bound before Map and Quests", () => {
  const publication: { actions: string[]; hidden: boolean }[] = [];
  const { pause, root } = cards(false, (root) => {
    const append = root.append.bind(root);
    vi.spyOn(root, "append").mockImplementation((...nodes) => {
      append(...nodes);
      const modal = nodes[0]!;
      if (modal !== root.children[0]) {
        return;
      }
      expect(modal.isConnected).toBe(true);
      const actions = modal
        .querySelectorAll("button")
        .map((node) => {
          try {
            actionBinding.assertAdaActionMetadata(node as unknown as HTMLElement);
            return node.dataset.action!;
          } catch {
            return `${node.dataset.action} (unbound)`;
          }
        })
        .sort();
      publication.push({ actions, hidden: modal.hidden });
    });
  });
  expect(publication).toEqual([
    {
      actions: [
        "back-ship",
        "close-pause",
        "close-ship",
        "pause-achievements",
        "pause-backToTitle",
        "pause-cheats",
        "pause-map",
        "pause-quests",
        "pause-resume",
        "pause-settings",
        "pause-ship",
      ],
      hidden: true,
    },
  ]);
  expect(root.children[1]!.dataset.dialog).toBe("map");
  expect(root.children[2]!.querySelector('[data-dialog="quests"]')).not.toBeNull();
  pause.dispose();
});

it.each(["pause-resume", "close-ship"])(
  "rejects a missing static Pause binding %s before publication and releases owned resources",
  (id) => {
    const original = actionBinding.bindAdaAction;
    const bound: HTMLElement[] = [];
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) => {
      const resumeFactory =
        id === "pause-resume" &&
        options.nativeClickOwner === "factory" &&
        element.textContent === LABELS.resume;
      if (element.dataset.action === id || resumeFactory) {
        return { activate: () => false, dispose() {}, update() {} };
      }
      bound.push(element);
      return original(options, element);
    });
    const published = vi.fn();
    expect(() =>
      cards(false, (root) => {
        const append = root.append.bind(root);
        vi.spyOn(root, "append").mockImplementation((...nodes) => {
          published();
          append(...nodes);
        });
      }),
    ).toThrow("no registered action binding");
    expect(published).not.toHaveBeenCalled();
    expect(bound).toHaveLength(10);
    for (const element of bound) {
      expect(() => actionBinding.assertAdaActionMetadata(element)).toThrow(
        "no registered action binding",
      );
    }
    expect(window.addEventListener).toHaveBeenCalledTimes(4);
    expect(vi.mocked(window.removeEventListener).mock.calls).toEqual(
      vi.mocked(window.addEventListener).mock.calls,
    );
  },
);

it("audits completed Pause frames at construction without reading runtime policy", () => {
  const original = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw Error("construction evaluated runtime policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
    original(
      { ...options, click: { ...options.click, availability: policy }, current: policy },
      element,
    ),
  );
  const { pause, root } = cards(true);
  expect(root.isConnected).toBe(false);
  expect(policy).not.toHaveBeenCalled();
  pause.dispose();
});

it("audits Pause entry once while layout updates do not audit completed frames", () => {
  const { pause, root } = cards();
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  pause.setState(state());
  pause.open();
  expect(audit).toHaveBeenCalledTimes(1);
  expect(audit.mock.calls[0]![0]).not.toBe(root);
  pause.setState(state({ inDanger: true }));
  expect(audit).toHaveBeenCalledTimes(1);
  pause.dispose();
});
