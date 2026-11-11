import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GalaxyMap } from "../model/map.ts";
import { createPauseCards, type PauseLabels } from "./pause-card.ts";

// A stand-in for the few DOM members the pause cards use.
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
  close: "Close",
  map: "Map",
  mapPercent: "{percent}% mapped",
  resume: "Resume",
  returnHome: "Return home",
  settings: "Settings",
  title: "Paused",
  travelEmpty: "None",
  travelHere: "Travel here",
  travelUnavailable: "Unavailable",
};

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => new FakeElement() });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The Map card's body groups: percent, chart, empty note, name, Travel here, danger note.
function mapBody(root: FakeElement) {
  const modal = root.children[0]!;
  const body = modal.children[1]!.children[0]!.children[1]!;
  const [percent, chart, empty, name, travelGroup, danger] = body.children as [
    FakeElement,
    FakeElement,
    FakeElement,
    FakeElement,
    FakeElement,
    FakeElement,
  ];
  return {
    danger,
    empty,
    markers: () => chart.children.slice(1),
    name,
    percent,
    travel: travelGroup.children[0]!,
    travelGroup,
  };
}

const MAP: GalaxyMap = {
  mapped: 25,
  places: [
    {
      id: "workshop",
      kind: "destination",
      label: "Workshop",
      objective: true,
      travel: true,
      x: 400,
      y: -800,
    },
    {
      id: "station:0,0",
      kind: "station",
      label: "Station",
      objective: false,
      travel: true,
      x: 2000,
      y: 300,
    },
  ],
  player: { x: 0, y: 0 },
};

function cards(onTravel = vi.fn()) {
  const root = new FakeElement();
  const pause = createPauseCards(root as unknown as HTMLElement, {
    labels: LABELS,
    onOpenChange: vi.fn(),
    onReturnHome: vi.fn(),
    onSettings: vi.fn(),
    onTravel,
    reducedMotion: () => true,
  });
  return { body: mapBody(root), pause };
}

describe("Map card", () => {
  it("shows the percent mapped and one marker per discovered place, Ada's first", () => {
    const { body, pause } = cards();
    pause.setState({ inDanger: false, map: MAP });
    expect(body.percent.textContent).toBe("25% mapped");
    expect(body.markers().map((marker) => marker.dataset.place)).toEqual([
      "workshop",
      "station:0,0",
    ]);
    expect(body.markers()[0]!.getAttribute("data-objective")).toBe("");
    expect(body.markers()[1]!.getAttribute("data-objective")).toBeNull();
    expect(body.empty.hidden).toBe(true);
  });

  it("says nothing is mapped yet with no places, and offers no Travel here", () => {
    const { body, pause } = cards();
    pause.setState({ inDanger: false, map: { ...MAP, mapped: 0, places: [] } });
    expect(body.markers()).toEqual([]);
    expect(body.empty.hidden).toBe(false);
    expect(body.travelGroup.hidden).toBe(true);
  });

  it("keeps marker nodes across repeated identical states", () => {
    const { body, pause } = cards();
    pause.setState({ inDanger: false, map: MAP });
    const first = body.markers();
    for (let frame = 0; frame < 5; frame++) {
      pause.setState({ inDanger: false, map: structuredClone(MAP) });
    }
    expect(body.markers().every((marker, index) => marker === first[index])).toBe(true);
  });

  it("offers Travel here for a chosen place, and travels there", () => {
    const onTravel = vi.fn();
    const { body, pause } = cards(onTravel);
    pause.setState({ inDanger: false, map: MAP });
    expect(body.travelGroup.hidden).toBe(true);
    body.markers()[1]!.click();
    expect(body.name.textContent).toBe("Station");
    expect(body.travelGroup.hidden).toBe(false);
    expect(body.markers()[1]!.getAttribute("aria-pressed")).toBe("true");
    body.travel.click();
    expect(onTravel).toHaveBeenCalledWith("station:0,0");
  });

  it("keeps Travel here visible but refused in danger, with the danger note", () => {
    const onTravel = vi.fn();
    const { body, pause } = cards(onTravel);
    pause.setState({ inDanger: true, map: MAP });
    body.markers()[0]!.click();
    expect(body.travelGroup.hidden).toBe(false);
    expect(body.travel.getAttribute("aria-disabled")).toBe("true");
    expect(body.danger.hidden).toBe(false);
    body.travel.click();
    expect(onTravel).not.toHaveBeenCalled();
  });

  it("never offers Travel here for a charted landmark", () => {
    const { body, pause } = cards();
    const landmark = {
      id: "comet",
      kind: "landmark" as const,
      label: "Comet",
      objective: false,
      travel: false,
      x: 9000,
      y: 9000,
    };
    pause.setState({ inDanger: false, map: { ...MAP, places: [landmark] } });
    body.markers()[0]!.click();
    expect(body.name.textContent).toBe("Comet");
    expect(body.travelGroup.hidden).toBe(true);
  });
});
