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
  achievements: "Achievements",
  close: "Close",
  jobObjective: "Job: {objective}",
  map: "Map",
  mapScreen: mapScreenLabels(PROTOTYPE.labels),
  resume: "Resume",
  returnHome: "Return home",
  settings: "Settings",
  title: "Paused",
  travelUnavailable: "Unavailable",
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
};
const state = (change: Partial<PauseState> = {}): PauseState => ({
  field: null,
  inDanger: false,
  job: null,
  map: MAP,
  objective: "",
  towing: false,
  ...change,
});

function cards() {
  const root = new FakeElement();
  const pause = createPauseCards(root as unknown as HTMLElement, {
    labels: LABELS,
    onAchievements: vi.fn(),
    onOpenChange: vi.fn(),
    onReturnHome: vi.fn(),
    onSettings: vi.fn(),
    onTravel: vi.fn(),
    reducedMotion: () => true,
  });
  const body = root.children[0]!.children[0]!.children[0]!.children[1]!;
  return { body, pause, root };
}

describe("Paused card", () => {
  it("shows the story objective above the buttons, and the Job line only while a job is held", () => {
    const { body, pause } = cards();
    const [objective, job, actions] = body.children as [FakeElement, FakeElement, FakeElement];
    pause.setState(state({ objective: "Find the growers." }));
    expect(objective.textContent).toBe("Find the growers.");
    expect(objective.hidden).toBe(false);
    expect(job.hidden).toBe(true);
    expect(actions.className).toContain("ada-actions");
    pause.setState(state({ job: "Chart the Sleepy Tug", objective: "Find the growers." }));
    expect(job.textContent).toBe("Job: Chart the Sleepy Tug");
    expect(job.hidden).toBe(false);
    pause.setState(state());
    expect(objective.hidden).toBe(true);
    expect(job.hidden).toBe(true);
  });

  it("keeps main's five actions in order: Resume, Map, Settings, Achievements, Return home", () => {
    const { body } = cards();
    const actions = body.children[2]!;
    expect(actions.children.map((button) => button.dataset.action)).toEqual([
      "pause-resume",
      "pause-map",
      "pause-settings",
      "pause-achievements",
      "pause-returnHome",
    ]);
  });

  it("refuses Return home in danger while Map stays available", () => {
    const { body, pause } = cards();
    pause.setState(state({ inDanger: true }));
    const actions = body.children[2]!.children;
    expect(actions.map((button) => button.getAttribute("aria-disabled"))).toEqual([
      null,
      null,
      null,
      null,
      "true",
    ]);
    expect(body.children[3]!.hidden).toBe(false);
  });

  it("builds the full-screen map hidden beside the Paused card", () => {
    const { root } = cards();
    const screen = root.children.find((node) => node.className === "ada-map-screen");
    expect(screen?.dataset.dialog).toBe("map");
    expect(screen?.hidden).toBe(true);
  });
});
