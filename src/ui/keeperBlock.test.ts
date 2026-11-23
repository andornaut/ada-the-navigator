import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GENERAL_NAMED } from "../data/conversations.ts";
import { KEEPERS } from "../data/keepers.ts";
import type { StationGreeting } from "../model/keepers.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { COMPACT_PORTRAITS, portraitFrame, TAB_COLOURS } from "./dialoguePortraits.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { createKeeperBlock, KEEPER_STYLE } from "./keeperBlock.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { units } from "./layout/css.ts";
import { rootPressGuard } from "./pressScope.ts";

// A stand-in for the few DOM members the block uses.
class FakeElement extends EventTarget {
  disabled = false;
  get parentElement() {
    return this.parent;
  }
  get isConnected(): boolean {
    return this.parent?.isConnected ?? mountedRoots.has(this);
  }
  contains(target: unknown): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }
  matches(selector: string): boolean {
    return selector.split(",").some((entry) => {
      const value = entry.trim();
      if (value === ":disabled") {
        return this.disabled;
      }
      if (value.startsWith("button")) {
        return (
          this.tag.toUpperCase() === "BUTTON" &&
          (!value.includes("ada-primary") || this.className.includes("ada-primary")) &&
          (!value.includes(":not([hidden])") || !this.hasAttribute("hidden"))
        );
      }
      if (value === "[data-action]") {
        return this.dataset.action !== undefined || this.getAttribute("data-action") !== null;
      }
      const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
      if (role) {
        return this.getAttribute("role") === role[1];
      }
      const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
      return (
        input !== null &&
        this.tag.toUpperCase() === "INPUT" &&
        (this.getAttribute("type") ?? this.type) === input[1]
      );
    });
  }
  closest(selector: string): FakeElement | null {
    return (selector.includes("[hidden]") && this.hasAttribute("hidden")) ||
      (selector.includes("[inert]") && this.hasAttribute("inert"))
      ? this
      : (this.parent?.closest(selector) ?? null);
  }
  readonly attributes = new Map<string, string>();
  readonly style = { removeProperty: vi.fn(), setProperty: vi.fn() };
  children: FakeElement[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  id = "";
  parent: FakeElement | null = null;
  readonly tag: string;
  type = "";
  private text = "";
  constructor(tag: string) {
    super();
    this.tag = tag;
  }
  get ownerDocument() {
    return fakeDocument;
  }
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.text = value;
  }
  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }
  click(): void {
    this.dispatchEvent(new Event("click"));
  }
  querySelectorAll(selector: string): FakeElement[] {
    return this.children.flatMap((node) => [
      ...(node.matches(selector) ? [node] : []),
      ...node.querySelectorAll(selector),
    ]);
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
    const parent = this.parent;
    if (!parent) {
      return;
    }
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
const mountedRoots = new Set<FakeElement>();
const disposals: (() => void)[] = [];
// An event target, where the kit's focusTarget tracks the last input.
const fakeDocument = Object.assign(new EventTarget(), {
  activeElement: null as FakeElement | null,
  createElement: (tag: string) =>
    Object.assign(new FakeElement(tag), {
      decode: () => Promise.reject(new Error("This fixture does not decode images")),
    }),
  defaultView: Object.assign(new EventTarget(), {
    HTMLElement: FakeElement,
    Node: FakeElement,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  }),
  hidden: false,
});

const WELCOME = "Welcome aboard. Trade your Stardust, or take a job.";
const LINES = KEEPERS[1]!.greetings.first;

/** A block in a card body, showing greeting, whose taps move a first docking's line on. */
function mounted(greeting: StationGreeting | null) {
  let shown = greeting;
  const shop = new FakeElement("button");
  const actions = {
    advance: () => {
      if (shown && shown.index < shown.count - 1) {
        shown = { ...shown, index: shown.index + 1, line: LINES[shown.index + 1]! };
      }
      block.render(shown);
    },
    focusAfter: () => shop as unknown as HTMLElement,
    labels: { nextLine: "Next line", welcome: WELCOME },
  };
  const block = createKeeperBlock(actions);
  const body = new FakeElement("div");
  const application = fixtureActionRoot(new FakeElement("div"));
  mountedRoots.add(application);
  application.append(body);
  disposals.push(block.dispose);
  body.append(block.element() as unknown as FakeElement);
  block.render(shown);
  const element = () => block.element() as unknown as FakeElement;
  const pips = () =>
    element()
      .find("ada-keeper-pips")
      .children.map((pip) => pip.hasAttribute("data-shown"));
  return { actions, block, body, element, pips, shop };
}

beforeEach(() => {
  fakeDocument.activeElement = null;
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
});

afterEach(() => {
  for (const dispose of disposals.splice(0).reverse()) {
    dispose();
  }
  mountedRoots.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the keeper block", () => {
  it("makes a first docking one button named Next line that shows a line a tap", () => {
    const { body, element, pips } = mounted({
      count: 3,
      displayName: "Saffron",
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
      displayName: "Saffron",
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
    const { element } = mounted({
      count: 1,
      displayName: "Bramble",
      index: 0,
      keeper: "bramble",
      line: later,
    });
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

  it("renders the identified General through the existing keeper cycle and focus handoff", () => {
    const { element, pips, shop } = mounted({
      count: 3,
      displayName: GENERAL_NAMED.name,
      index: 1,
      keeper: "general",
      line: LINES[1],
    });
    const button = element();
    expect(button.dataset.keeper).toBe("general");
    expect(button.hasAttribute("data-generic")).toBe(false);
    expect(button.find("ada-keeper-name").textContent).toBe(GENERAL_NAMED.name);
    expect(pips()).toEqual([true, true, false]);
    button.focus();
    button.click();
    expect(element().tag).toBe("div");
    expect(element().find("ada-keeper-name").textContent).toBe(GENERAL_NAMED.name);
    expect(element().find("ada-keeper-line").textContent).toBe(LINES[2]);
    expect(fakeDocument.activeElement).toBe(shop);
    expect(pips()).toEqual([true, true, true]);
  });

  it("uses the existing named General sheet frame and tab without a cast alias", () => {
    const frame = portraitFrame(true, {
      elapsed: 0,
      mood: "neutral",
      named: true,
      speaker: "general",
    });
    const art = CONVERSATION_BOX.portrait.art;
    expect(KEEPER_STYLE).toContain(`[data-keeper="general"] .ada-keeper-portrait`);
    expect(KEEPER_STYLE).toContain(
      `url('${COMPACT_PORTRAITS.general.url}') ${units(-frame * art)} 0 / ${units(
        COMPACT_PORTRAITS.general.frames * art,
      )}`,
    );
    expect(KEEPER_STYLE).toContain(`background:${TAB_COLOURS.generalNamed}`);
  });

  it("styles every keeper's portrait and tab", () => {
    for (const key of Object.values(KEEPERS).flatMap(({ keepers }) => keepers)) {
      expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-portrait`);
      expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-name`);
    }
  });
});

it("uses the existing root hold once per line and unregisters the terminal and disposed keeper action", () => {
  vi.useFakeTimers();
  const f = mounted({
    count: 3,
    displayName: "Saffron",
    index: 0,
    keeper: "saffron",
    line: LINES[0],
  });
  const currentAdvance = vi.fn(f.actions.advance);
  f.actions.advance = currentAdvance;
  const root = f.body as unknown as HTMLElement;
  const binding = bindAdaActionRoot(
    { guard: rootPressGuard(root), requiredReady: () => true, subscribeRequired: () => () => {} },
    root,
  );
  disposals.push(binding.dispose);
  const button = f.element();
  const event = (type: string) => {
    const value = new Event(type, { cancelable: true });
    Object.defineProperties(
      value,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: 0,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 7,
          target: button,
        }).map(([key, property]) => [key, { value: property }]),
      ),
    );
    return value;
  };
  fakeDocument.dispatchEvent(event("pointerdown"));
  f.body.dispatchEvent(event("pointerdown"));
  vi.advanceTimersByTime(499);
  expect(f.pips()).toEqual([true, false, false]);
  vi.advanceTimersByTime(1);
  expect(f.element()).toBe(button);
  expect(f.pips()).toEqual([true, true, false]);
  expect(currentAdvance).toHaveBeenCalledOnce();
  fakeDocument.dispatchEvent(event("pointerup"));
  const click = event("click");
  f.body.dispatchEvent(click);
  if (!click.defaultPrevented) {
    button.dispatchEvent(event("click"));
  }
  expect(click.defaultPrevented).toBe(true);
  expect(f.pips()).toEqual([true, true, false]);
  button.focus();
  button.click();
  expect(f.element().tag).toBe("div");
  expect(fakeDocument.activeElement).toBe(f.shop);
  expect(resolveAdaHoldAction(root, button)).toBeNull();
  button.click();
  expect(f.pips()).toEqual([true, true, true]);
  f.block.render({ count: 3, displayName: "Saffron", index: 0, keeper: "saffron", line: LINES[0] });
  fakeDocument.dispatchEvent(event("pointerdown"));
  f.body.dispatchEvent(event("pointerdown"));
  f.block.dispose();
  vi.advanceTimersByTime(500);
  expect(resolveAdaHoldAction(root, button)).toBeNull();
  button.click();
  expect(f.pips()).toEqual([true, false, false]);
  expect(currentAdvance).toHaveBeenCalledTimes(2);
});

it("audits the final rendered subtree before the terminal focus handoff", () => {
  const greeting: StationGreeting = {
    count: 3,
    displayName: "Saffron",
    index: 0,
    keeper: "saffron",
    line: LINES[0],
  };
  const f = mounted(greeting);
  const rogue = new FakeElement("button");
  rogue.disabled = true;
  rogue.setAttribute("hidden", "");
  f.element().find("ada-keeper-body").append(rogue);
  f.element().focus();
  const focusAfter = vi.spyOn(f.actions, "focusAfter");
  expect(() => f.block.render({ ...greeting, index: 2, line: LINES[2] })).toThrow(
    "no registered action binding",
  );
  expect(focusAfter).not.toHaveBeenCalled();
});

it("allows detached render and checks ownership only after caller attachment", () => {
  const advance = vi.fn();
  const block = createKeeperBlock({
    advance,
    focusAfter: () => new FakeElement("button") as unknown as HTMLElement,
    labels: { nextLine: "Next line", welcome: WELCOME },
  });
  disposals.push(block.dispose);
  const greeting: StationGreeting = {
    count: 3,
    displayName: "Saffron",
    index: 0,
    keeper: "saffron",
    line: LINES[0],
  };
  expect(() => block.render(greeting)).not.toThrow();
  const root = new FakeElement("div");
  mountedRoots.add(root);
  root.append(block.element() as unknown as FakeElement);
  expect(() => block.render(greeting)).toThrow("no live action root");
  fixtureActionRoot(root);
  expect(() => block.render(greeting)).not.toThrow();
  expect(advance).not.toHaveBeenCalled();
});
