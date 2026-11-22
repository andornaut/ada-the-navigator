import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ControlState } from "../input/state.ts";
import type { LocalMap, MapPlace } from "../model/map.ts";
import * as actionBinding from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import * as mapUI from "./mapScreen.ts";
import { mapScreenLabels, type MapScreenState } from "./mapScreen.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "./pauseCard.ts";
import type { ShipView } from "./shipCard.ts";

// Every focus() call, latest last, with the options of the latest.
const focusLog: FakeElement[] = [];
const focused = () => focusLog.at(-1);
let lastFocusOptions: unknown;

// The cards' document, where the kit's focusTarget tracks the last input. With no window it
// tracks touchstart for presses.
function createDocument() {
  return Object.assign(new EventTarget(), {
    activeElement: null as FakeElement | null,
    body: null as FakeElement | null,
    createElement: (tagName: string): FakeElement =>
      Object.assign(new FakeElement(), { tagName: tagName.toUpperCase() }),
    createElementNS: (): FakeElement => new FakeElement(),
    createTextNode: (text: string): FakeElement =>
      Object.assign(new FakeElement(), { nodeType: 3, nodeValue: text }),
    defaultView: null,
    fonts: Object.assign(new EventTarget(), { status: "loaded" }),
  });
}
let PAGE = createDocument();

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
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    toggle: (name: string, on: boolean) =>
      on ? this.classes.add(name) : this.classes.delete(name),
  };
  readonly classes = new Set<string>();
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, (() => void)[]>();
  readonly ownerDocument = PAGE;
  readonly style: Record<string, unknown> = {
    getPropertyValue: () => "",
    removeProperty: vi.fn(),
    setProperty: vi.fn(),
  };
  type = "";
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: () => void): void {
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
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
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
        return this.classes.has(rule.slice(1)) || this.className.split(" ").includes(rule.slice(1));
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
  backToTitle: "Back to title",
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
  towing: false,
  ...change,
});

function mountedRoot() {
  const root = fixtureActionRoot(new FakeElement());
  PAGE.body!.append(root);
  return root;
}

function cards(detached = false) {
  const root = detached ? new FakeElement() : mountedRoot();
  const options = {
    labels: LABELS,
    onBackToTitle: vi.fn(),
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
const buttonsOf = (actions: FakeElement) =>
  actions.children.flatMap((node) => (node.dataset.action ? [node] : node.children));

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

it("keeps a standalone Map footer Close and invokes its direct caller once", () => {
  const { map, onClose, root } = standaloneMap();
  const footer = root.querySelectorAll().find((node) => node.dataset.action === "map-close")!;
  expect(footer.textContent).toBe("Close");
  map.open();
  footer.click();
  expect(onClose).toHaveBeenCalledOnce();
  map.dispose();
  footer.click();
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
    towing: false,
  };
}
function mapMeasurement() {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "", length: 0 }));
  vi.stubGlobal("devicePixelRatio", 1);
}

it.each(["map-zoomIn", "map-travel"])(
  "rejects missing %s metadata in the completed Map layout",
  (id) => {
    const bind = actionBinding.bindAdaAction;
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
      element.dataset.action === id
        ? { activate: () => false, dispose() {}, update() {} }
        : bind(options, element),
    );
    // The Travel leaf is mounted in the hidden panel even without a selection or an action root.
    const root = id === "map-travel" ? new FakeElement() : mountedRoot();
    expect(() => standaloneMap(root)).toThrow("no registered action binding");
    expect(root.querySelector(`[data-action="${id}"]`)).not.toBeNull();
    expect(root.querySelector(".ada-map-panel")?.hidden).toBe(true);
  },
);

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

it("rejects a newly mounted Map chip whose registration was bypassed", () => {
  mapMeasurement();
  const { map } = standaloneMap();
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation(() => ({
    activate: () => false,
    dispose() {},
    update() {},
  }));
  map.setState(mapState([STATION]));
  try {
    expect(() => map.open()).toThrow("no registered action binding");
  } finally {
    map.dispose();
  }
});

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
      footer.click();
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

  it("sorts the grid by label, then full-width Back to title above primary Resume, with no objective", () => {
    const { body, pause } = cards();
    pause.setState(state({ job: "Chart the Sleepy Tug" }));
    expect(body.children).toHaveLength(1);
    const actions = body.children[0]!;
    expect(actions.className).toContain("ada-stack");
    expect(actions.children[0]!.className).toContain("ada-pause-grid");
    expect(actions.children).toHaveLength(1);
    expect(actions.children[0]!.children.at(-1)!.dataset.action).toBe("pause-resume");
    expect(actions.children[0]!.children.at(-1)!.className).toContain("ada-primary");
    expect(shownActions(actions)).toEqual([
      "pause-map",
      "pause-quests",
      "pause-settings",
      "pause-ship",
      "pause-backToTitle",
      "pause-resume",
    ]);
    expect(buttonsOf(actions).map((node) => node.textContent)).toEqual([
      "Map",
      "Quests",
      "Settings",
      "Ship",
      "Back to title",
      "Resume",
    ]);
    // Back to title and Resume each span the grid; the four others share its two columns.
    expect(
      buttonsOf(actions)
        .filter((node) => node.classes.has("ada-pause-full"))
        .map((node) => node.dataset.action),
    ).toEqual(["pause-backToTitle", "pause-resume"]);
  });

  it("keeps every action, Back to title included, available in danger", () => {
    const { body, options, pause } = cards();
    pause.setState(state({ inDanger: true }));
    const actions = buttonsOf(body.children[0]!);
    expect(actions.map((node) => node.getAttribute("aria-disabled"))).toEqual([
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
      const event = new Event("keydown", { cancelable: true });
      Object.defineProperty(event, "key", { value: "Escape" });
      PAGE.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
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
      const event = new Event("keydown", { cancelable: true });
      Object.defineProperty(event, "key", { value: "Escape" });
      PAGE.dispatchEvent(event);
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
      const event = new Event("keydown", { cancelable: true });
      Object.defineProperty(event, "key", { value: "Escape" });
      PAGE.dispatchEvent(event);
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
  expect(shownActions(actions)).toEqual([
    "pause-quests",
    "pause-settings",
    "pause-ship",
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
  expect(shownActions(actions)[0]).toBe("pause-map");
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
    if (method === "Escape") {
      const event = new Event("keydown", { cancelable: true });
      Object.defineProperty(event, "key", { value: "Escape" });
      PAGE.dispatchEvent(event);
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
  },
);

it.each([
  "resource:ore",
  "equipment:engine",
  "equipment:shield",
  "equipment:tractor",
  "equipment:paint",
  "cargo:holodisks",
  "weapon:laser",
])("returns %s details to the same Ship and item context", (item) => {
  const { body, modal, options, pause, root, ship } = cards();
  pause.setState(state());
  pause.open();
  button(body.children[0]!, "pause-ship").click();
  const origin = ship.querySelectorAll().find((node) => node.dataset.item === item)!;
  expect(origin).toBeDefined();
  const snapshot = structuredClone(SHIP);
  origin.click();
  expect(modal.hidden).toBe(true);
  expect(pause.shipOpen()).toBe(true);
  expect(
    root.children.some((node) => node !== modal && node.className === "ada-modal" && !node.hidden),
  ).toBe(true);
  pause.closeShip();
  expect(pause.shipOpen()).toBe(true);
  expect(modal.hidden).toBe(false);
  expect(focused()).toBe(origin);
  expect(SHIP).toEqual(snapshot);
  expect(options.onBackToTitle).not.toHaveBeenCalled();
  expect(options.onGalaxies).not.toHaveBeenCalled();
});

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

it("retains the Pause ancestor through Settings until Resume", () => {
  const { body, modal, options, pause } = cards();
  pause.setState(state());
  pause.open();
  button(body.children[0]!, "pause-settings").click();
  expect(options.onSettings).toHaveBeenCalledOnce();
  expect(modal.hidden).toBe(true);
  expect(pause.isOpen()).toBe(true);
  expect(options.onOpenChange.mock.calls).toEqual([[true]]);
  pause.restorePaused("settings");
  expect(focused()).toBe(button(body.children[0]!, "pause-settings"));
  expect(modal.hidden).toBe(false);
  expect(pause.isOpen()).toBe(true);
  button(body.children[0]!, "pause-resume").click();
  expect(pause.isOpen()).toBe(false);
  expect(options.onOpenChange.mock.calls).toEqual([[true], [false]]);
});

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
    if ((scope as unknown as FakeElement).classes.has("ada-ship-sections")) {
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
    if (nodes.length === 1 && nodes[0]?.classes.has("ada-ship-sections")) {
      outside.append(nodes[0]);
    }
  });
  expect(() => shipButton.click()).toThrow("no live action root");
  expect(focused()).toBe(focusBefore);
  expect(outside.isConnected).toBe(true);
  pause.dispose();
});

it.each(["pause-resume", "close-ship"])(
  "rejects a missing static Pause binding %s at semantic completion",
  (id) => {
    const original = actionBinding.bindAdaAction;
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
      element.dataset.action === id
        ? { activate: () => false, dispose() {}, update() {} }
        : original(options, element),
    );
    expect(() => cards()).toThrow("no registered action binding");
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
