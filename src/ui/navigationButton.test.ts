import { afterEach, describe, expect, it, vi } from "vitest";

import { activateNavigation, createNavigationButton } from "./navigationButton.ts";
import { type NavigationActivity, navigationEntry } from "./navigationEntry.ts";

class Node extends EventTarget {
  children: Node[] = [];
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  readonly attributes = new Map<string, string>();
  append(...nodes: Node[]) {
    this.children.push(...nodes);
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}
const activity: NavigationActivity = {
  background: false,
  dialogue: false,
  docked: false,
  flight: { shield: 1 },
  jumping: false,
  mandatoryStory: false,
  mapOpen: false,
  mode: "space",
};
afterEach(() => vi.unstubAllGlobals());

describe("actual Pause/Menu entry", () => {
  it.each([
    { expected: "pause", facts: activity, name: "active gameplay" },
    {
      expected: "menu",
      facts: { ...activity, dialogue: true },
      name: "nonpausable gameplay phase",
    },
    {
      expected: "menu",
      facts: { ...activity, flight: null, mode: "home" as const },
      name: "Start",
    },
    { expected: "menu", facts: { ...activity, mapOpen: true }, name: "Map" },
    {
      expected: "menu",
      facts: { ...activity, flight: null, mandatoryStory: true, mode: "home" as const },
      name: "Earth story",
    },
  ] as const)("routes an actual entry click for $name", ({ expected, facts }) => {
    vi.stubGlobal("document", {
      createElement: () => new Node(),
      createElementNS: () => new Node(),
    });
    vi.stubGlobal("fetch", () => Promise.reject(new Error("No asset fetch in unit fixture")));
    const pause = vi.fn();
    const menu = vi.fn();
    const mode = navigationEntry(facts);
    const root = new Node();
    const entry = createNavigationButton(
      root as unknown as HTMLElement,
      { menu: "Menu", pause: "Pause" },
      () =>
        activateNavigation(
          { mapOpen: facts.mapOpen, menu, pausable: mode === "pause", pause },
          entry.button,
        ),
    );
    entry.setMode(mode);
    entry.button.dispatchEvent(new Event("click"));
    expect(mode).toBe(expected);
    expect(pause).toHaveBeenCalledTimes(expected === "pause" ? 1 : 0);
    expect(menu).toHaveBeenCalledTimes(expected === "menu" ? 1 : 0);
    const button = entry.button as unknown as Node;
    expect(button.attributes.get("aria-label")).toBe(expected === "pause" ? "Pause" : "Menu");
    expect(button.children).toHaveLength(0);
    expect(button.dataset.navigation).toBe(expected);
  });
});
