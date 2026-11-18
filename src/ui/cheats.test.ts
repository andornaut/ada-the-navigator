import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import type { CheatAction } from "./cheatActions.ts";
import { type CheatSwitch, createCheats } from "./cheats.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { rootPressGuard } from "./pressScope.ts";

const corruption = vi.hoisted(() => ({ factory: false }));
const mountedRoots = new Set<Element>();
let installed = false;
const roots: ReturnType<typeof bindAdaActionRoot>[] = [];
vi.mock("@andornaut/game-kit/runtime/web/pwa/appWindow", () => ({
  runsInAppWindow: () => installed,
}));

class Element extends EventTarget {
  readonly tagName: string;
  type = "";
  constructor(tag = "div") {
    super();
    this.tagName = tag.toUpperCase();
    if (tag === "button") {
      this.type = "button";
    }
  }
  nodeType = 1;
  disabled = false;
  get isConnected(): boolean {
    return this.parent?.isConnected ?? mountedRoots.has(this);
  }
  get ownerDocument() {
    return document;
  }
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  get firstChild(): Element | null {
    return this.children[0] ?? null;
  }
  get lastElementChild(): Element | null {
    return this.children.at(-1) ?? null;
  }
  getClientRects() {
    return [1];
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parent?.closest() ?? null);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  matches(selector: string): boolean {
    if (this.nodeType !== 1) {
      return false;
    }
    return selector.split(",").some((part) => {
      const value = part.trim();
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
  readonly attributes = new Map<string, string>();
  focus() {}
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  insertBefore(node: Element, before: Element | null) {
    node.remove();
    node.parent = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  readonly children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | undefined;
  textContent = "";
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(node: Element) {
    node.parent = this;
    this.children.unshift(node);
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

vi.mock("./modalLayer.ts", () => ({
  createModalLayer: () => ({ dispose: vi.fn(), open: () => vi.fn() }),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: Element) => node.focus(),
}));

vi.mock("./layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("./modal.ts", () => ({
  createActions: (items: { button: Element }[]) => {
    const row = new Element();
    row.append(...items.map((item) => item.button));
    return row;
  },
  createButton: (label: string) => Object.assign(new Element("button"), { textContent: label }),
  createCard: () => {
    const body = new Element(),
      card = new Element(),
      close = new Element("button"),
      frame = new Element();
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
  createSwitchRow: (options: { readonly id: string; readonly label: string }) => {
    const row = Object.assign(new Element("button"), { textContent: options.label });
    row.append(new Element(), new Element(), new Element());
    return {
      row,
      show: (on: boolean) => row.setAttribute("aria-checked", String(on)),
    };
  },
  setFooterAction: (action: string, row: Element) => {
    row.dataset.footerAction = action;
  },
  setScrollGroup: (_parts: unknown, group: Element) => {
    group.dataset.scroll = "true";
  },
}));

beforeEach(() => {
  installed = false;
  corruption.factory = false;
  mountedRoots.clear();
  vi.stubGlobal("HTMLElement", Element);
  const viewport = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    matchMedia: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    performance: { now: () => Date.now() },
    reportError: vi.fn(),
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  });
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      createElement: (tag: string) => new Element(tag),
      defaultView: viewport,
      hidden: false,
    }),
  );
  vi.stubGlobal("window", viewport);
});
afterEach(() => {
  for (const root of roots.splice(0)) {
    root.dispose();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(
  rows: readonly (CheatAction | CheatSwitch)[] = [],
  hold = false,
  placement: "connected" | "detached" | "unowned" = "connected",
) {
  const root = new Element();
  if (hold) {
    const html = root as unknown as HTMLElement;
    roots.push(
      bindAdaActionRoot(
        {
          guard: rootPressGuard(html),
          requiredReady: () => true,
          subscribeRequired: () => () => {},
        },
        html,
      ),
    );
  } else if (placement === "connected") {
    fixtureActionRoot(root);
  }
  if (placement !== "detached") {
    mountedRoots.add(root);
  }
  const actions = new Element();
  root.append(actions);
  const close = Object.assign(new Element("button"), {
    className: "ada-primary",
    textContent: "Close",
  });
  actions.append(close);
  const changed = vi.fn();
  const beforeOpen = vi.fn();
  const cheats = createCheats(root as unknown as HTMLElement, actions as unknown as HTMLElement, {
    beforeOpen,
    labels: { close: "Close", open: "Open Cheats", title: "Cheats" },
    onOpenChange: changed,
    restoreFocus: vi.fn(),
    rows,
  });
  return { actions, beforeOpen, changed, cheats, close, root };
}

function descendants(root: Element): Element[] {
  return [root, ...root.children.flatMap(descendants)];
}

function action(id: string, left = Infinity) {
  let remaining = left;
  const run = vi.fn(() => {
    remaining--;
  });
  return { available: () => remaining > 0, id, label: id, run } satisfies CheatAction;
}

describe("Settings cheat launcher", () => {
  it("places the secondary launcher before the existing primary Close", () => {
    const { actions, cheats, close } = setup();
    expect(actions.children.map((node) => node.textContent)).toEqual(["Open Cheats", "Close"]);
    expect(actions.children[0]!.className).not.toContain("ada-primary");
    expect(actions.children[1]).toBe(close);
    cheats.dispose();
  });

  it("hides only the launcher in the installed app, keeping Close available", () => {
    const { actions, cheats, close } = setup();
    installed = true;
    cheats.refresh();
    expect(actions.children[0]!.hidden).toBe(true);
    expect(actions.hidden).toBe(false);
    expect(close.hidden).toBe(false);
    cheats.dispose();
  });

  it("removes only its launcher when disposed", () => {
    const { actions, cheats, close } = setup();
    cheats.dispose();
    expect(actions.children).toEqual([close]);
  });
});

it("lists one scrolling column in order, runs each press once and disables an exhausted cheat", () => {
  const unlock = action("unlock", 1);
  const add = action("add");
  const reset = action("reset");
  let fps = false;
  const set = vi.fn((on: boolean) => {
    fps = on;
  });
  const f = setup([unlock, add, { id: "fps", label: "FPS counter", on: () => fps, set }, reset]);
  const nodes = descendants(f.root);
  const list = nodes.find((node) => node.className === "ada-cheat-items")!;
  expect(list.dataset.scroll).toBe("true");
  expect(list.children.map((node) => node.dataset.cheat)).toEqual([
    "unlock",
    "add",
    "fps",
    "reset",
  ]);
  const [unlockButton, addButton, fpsRow, resetButton] = list.children;
  // Close sits below the scrolling list as the bottom primary.
  const footer = nodes.find((node) => node.dataset.footerAction === "close")!;
  expect(footer.parent).toBe(list.parent);
  expect(footer.parent!.children.indexOf(footer)).toBeGreaterThan(
    footer.parent!.children.indexOf(list),
  );
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  f.cheats.refresh();
  expect(unlockButton!.disabled).toBe(false);
  unlockButton!.dispatchEvent(new Event("click"));
  expect(unlock.run).toHaveBeenCalledOnce();
  expect(unlockButton!.disabled).toBe(true);
  unlockButton!.dispatchEvent(new Event("click"));
  expect(unlock.run).toHaveBeenCalledOnce();
  addButton!.dispatchEvent(new Event("click"));
  addButton!.dispatchEvent(new Event("click"));
  expect(add.run).toHaveBeenCalledTimes(2);
  expect(addButton!.disabled).toBe(false);
  expect(fpsRow!.getAttribute("aria-checked")).toBe("false");
  fpsRow!.dispatchEvent(new Event("click"));
  expect(set).toHaveBeenCalledExactlyOnceWith(true);
  expect(fpsRow!.getAttribute("aria-checked")).toBe("true");
  resetButton!.dispatchEvent(new Event("click"));
  expect(reset.run).toHaveBeenCalledOnce();
  f.cheats.dispose();
  addButton!.dispatchEvent(new Event("click"));
  expect(add.run).toHaveBeenCalledTimes(2);
});

it("rechecks the installed app at the action as well as at open", () => {
  const add = action("add");
  const f = setup([add]);
  const launcher = f.actions.children[0]!;
  const button = descendants(f.root).find((node) => node.dataset.cheat === "add")!;
  installed = true;
  launcher.dispatchEvent(new Event("click"));
  expect(f.cheats.isOpen()).toBe(false);
  installed = false;
  launcher.dispatchEvent(new Event("click"));
  expect(f.cheats.isOpen()).toBe(true);
  // Installed after opening: the press runs nothing, and the next refresh closes the modal.
  installed = true;
  button.dispatchEvent(new Event("click"));
  expect(add.run).not.toHaveBeenCalled();
  expect(f.cheats.isOpen()).toBe(false);
  expect(launcher.hidden).toBe(true);
  f.cheats.dispose();
});

it("gives header and footer one registered close path with foreground and disposal guards", () => {
  const f = setup();
  const footer = descendants(f.root).find((node) => node.dataset.footerAction === "close")!;
  const dismiss = footer.children[0]!;
  expect(dismiss.textContent).toBe("Close");
  expect(dismiss.dataset.action).toBe("dismiss-cheats");
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)?.available()).toBe(false);
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  const held = resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)!;
  expect(held.available()).toBe(true);
  held.activate();
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  f.cheats.dispose();
  held.activate();
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false], [true], [false]]);
});

it("opens on the launcher's hold and runs a held action once", () => {
  vi.useFakeTimers();
  const add = action("add");
  const f = setup([add], true);
  const launcher = f.actions.children[0]!;
  const button = descendants(f.root).find((node) => node.dataset.cheat === "add")!;
  const event = (type: string, target: Element) => {
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
          target,
        }).map(([key, property]) => [key, { value: property }]),
      ),
    );
    return value;
  };
  const down = (target: Element) => {
    document.dispatchEvent(event("pointerdown", target));
    f.root.dispatchEvent(event("pointerdown", target));
  };
  const release = (target: Element) => {
    document.dispatchEvent(event("pointerup", target));
    const click = event("click", target);
    f.root.dispatchEvent(click);
    if (!click.defaultPrevented) {
      target.dispatchEvent(event("click", target));
    }
    return click;
  };
  down(launcher);
  vi.advanceTimersByTime(499);
  expect(f.cheats.isOpen()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(f.cheats.isOpen()).toBe(true);
  expect(release(launcher).defaultPrevented).toBe(true);
  down(button);
  vi.advanceTimersByTime(500);
  expect(add.run).toHaveBeenCalledOnce();
  expect(release(button).defaultPrevented).toBe(true);
  expect(add.run).toHaveBeenCalledOnce();
  f.cheats.dispose();
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, button)).toBeNull();
});

it("rejects an unregistered hidden disabled control in the completed Cheats modal", () => {
  corruption.factory = true;
  expect(() => setup()).toThrow("no registered action binding");
});

it("rechecks Cheats before opening while ignoring unowned Settings siblings", () => {
  const f = setup();
  const modal = f.root.children.find((node) => node.className === "ada-modal")!;
  const unbound = new Element("button");
  unbound.hidden = true;
  unbound.setAttribute("aria-disabled", "true");
  modal.append(unbound);
  const launcher = f.actions.children[0]!;
  const activate = () =>
    resolveAdaHoldAction(
      f.root as unknown as HTMLElement,
      launcher as unknown as HTMLElement,
    )!.activate();
  expect(() => activate()).toThrow("no registered action binding");
  expect(f.cheats.isOpen()).toBe(false);
  expect(f.beforeOpen).not.toHaveBeenCalled();
  expect(f.changed).not.toHaveBeenCalled();
  unbound.remove();
  activate();
  expect(f.cheats.isOpen()).toBe(true);
  expect(f.beforeOpen).toHaveBeenCalledOnce();
  expect(
    resolveAdaHoldAction(f.root as unknown as HTMLElement, f.close as unknown as HTMLElement),
  ).toBeNull();
  f.cheats.dispose();
});

it("accepts detached Cheats metadata but rejects a connected launcher without ownership", () => {
  expect(() => setup([], false, "unowned")).toThrow("no live action root");
  const f = setup([], false, "detached");
  expect(f.cheats.isOpen()).toBe(false);
  expect(f.actions.isConnected).toBe(false);
  f.cheats.dispose();
});

it("does not rescan unchanged Cheats node graphs during eligibility refresh", () => {
  const f = setup();
  const modal = f.root.children.find((node) => node.className === "ada-modal")!;
  const launcher = f.actions.children[0]!;
  const modalQueries = vi.spyOn(modal, "querySelectorAll");
  const launcherQueries = vi.spyOn(launcher, "querySelectorAll");
  f.cheats.refresh();
  installed = true;
  f.cheats.refresh();
  installed = false;
  f.cheats.refresh();
  expect(modalQueries).not.toHaveBeenCalled();
  expect(launcherQueries).not.toHaveBeenCalled();
  f.cheats.dispose();
});
