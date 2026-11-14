import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ControlState } from "../input/state.ts";
import type { LocalMap } from "../model/map.ts";
import * as mapUI from "./mapScreen.ts";
import { mapScreenLabels } from "./mapScreen.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "./pauseCard.ts";
import type { ShipView } from "./shipCard.ts";

// Every focus() call, latest last, with the options of the latest.
const focusLog: FakeElement[] = [];
const focused = () => focusLog.at(-1);
let lastFocusOptions: unknown;

// The cards' document, where the kit's focusTarget tracks the last input. With no window it
// tracks touchstart for presses.
let PAGE = Object.assign(new EventTarget(), {
  activeElement: null as FakeElement | null,
  defaultView: null,
});

// A stand-in for the few DOM members the pause cards and the map screen's construction use.
class FakeElement {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  tabIndex = 0;
  tagName = "DIV";
  isConnected = true;
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
  readonly style: Record<string, unknown> = { removeProperty: vi.fn(), setProperty: vi.fn() };
  textContent = "";
  type = "";
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
    for (const node of nodes) {
      node.parentElement = this;
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
    return this === node || this.children.some((child) => child.contains(node));
  }
  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  matches(): boolean {
    return this.type === "button";
  }
  focus(options?: unknown): void {
    PAGE.activeElement = this;
    focusLog.push(this);
    lastFocusOptions = options;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  querySelector(): null {
    return null;
  }
  querySelectorAll(): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.type === "button" ? [child] : []),
      ...child.querySelectorAll(),
    ]);
  }
  remove(): void {}
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  replaceChildren(...nodes: FakeElement[]): void {
    this.children = nodes;
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
  PAGE = Object.assign(new EventTarget(), {
    activeElement: null as FakeElement | null,
    defaultView: null,
  });
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("document", {
    createElement: (tagName: string) =>
      Object.assign(new FakeElement(), { tagName: tagName.toUpperCase() }),
    createElementNS: () => new FakeElement(),
    createTextNode: (text: string) => Object.assign(new FakeElement(), { textContent: text }),
    fonts: Object.assign(new EventTarget(), { status: "loaded" }),
  });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(async () => {
  await Promise.resolve();
  vi.unstubAllGlobals();
});

const MAP: LocalMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  landmarks: { charted: 0, total: 12 },
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

function cards() {
  const root = new FakeElement();
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

describe("Paused card", () => {
  it("Close leaves the local map for gameplay and clears held input through the modal lifecycle", () => {
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
      root
        .querySelectorAll()
        .find((entry) => entry.dataset.action === "map-close")!
        .click();
      expect(pause.mapOpen()).toBe(false);
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

  it("places six equal-grid actions with primary Resume beside Back to title, with no objective", () => {
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
      "pause-ship",
      "pause-quests",
      "pause-settings",
      "pause-backToTitle",
      "pause-resume",
    ]);
    expect(buttonsOf(actions).map((node) => node.textContent)).toEqual([
      "Map",
      "Ship",
      "Quests",
      "Settings",
      "Back to title",
      "Resume",
    ]);
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

  it("shows shared actions in a vertical Earth stack", () => {
    const { body, options, pause } = cards();
    const actions = body.children[0]!;
    pause.setState(state({ place: "room" }));
    expect(shownActions(actions)).toEqual([
      "pause-map",
      "pause-settings",
      "pause-backToTitle",
      "pause-resume",
    ]);
    expect(actions.children[0]!.dataset.place).toBe("room");
    button(actions, "pause-backToTitle").click();
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
  let questsOpen = false;
  const openQuests = vi.fn(() => {
    questsOpen = true;
  });
  const spy = vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => ({
    ...original(...args),
    close: () => {
      mapOpen = false;
    },
    closeQuests: () => {
      questsOpen = false;
    },
    isOpen: () => mapOpen,
    open: () => {
      mapOpen = true;
    },
    openQuests,
    questsOpen: () => questsOpen,
  }));
  const { options, pause } = cards();
  pause.setState(state({ carrying: true }));
  pause.openQuests();
  expect(pause.isOpen()).toBe(true);
  expect(pause.mapOpen()).toBe(true);
  expect(openQuests).not.toHaveBeenCalled();
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
  let questsOpen = false;
  const openQuests = vi.fn(() => {
    questsOpen = true;
  });
  const spy = vi.spyOn(mapUI, "createMapScreen").mockImplementation((...args) => ({
    ...original(...args),
    close: () => {
      mapOpen = false;
    },
    closeQuests: () => {
      questsOpen = false;
    },
    isOpen: () => mapOpen,
    open: () => {
      mapOpen = true;
    },
    openQuests,
    questsOpen: () => questsOpen,
  }));
  try {
    const { body, options, pause, root } = cards();
    pause.setState(state({ map: { ...MAP, quests: [] } }));
    pause.open();
    button(body.children[0]!, "pause-quests").click();
    expect(openQuests).not.toHaveBeenCalled();
    expect(
      root.children.find((child) => child.className.includes("ada-quests-screen"))?.hidden,
    ).toBe(false);
    expect(pause.mapOpen()).toBe(false);
    expect(options.onOpenChange.mock.calls).toEqual([[true]]);
    expect(options.onTravel).not.toHaveBeenCalled();
    expect(options.onBackToTitle).not.toHaveBeenCalled();
    pause.closeMap();
    expect(questsOpen).toBe(false);
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

it("opens a held quest directly, returns Other quests to its list, and resumes only on Close", () => {
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

it.each(["room", "flight"] as const)(
  "keeps Map visible but refuses navigation without canonical permission on %s",
  (place) => {
    const { body, options, pause } = cards();
    const actions = body.children[0]!;
    pause.setState(state({ canMap: false, place }));
    expect(shownActions(actions)).toContain("pause-map");
    expect(button(actions, "pause-map").getAttribute("aria-disabled")).toBe("true");
    button(actions, "pause-map").click();
    expect(pause.mapOpen()).toBe(false);
    expect(options.onGalaxies).not.toHaveBeenCalled();
    const { canMap: permission, ...withoutPermission } = state({ place });
    expect(permission).toBe(true);
    pause.setState(withoutPermission);
    expect(shownActions(actions)).toContain("pause-map");
    expect(button(actions, "pause-map").getAttribute("aria-disabled")).toBe("true");
    button(actions, "pause-map").click();
    expect(pause.mapOpen()).toBe(false);
    expect(options.onGalaxies).not.toHaveBeenCalled();
    pause.setState(state({ canMap: true, place }));
    expect(shownActions(actions)).toContain("pause-map");
    expect(button(actions, "pause-map").getAttribute("aria-disabled")).toBe(null);
    pause.dispose();
  },
);

it("routes Earth's permitted Map to the existing galaxy map without opening an empty local map", () => {
  const { body, options, pause } = cards();
  pause.setState(state({ canMap: true, map: null, place: "room" }));
  pause.open();
  button(body.children[0]!, "pause-map").click();
  expect(options.onGalaxies).toHaveBeenCalledOnce();
  expect(pause.mapOpen()).toBe(false);
  expect(pause.isOpen()).toBe(true);
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
