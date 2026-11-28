import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureActionRoot } from "./actionRootFixture.ts";
import { activateNavigation, createNavigationButton } from "./navigationButton.ts";
import { type NavigationActivity, navigationEntry } from "./navigationEntry.ts";

class Node extends EventTarget {
  children: Node[] = [];
  className = "";
  readonly classList = {
    add: () => {},
    remove: () => {},
  };
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  parentElement: Node | null = null;
  get ownerDocument(): Document {
    return document;
  }
  get isConnected(): boolean {
    return (this as unknown) === document.body || (this.parentElement?.isConnected ?? false);
  }
  contains(node: unknown): boolean {
    return node === this || (node instanceof Node && this.contains(node.parentElement));
  }
  closest(): Node | null {
    return this.hidden ? this : (this.parentElement?.closest() ?? null);
  }
  readonly attributes = new Map<string, string>();
  append(...nodes: Node[]) {
    for (const node of nodes) {
      node.remove();
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren() {
    this.children.length = 0;
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const key = part.trim();
      return key === this.tag || (key === "[data-action]" && this.dataset.action !== undefined);
    });
  }
  querySelectorAll(selector: string): Node[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
  }
  toggleAttribute(key: string, enabled: boolean) {
    if (enabled) {
      this.setAttribute(key, "");
    } else {
      this.removeAttribute(key);
    }
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
      body: new Node(),
      createElement: (tag: string) => new Node(tag),
      createElementNS: () => new Node(),
      defaultView: { HTMLElement: Node, Node },
    });
    vi.stubGlobal("fetch", () => Promise.reject(new Error("No asset fetch in unit fixture")));
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
    const pause = vi.fn();
    const menu = vi.fn();
    const mode = navigationEntry(facts);
    const root = fixtureActionRoot(new Node());
    document.body.append(root as unknown as HTMLElement);
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
    entry.button.hidden = false;
    entry.button.dispatchEvent(new Event("click"));
    expect(mode).toBe(expected);
    expect(pause).toHaveBeenCalledTimes(expected === "pause" ? 1 : 0);
    expect(menu).toHaveBeenCalledTimes(expected === "menu" ? 1 : 0);
    const button = entry.button as unknown as Node;
    expect(button.attributes.get("aria-label")).toBe(expected === "pause" ? "Pause" : "Menu");
    expect(entry.button.title).toBe(expected === "pause" ? "Pause" : "Menu");
    expect(button.children.map((face) => face.hidden)).toEqual([true]);
    expect(button.dataset.navigation).toBe(expected);
    const other = expected === "pause" ? "menu" : "pause";
    button.remove();
    entry.setMode(other);
    expect(button.dataset.action).toBe(expected);
    root.append(button);
    entry.dispose();
    entry.setMode(other);
    expect(button.dataset.action).toBe(expected);
    expect(button.dataset.navigation).toBe(expected);
    expect(entry.button.title).toBe(expected === "pause" ? "Pause" : "Menu");
    entry.button.dispatchEvent(new Event("click"));
    expect(pause).toHaveBeenCalledTimes(expected === "pause" ? 1 : 0);
    expect(menu).toHaveBeenCalledTimes(expected === "menu" ? 1 : 0);
  });
});
