import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { LocalMap } from "../model/map.ts";
import { mapScreenLabels } from "./mapScreen.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "./pauseCard.ts";
import type { ShipView } from "./shipCard.ts";

// Every focus() call, latest last, with the options of the latest.
const focusLog: FakeElement[] = [];
const focused = () => focusLog.at(-1);
let lastFocusOptions: unknown;

// The cards' document, where the kit's focusTarget tracks the last input. With no window it
// tracks touchstart for presses.
const PAGE = Object.assign(new EventTarget(), { defaultView: null });

// A stand-in for the few DOM members the pause cards and the map screen's construction use.
class FakeElement {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
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
  }
  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
    }
  }
  closest(): null {
    return null;
  }
  focus(options?: unknown): void {
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
    return [];
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

const LABELS: PauseLabels = {
  backToTitle: "Back to title",
  close: "Close",
  map: "Map",
  mapScreen: mapScreenLabels(CONTENT.labels),
  resume: "Resume",
  settings: "Settings",
  ship: "Ship",
  shipHeadings: { cargo: "Cargo", equipment: "Equipment", weapons: CONTENT.labels.shopWeapons! },
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
  vi.stubGlobal("document", {
    createElement: () => new FakeElement(),
    createElementNS: () => new FakeElement(),
    fonts: Object.assign(new EventTarget(), { status: "loaded" }),
  });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
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

// Resume, then the grid's buttons in order.
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

  it("is a two-column grid of Map, Ship, Settings and Back to title over Resume, with no objective", () => {
    const { body, pause } = cards();
    pause.setState(state({ job: "Chart the Sleepy Tug" }));
    expect(body.children).toHaveLength(1);
    const actions = body.children[0]!;
    expect(actions.className).toContain("ada-stack");
    expect(actions.children[0]!.className).toContain("ada-pause-grid");
    expect(actions.children[1]!.dataset.action).toBe("pause-resume");
    expect(shownActions(actions)).toEqual([
      "pause-map",
      "pause-ship",
      "pause-settings",
      "pause-backToTitle",
      "pause-resume",
    ]);
    expect(buttonsOf(actions).map((node) => node.textContent)).toEqual([
      "Map",
      "Ship",
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
    ]);
    actions[3]!.click();
    expect(options.onBackToTitle).toHaveBeenCalledOnce();
  });

  it("shows only Settings and Back to title on Ada's room page", () => {
    const { body, options, pause } = cards();
    const actions = body.children[0]!;
    pause.setState(state({ place: "room" }));
    expect(shownActions(actions)).toEqual(["pause-settings", "pause-backToTitle"]);
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
  it("opens from Ship in the Paused card's place, titled Ship, its rows built and focus on the X", () => {
    const { body, modal, pause, ship } = cards();
    pause.setState(state());
    pause.open();
    expect(ship.hidden).toBe(true);
    button(body.children[0]!, "pause-ship").click();
    expect(pause.shipOpen()).toBe(true);
    expect(ship.hidden).toBe(false);
    expect(modal.children[0]!.hidden).toBe(true);
    expect(ship.getAttribute("aria-label")).toBe("Ship");
    const close = ship.children[1]!;
    expect(close.dataset.action).toBe("close-ship");
    expect(focused()).toBe(close);
    const shown = texts(ship.children[0]!);
    expect(shown).toEqual(
      expect.arrayContaining(["Ship", "Cargo", "Equipment", "1,234", "Shield (2)", "Weapons"]),
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
    expect(focused()).toBe(ship.children[1]);
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
