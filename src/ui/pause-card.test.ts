import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { GalaxyMap } from "../model/map.ts";
import { mapScreenLabels } from "./map-screen.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "./pause-card.ts";

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
  focus(): void {}
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
  mapScreen: mapScreenLabels(PROTOTYPE.labels),
  resume: "Resume",
  settings: "Settings",
  title: "Paused",
};

beforeEach(() => {
  vi.stubGlobal("document", {
    createElement: () => new FakeElement(),
    createElementNS: () => new FakeElement(),
  });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MAP: GalaxyMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  landmarks: { charted: 0, total: 12 },
  mapped: 25,
  places: [],
  player: { x: 0, y: 0 },
  quests: [],
};
const state = (change: Partial<PauseState> = {}): PauseState => ({
  field: null,
  inDanger: false,
  job: null,
  map: MAP,
  place: "flight",
  towing: false,
  ...change,
});

function cards() {
  const root = new FakeElement();
  const options = {
    labels: LABELS,
    onBackToTitle: vi.fn(),
    onOpenChange: vi.fn(),
    onReturnToEarth: vi.fn(),
    onSettings: vi.fn(),
    onTravel: vi.fn(),
    reducedMotion: () => true,
  };
  const pause = createPauseCards(root as unknown as HTMLElement, options);
  const body = root.children[0]!.children[0]!.children[0]!.children[1]!;
  return { body, options, pause, root };
}

const shownActions = (actions: FakeElement) =>
  actions.children.filter((button) => !button.hidden).map((button) => button.dataset.action);

describe("Paused card", () => {
  it("is the action stack alone: Resume, Map, Settings and Back to title, with no objective", () => {
    const { body, pause } = cards();
    pause.setState(state({ job: "Chart the Sleepy Tug" }));
    expect(body.children).toHaveLength(1);
    const actions = body.children[0]!;
    expect(actions.className).toContain("ada-stack");
    expect(shownActions(actions)).toEqual([
      "pause-resume",
      "pause-map",
      "pause-settings",
      "pause-backToTitle",
    ]);
    expect(actions.children.map((button) => button.textContent)).toEqual([
      "Resume",
      "Map",
      "Settings",
      "Back to title",
    ]);
  });

  it("keeps every action, Back to title included, available in danger", () => {
    const { body, options, pause } = cards();
    pause.setState(state({ inDanger: true }));
    const actions = body.children[0]!.children;
    expect(actions.map((button) => button.getAttribute("aria-disabled"))).toEqual([
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
    actions.children.find((button) => button.dataset.action === "pause-backToTitle")!.click();
    expect(options.onBackToTitle).toHaveBeenCalledOnce();
  });

  it("builds the full-screen map hidden beside the Paused card", () => {
    const { root } = cards();
    const screen = root.children.find((node) => node.className === "ada-map-screen");
    expect(screen?.dataset.dialog).toBe("map");
    expect(screen?.hidden).toBe(true);
  });
});
