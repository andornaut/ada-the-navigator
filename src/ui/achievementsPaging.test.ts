import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AchievementEntry, createAchievementsCard } from "./achievementsCard.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";

const corruption = vi.hoisted(() => ({ factory: false, row: false }));
let active: Element | null = null;
const mountedRoots = new Set<Element>();
class Element {
  readonly tagName: string;
  type = "";
  disabled = false;
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    if (tag === "button") {
      this.type = "button";
    }
  }
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  className = "";
  readonly classList = {
    add: (...names: string[]) => {
      this.className = [...new Set([...this.className.split(" "), ...names])]
        .filter(Boolean)
        .join(" ");
    },
    toggle: (name: string, enabled: boolean) => {
      if (enabled) {
        this.classList.add(name);
      } else {
        this.className = this.className
          .split(" ")
          .filter((value) => value !== name)
          .join(" ");
      }
    },
  };
  clientHeight = 360;
  clientWidth = 720;
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, ((event: Event) => void)[]>();
  parent: Element | undefined;
  readonly style = { getPropertyValue: () => "", removeProperty: vi.fn(), setProperty: vi.fn() };
  private text = "";
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.text = value;
  }
  addEventListener(type: string, callback: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type: string, callback: (event: Event) => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== callback),
    );
  }
  get ownerDocument() {
    return document;
  }
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  get isConnected(): boolean {
    return this.parent?.isConnected ?? mountedRoots.has(this);
  }
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  insertBefore(node: Element, before: Element | null): Element {
    if (node === before) {
      return node;
    }
    node.remove();
    node.parent = this;
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
    return node;
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  click() {
    const event = new Event("click", { cancelable: true });
    this.listeners.get("click")?.forEach((callback) => callback(event));
  }
  closest(selector: string): Element | null {
    return this.matches(selector) ? this : (this.parent?.closest(selector) ?? null);
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
  replaceChildren(...nodes: Element[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
    if (this.tagName === "LI" && corruption.row) {
      const unbound = new Element("button");
      unbound.hidden = true;
      unbound.disabled = true;
      this.append(unbound);
    }
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const value = part.trim();
      if (value === "[hidden]") {
        return this.hidden;
      }
      if (value === "[inert]") {
        return this.attributes.has("inert");
      }
      if (value === '[aria-disabled="true" i]') {
        return this.getAttribute("aria-disabled") === "true";
      }
      if (value === ":disabled") {
        return this.disabled;
      }
      if (value === "button" || value === "img") {
        return this.tagName === value.toUpperCase();
      }
      if (value.startsWith(".")) {
        return this.className.split(" ").includes(value.slice(1));
      }
      if (value === "[data-action]") {
        return this.dataset.action !== undefined || this.getAttribute("data-action") !== null;
      }
      const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
      if (input) {
        return this.tagName === "INPUT" && (this.getAttribute("type") ?? this.type) === input[1];
      }
      const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
      if (role) {
        return this.getAttribute("role") === role[1];
      }
      const action = /^\[data-action=["']([^"']+)["']\]$/.exec(value);
      return (
        action !== null && (this.dataset.action ?? this.getAttribute("data-action")) === action[1]
      );
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
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
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}

vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: Element) => {
    active = node;
  },
}));
vi.mock("./layout/viewScale.ts", () => ({ VIEW_SCALE_EVENT: "scale", readViewUnit: () => 1 }));
vi.mock("./modal.ts", async (original) => ({
  ...(await original<typeof import("./modal.ts")>()),
  createCard: (options: { closeAction: string }) => {
    const frame = new Element();
    const card = new Element();
    const body = new Element();
    const close = new Element("button");
    close.dataset.action = options.closeAction;
    card.append(body);
    frame.append(card, close);
    if (corruption.factory) {
      const unbound = new Element("button");
      unbound.hidden = true;
      unbound.disabled = true;
      frame.append(unbound);
    }
    return { body, card, close, dispose: vi.fn(), fit: vi.fn(), frame };
  },
}));

beforeEach(() => {
  active = null;
  corruption.factory = false;
  corruption.row = false;
  vi.stubGlobal("document", {
    get activeElement() {
      return active;
    },
    createElement: (tag: string) => new Element(tag),
    defaultView: { HTMLElement: Element, Node: Element },
  });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("getComputedStyle", () => ({
    paddingBottom: "16",
    paddingLeft: "16",
    paddingRight: "16",
    paddingTop: "16",
  }));
});
afterEach(() => {
  mountedRoots.clear();
  vi.unstubAllGlobals();
});

const entries = (count: number): AchievementEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    condition: `condition:${index}`,
    name: `entry:${index}`,
    unlocked: false,
  }));
function setup(onPublish?: (modal: Element) => void) {
  const root = fixtureActionRoot(new Element());
  mountedRoots.add(root);
  if (onPublish) {
    const append = root.append.bind(root);
    vi.spyOn(root, "append").mockImplementation((modal) => {
      append(modal);
      onPublish(modal);
    });
  }
  const onOpenChange = vi.fn();
  const card = createAchievementsCard(root as unknown as HTMLElement, {
    labels: {
      close: "Close",
      next: "Next",
      page: "{page}/{pages}",
      previous: "Previous",
      progress: "{have}/{need}",
      title: "Achievements",
    },
    onOpenChange,
  });
  card.setEntries(entries(7));
  card.open();
  const modal = root.children[0]!;
  const frame = modal.children[0]!;
  const body = frame.children[0]!.children[0]!;
  const pager = body.children[1]!.children[0]!;
  const [previous, count, next] = pager.children;
  return {
    card,
    close: frame.children[1]!,
    count: count!,
    dismiss: body.children[1]!.children[1]!.children[0]!,
    next: next!,
    onOpenChange,
    pager,
    previous: previous!,
    root,
  };
}

describe("Achievements page actions", () => {
  it("publishes the complete action bindings on the original four buttons", () => {
    const published = vi.fn((modal: Element) => {
      const subtree = modal as unknown as HTMLElement;
      assertAdaActionMetadata(subtree);
      assertAdaActionBindings(subtree);
      expect(modal.hidden).toBe(true);
      return modal.querySelectorAll("button");
    });
    const { card, close, dismiss, next, previous } = setup(published);
    expect(published).toHaveBeenCalledTimes(1);
    const controls = published.mock.results[0]!.value;
    expect(controls.map((button: Element) => button.dataset.action).sort()).toEqual([
      "achievements-close-footer",
      "achievements-next",
      "achievements-previous",
      "close-achievements",
    ]);
    for (const button of [previous, next, close, dismiss]) {
      expect(controls.some((item: Element) => item === button)).toBe(true);
    }
    card.dispose();
  });

  it("shares the existing registry while leaving one native click owner per text button", () => {
    const { card, count, dismiss, next, previous, root } = setup();
    for (const control of [previous, next, dismiss]) {
      expect(control.matches(".ui-standard-button")).toBe(true);
      expect(control.listeners.get("click")).toHaveLength(1);
    }
    const resolve = (button: Element) =>
      resolveAdaHoldAction(root as unknown as HTMLElement, button as unknown as HTMLElement);
    expect(resolve(previous)?.available()).toBe(false);
    next.disabled = true;
    next.click();
    expect(count.textContent).toBe("1/2");
    expect(resolve(next)?.available()).toBe(false);
    next.disabled = false;
    resolve(next)?.activate();
    expect(count.textContent).toBe("2/2");
    expect(resolve(next)?.available()).toBe(false);
    expect(resolve(previous)?.available()).toBe(true);
    expect(resolve(dismiss)?.available()).toBe(true);
    card.dispose();
    for (const button of [previous, next, dismiss]) {
      expect(resolve(button)).toBeNull();
      expect(button.listeners.get("click")).toEqual([]);
    }
  });

  it("hides Previous on the first page and ignores its unavailable action", () => {
    const { card, count, next, previous } = setup();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    previous.click();
    expect(count.textContent).toBe("1/2");
    card.dispose();
  });

  it("shows Previous only when it can go back and hides Next at the end", () => {
    const { card, count, next, previous } = setup();
    active = next;
    next.click();
    expect(count.textContent).toBe("2/2");
    expect(previous.hidden).toBe(false);
    expect(next.hidden).toBe(true);
    expect(active).toBe(previous);
    next.click();
    expect(count.textContent).toBe("2/2");
    previous.click();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    expect(active).toBe(next);
    card.dispose();
  });

  it("keeps Close available when entries shrink to one page and resets on reopening", () => {
    const { card, close, count, next, onOpenChange, pager, previous } = setup();
    active = next;
    next.click();
    card.setEntries(entries(1));
    expect(count.textContent).toBe("1/1");
    expect(pager.hidden).toBe(true);
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(true);
    expect(active).toBe(close);
    close.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    card.setEntries(entries(7));
    card.open();
    expect(count.textContent).toBe("1/2");
    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    expect(active).toBe(close);
    card.dispose();
    for (const control of [previous, next, close]) {
      expect(control.listeners.get("click")).toEqual([]);
    }
  });
  it("keeps the footer Close on every page and uses the same close lifecycle once", () => {
    const { card, close, dismiss, next, onOpenChange } = setup();
    expect(dismiss.textContent).toBe("Close");
    expect(dismiss.hidden).toBe(false);
    next.click();
    expect(dismiss.hidden).toBe(false);
    dismiss.click();
    dismiss.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    card.open();
    close.click();
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
    card.dispose();
    expect(dismiss.listeners.get("click")).toEqual([]);
    dismiss.click();
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });
  it("centers the single Close row and retains the right action beside visible pager buttons", () => {
    const { card, dismiss, pager } = setup();
    const actions = dismiss.parent!;
    expect(pager.hidden).toBe(false);
    expect(actions.style).toMatchObject({ gridColumn: "3", justifySelf: "end" });
    card.setEntries(entries(1));
    expect(pager.hidden).toBe(true);
    expect(actions.style).toMatchObject({ gridColumn: "1 / -1", justifySelf: "center" });
    card.setEntries(entries(7));
    expect(pager.hidden).toBe(false);
    expect(actions.style).toMatchObject({ gridColumn: "3", justifySelf: "end" });
    card.dispose();
  });
  it("labels an actual parent return Back while root opening remains Close and X stays equivalent", () => {
    const { card, close, dismiss, onOpenChange } = setup();
    expect(dismiss.textContent).toBe("Close");
    card.close();
    card.open({ intent: "back", label: "Back" });
    expect(dismiss.textContent).toBe("Back");
    expect(dismiss.parent!.dataset.footerAction).toBe("back");
    card.open();
    expect(dismiss.textContent).toBe("Back");
    dismiss.click();
    expect(card.isOpen()).toBe(false);
    card.open({ intent: "back", label: "Back" });
    close.click();
    expect(card.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
    card.open();
    expect(dismiss.textContent).toBe("Close");
    expect(dismiss.parent!.dataset.footerAction).toBe("close");
    card.dispose();
  });
});

const auditLabels = {
  close: "Close",
  next: "Next",
  page: "{page}/{pages}",
  previous: "Previous",
  progress: "{have}/{need}",
  title: "Achievements",
};
const auditReleases: (() => void)[] = [];
afterEach(() => {
  for (const release of auditReleases.splice(0)) {
    release();
  }
});

it("rejects unregistered hidden disabled controls in completed Achievements factories", () => {
  corruption.factory = true;
  const root = fixtureActionRoot(new Element());
  mountedRoots.add(root);
  const changed = vi.fn();
  const create = () =>
    createAchievementsCard(root as unknown as HTMLElement, {
      labels: auditLabels,
      onOpenChange: changed,
    });
  expect(create).toThrow("no registered action binding");
  expect(root.children).toEqual([]);
  expect(active).toBeNull();
  expect(changed).not.toHaveBeenCalled();
});

it("releases every binding when the publication root audit fails", () => {
  const root = new Element();
  mountedRoots.add(root);
  const append = root.append.bind(root);
  let controls: Element[] = [];
  vi.spyOn(root, "append").mockImplementation((modal) => {
    append(modal);
    controls = modal.querySelectorAll("button");
  });
  expect(() =>
    createAchievementsCard(root as unknown as HTMLElement, {
      labels: auditLabels,
      onOpenChange: vi.fn(),
    }),
  ).toThrow("no live action root");
  expect(controls).toHaveLength(4);
  for (const button of controls) {
    expect(button.listeners.get("click")).toEqual([]);
    expect(() => assertAdaActionMetadata(button as unknown as HTMLElement)).toThrow(
      "no registered action binding",
    );
  }
  expect(root.children).toEqual([]);
});

it("audits completed Achievements entry reconciliation before refitting or moving focus", () => {
  const f = setup();
  const focused = active;
  corruption.row = true;
  expect(() => f.card.setEntries(entries(8))).toThrow("no registered action binding");
  expect(f.card.isOpen()).toBe(false);
  expect(active).toBe(focused);
  expect(f.onOpenChange.mock.calls).toEqual([[true]]);
  corruption.row = false;
  f.card.dispose();
});

it("audits detached Achievements metadata and attached ownership without policy probes", () => {
  const root = new Element();
  const card = createAchievementsCard(root as unknown as HTMLElement, {
    labels: auditLabels,
    onOpenChange: vi.fn(),
  });
  card.setEntries(entries(7));
  expect(card.isOpen()).toBe(false);
  mountedRoots.add(root);
  expect(() => card.open()).toThrow("no live action root");
  expect(card.isOpen()).toBe(false);
  expect(active).toBeNull();
  const permits = vi.fn(() => {
    throw new Error("Policy must not be probed by construction");
  });
  auditReleases.push(registerAdaActionRoot({ permits }, root as unknown as HTMLElement));
  expect(() => card.open()).not.toThrow();
  expect(permits).not.toHaveBeenCalled();
  expect(card.isOpen()).toBe(true);
  card.dispose();
});
