import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KEEPERS } from "../data/keepers.ts";
import type { StationGreeting } from "../model/keepers.ts";
import { createKeeperBlock, KEEPER_STYLE } from "./keeper-block.ts";

// A stand-in for the few DOM members the block uses.
class FakeElement {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  id = "";
  parent: FakeElement | null = null;
  readonly tag: string;
  type = "";
  private readonly listeners: (() => void)[] = [];
  private text = "";
  constructor(tag: string) {
    this.tag = tag;
  }
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.text = value;
  }
  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener);
  }
  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }
  click(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
  find(className: string): FakeElement {
    const found = this.children
      .map((child) => (child.className === className ? child : child.tryFind(className)))
      .find((node) => node !== undefined);
    if (!found) {
      throw new Error(`No ${className}`);
    }
    return found;
  }
  focus(): void {
    fakeDocument.activeElement = this;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  replaceWith(node: FakeElement): void {
    const parent = this.parent!;
    parent.children[parent.children.indexOf(this)] = node;
    node.parent = parent;
    this.parent = null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean): void {
    if (force) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
  private tryFind(className: string): FakeElement | undefined {
    try {
      return this.find(className);
    } catch {
      return undefined;
    }
  }
}
const fakeDocument = {
  activeElement: null as FakeElement | null,
  createElement: (tag: string) => new FakeElement(tag),
};

const WELCOME = "Welcome aboard. Trade your Stardust, or take a job.";
const LINES = KEEPERS[1]!.greetings.first;

/** A block in a card body, showing greeting, whose taps move a first docking's line on. */
function mounted(greeting: StationGreeting | null) {
  let shown = greeting;
  const shop = new FakeElement("button");
  const block = createKeeperBlock({
    advance: () => {
      if (shown && shown.index < shown.count - 1) {
        shown = { ...shown, index: shown.index + 1, line: LINES[shown.index + 1]! };
      }
      block.render(shown);
    },
    focusAfter: () => shop as unknown as HTMLElement,
    labels: { nextLine: "Next line", welcome: WELCOME },
  });
  const body = new FakeElement("div");
  body.append(block.element() as unknown as FakeElement);
  block.render(shown);
  const element = () => block.element() as unknown as FakeElement;
  const pips = () =>
    element()
      .find("ada-keeper-pips")
      .children.map((pip) => pip.hasAttribute("data-shown"));
  return { body, element, pips, shop };
}

beforeEach(() => {
  fakeDocument.activeElement = null;
  vi.stubGlobal("document", fakeDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the keeper block", () => {
  it("makes a first docking one button named Next line that shows a line a tap", () => {
    const { body, element, pips } = mounted({
      count: 3,
      index: 0,
      keeper: "saffron",
      line: LINES[0],
    });
    const button = element();
    expect(button.tag).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Next line");
    expect(button.dataset.keeper).toBe("saffron");
    expect(button.find("ada-keeper-name").textContent).toBe("Saffron");
    expect(button.find("ada-keeper-line").textContent).toBe(LINES[0]);
    expect(button.hasAttribute("data-pips")).toBe(true);
    expect(button.find("ada-keeper-pips").getAttribute("aria-hidden")).toBe("true");
    expect(pips()).toEqual([true, false, false]);
    button.click();
    expect(element()).toBe(button);
    expect(button.find("ada-keeper-line").textContent).toBe(LINES[1]);
    expect(pips()).toEqual([true, true, false]);
    expect(body.children).toEqual([button]);
  });

  it("stops being a button on the third line, its focus moving to Shop", () => {
    const { body, element, pips, shop } = mounted({
      count: 3,
      index: 1,
      keeper: "saffron",
      line: LINES[1],
    });
    const button = element();
    button.focus();
    button.click();
    const status = element();
    expect(status.tag).toBe("div");
    expect(body.children).toEqual([status]);
    expect(status.find("ada-keeper-line").textContent).toBe(LINES[2]);
    expect(status.dataset.keeper).toBe("saffron");
    expect(pips()).toEqual([true, true, true]);
    expect(fakeDocument.activeElement).toBe(shop);
  });

  it("shows a later docking's one line as a status, without pips", () => {
    const later = KEEPERS[1]!.greetings.later[0];
    const { element } = mounted({ count: 1, index: 0, keeper: "bramble", line: later });
    expect(element().tag).toBe("div");
    expect(element().find("ada-keeper-line").textContent).toBe(later);
    expect(element().find("ada-keeper-name").textContent).toBe("Bramble");
    expect(element().hasAttribute("data-pips")).toBe(false);
  });

  it("shows Phantom's generic welcome with no portrait, tab or pips", () => {
    const { element } = mounted(null);
    expect(element().tag).toBe("div");
    expect(element().hasAttribute("data-generic")).toBe(true);
    expect(element().dataset.keeper).toBeUndefined();
    expect(element().find("ada-keeper-line").textContent).toBe(WELCOME);
    expect(element().find("ada-keeper-name").textContent).toBe("");
    expect(element().hasAttribute("data-pips")).toBe(false);
    expect(KEEPER_STYLE).toContain("[data-generic] .ada-keeper-frame,");
    expect(KEEPER_STYLE).toContain("[data-generic] .ada-keeper-name{\n  display:none");
  });

  it("styles every keeper's portrait and tab", () => {
    for (const key of Object.values(KEEPERS).flatMap(({ keepers }) => keepers)) {
      expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-portrait`);
      expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-name`);
    }
  });
});
