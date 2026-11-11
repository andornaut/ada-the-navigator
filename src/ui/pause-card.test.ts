import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  readonly style = { removeProperty: vi.fn(), setProperty: vi.fn() };
  textContent = "";
  type = "";
  addEventListener(): void {}
  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
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
}

const LABELS: PauseLabels = {
  close: "Close",
  destinations: "Destinations",
  resume: "Resume",
  returnHome: "Return home",
  settings: "Settings",
  title: "Paused",
  travel: "Travel",
  travelEmpty: "None",
  travelUnavailable: "Unavailable",
};

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => new FakeElement() });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function travelButtons(root: FakeElement): FakeElement[] {
  const modal = root.children[0]!;
  const travelFrame = modal.children[1]!;
  const body = travelFrame.children[0]!.children[1]!;
  return body.children[0]!.children;
}

describe("Travel destinations", () => {
  const options = {
    labels: LABELS,
    onOpenChange: vi.fn(),
    onReturnHome: vi.fn(),
    onSettings: vi.fn(),
    onTravel: vi.fn(),
    reducedMotion: () => false,
  };
  const destinations = [
    { id: "workshop", label: "Workshop" },
    { id: "library", label: "Library" },
  ];

  it("keep their button nodes across repeated identical states", () => {
    const root = new FakeElement();
    const cards = createPauseCards(root as unknown as HTMLElement, options);
    cards.setState({ destinations, inDanger: false });
    const first = [...travelButtons(root)];
    expect(first).toHaveLength(2);
    for (let frame = 0; frame < 5; frame++) {
      cards.setState({
        destinations: destinations.map((entry) => ({ ...entry })),
        inDanger: false,
      });
    }
    expect(travelButtons(root)).toEqual(first);
    expect(travelButtons(root).every((button, index) => button === first[index])).toBe(true);
  });

  it("update availability in place and rebuild only for a changed list", () => {
    const root = new FakeElement();
    const cards = createPauseCards(root as unknown as HTMLElement, options);
    cards.setState({ destinations, inDanger: false });
    const first = [...travelButtons(root)];
    cards.setState({ destinations, inDanger: true });
    expect(travelButtons(root).every((button, index) => button === first[index])).toBe(true);
    expect(first.map((button) => button.getAttribute("aria-disabled"))).toEqual(["true", "true"]);
    cards.setState({ destinations: [destinations[0]!], inDanger: true });
    expect(travelButtons(root)).toHaveLength(1);
    expect(travelButtons(root)[0]).not.toBe(first[0]);
  });
});
