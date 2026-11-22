import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import type { CheatAction } from "./cheatActions.ts";
import { type CheatSwitch, createCheats } from "./cheats.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { rootPressGuard } from "./pressScope.ts";

const corruption = vi.hoisted(() => ({ factory: false }));
const mountedRoots = new Set<Element>();
const roots: ReturnType<typeof bindAdaActionRoot>[] = [];
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
  readonly properties = new Map<string, string>();
  readonly style = {
    backgroundImage: "",
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  };
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

vi.mock("./layout/viewScale.ts", () => ({
  VIEW_SCALE_EVENT: "ada-view-scale",
  readViewUnit: () => 1,
}));
vi.mock("./modal.ts", () => ({
  createActions: (items: { button: Element }[]) => {
    const row = new Element();
    row.append(...items.map((item) => item.button));
    return row;
  },
  createButton: (label: string) => Object.assign(new Element("button"), { textContent: label }),
  createCard: ({ closeAction, closeLabel }: { closeAction: string; closeLabel: string }) => {
    const body = new Element(),
      card = new Element(),
      close = new Element("button"),
      frame = new Element();
    close.dataset.action = closeAction;
    close.setAttribute("aria-label", closeLabel);
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
  createSwitchRow: (options: {
    readonly icon: Element;
    readonly id: string;
    readonly label: string;
  }) => {
    const row = Object.assign(new Element("button"), { textContent: options.label });
    row.append(options.icon, new Element(), new Element());
    return {
      row,
      show: (on: boolean) => row.setAttribute("aria-checked", String(on)),
    };
  },
  setFooterAction: (action: string, row: Element) => {
    row.dataset.footerAction = action;
  },
}));

beforeEach(() => {
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
  const cheats = createCheats(root as unknown as HTMLElement, {
    labels: CHEAT_COPY,
    onOpenChange: changed,
    rows,
  });
  return { actions, changed, cheats, close, root };
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

it("does not add an entry to Settings and only removes its own card", () => {
  const { actions, cheats, close, root } = setup();
  expect(actions.children).toEqual([close]);
  cheats.open();
  expect(actions.children).toEqual([close]);
  cheats.dispose();
  expect(root.children).toEqual([actions]);
});

it("builds the two columns in keyboard order and keeps selective reset separate and guarded", () => {
  const unlock = action("unlockAllEquipment", 1);
  const ore = { ...action("addOre"), label: "Add 1,000 ore" };
  const dust = { ...action("addStardust"), label: "Add 1,000 Stardust" };
  const reset = action("resetSave");
  const selective = action("selectiveReset", 1);
  let fps = false;
  const set = vi.fn((on: boolean) => {
    fps = on;
  });
  const f = setup([
    ore,
    action("unlockAllWeapons"),
    dust,
    action("unlockAllGalaxies"),
    action("maxWeaponLevels"),
    unlock,
    reset,
    { ...selective, label: CHEAT_COPY.selectiveReset },
    action("showTipsAgain"),
    { id: "fpsCounter", isOn: () => fps, label: "FPS counter", set },
  ]);
  const nodes = descendants(f.root);
  const list = nodes.find((node) => node.className === "ada-cheat-items")!;
  expect(list.dataset.scroll).toBeUndefined();
  const [left, right] = list.children;
  expect(left!.children[0]!.textContent).toBe("Progression");
  expect(right!.children[0]!.textContent).toBe("Resources & tools");
  expect(descendants(left!).flatMap((node) => node.dataset.cheat ?? [])).toEqual([
    "unlockAllEquipment",
    "unlockAllGalaxies",
    "unlockAllWeapons",
    "maxWeaponLevels",
  ]);
  expect(descendants(right!).flatMap((node) => node.dataset.cheat ?? [])).toEqual([
    "fpsCounter",
    "addStardust",
    "addOre",
    "selectiveReset",
    "resetSave",
  ]);
  const [fpsRow, grants, selectiveButton, resetButton] = right!.children[1]!.children;
  const [dustButton, addButton] = grants!.children;
  const unlockButton = left!.children[1]!.children[0]!;
  for (const [button, resource, label] of [
    [dustButton!, "stardust", dust.label],
    [addButton!, "ore", ore.label],
  ] as const) {
    expect(button.textContent).toBe("+1,000");
    expect(button.getAttribute("aria-label")).toBe(label);
    expect(button.children[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(button.children[0]!.style.backgroundImage).toBe(
      `url('/art/ui/sprites/icon-${resource}-20.png')`,
    );
  }
  expect(selectiveButton!.tagName).toBe("BUTTON");
  expect(selectiveButton!.textContent).toBe(CHEAT_COPY.selectiveReset);
  const footer = nodes.find((node) => node.dataset.footerAction === "back")!;
  expect(footer.parent).toBe(list.parent);
  expect(footer.parent!.children.indexOf(footer)).toBeGreaterThan(
    footer.parent!.children.indexOf(list),
  );
  f.cheats.open();
  f.cheats.refresh();
  expect(unlockButton!.disabled).toBe(false);
  unlockButton!.dispatchEvent(new Event("click"));
  expect(unlock.run).toHaveBeenCalledOnce();
  expect(unlockButton!.disabled).toBe(true);
  unlockButton!.dispatchEvent(new Event("click"));
  expect(unlock.run).toHaveBeenCalledOnce();
  addButton!.dispatchEvent(new Event("click"));
  addButton!.dispatchEvent(new Event("click"));
  expect(ore.run).toHaveBeenCalledTimes(2);
  expect(addButton!.disabled).toBe(false);
  // The FPS counter's switch row shows its setting icon, keyed outside the device settings.
  const icon = fpsRow!.children.find((node) => node.className === "ada-icon")!;
  expect(icon.dataset.icon).toBe("icon-fps-counter");
  expect(icon.style.backgroundImage).toBe("url('/art/ui/icons/icon-fps-counter.svg')");
  expect(fpsRow!.getAttribute("aria-checked")).toBe("false");
  fpsRow!.dispatchEvent(new Event("click"));
  expect(set).toHaveBeenCalledExactlyOnceWith(true);
  expect(fpsRow!.getAttribute("aria-checked")).toBe("true");
  dustButton!.dispatchEvent(new Event("click"));
  expect(dust.run).toHaveBeenCalledOnce();
  selectiveButton!.dispatchEvent(new Event("click"));
  expect(selective.run).toHaveBeenCalledOnce();
  expect(selectiveButton!.disabled).toBe(true);
  selectiveButton!.dispatchEvent(new Event("click"));
  expect(selective.run).toHaveBeenCalledOnce();
  expect(reset.run).not.toHaveBeenCalled();
  resetButton!.dispatchEvent(new Event("click"));
  expect(reset.run).toHaveBeenCalledOnce();
  f.cheats.dispose();
  addButton!.dispatchEvent(new Event("click"));
  expect(ore.run).toHaveBeenCalledTimes(2);
});

it("uses Back and X on the same guarded return path", () => {
  const f = setup();
  const footer = descendants(f.root).find((node) => node.dataset.footerAction === "back")!;
  const dismiss = footer.children[0]!;
  const x = descendants(f.root).find((node) => node.dataset.action === "close-cheats")!;
  expect(x.getAttribute("aria-label")).toBe("Close");
  expect(dismiss.textContent).toBe("Back");
  expect(dismiss.dataset.action).toBe("dismiss-cheats");
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)?.available()).toBe(false);
  f.cheats.open();
  const held = resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)!;
  expect(held.available()).toBe(true);
  held.activate();
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.cheats.open();
  x.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false], [true], [false]]);
  f.cheats.open();
  f.cheats.dispose();
  held.activate();
  x.dispatchEvent(new Event("click"));
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
});

it("runs a held action once through the original binding", () => {
  vi.useFakeTimers();
  const add = action("addOre");
  const f = setup([add], true);
  const button = descendants(f.root).find((node) => node.dataset.cheat === "addOre")!;
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
  f.cheats.open();
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
  expect(f.cheats.open).toThrow("no registered action binding");
  expect(f.cheats.isOpen()).toBe(false);
  expect(f.changed).not.toHaveBeenCalled();
  unbound.remove();
  f.cheats.open();
  expect(f.cheats.isOpen()).toBe(true);
  expect(
    resolveAdaHoldAction(f.root as unknown as HTMLElement, f.close as unknown as HTMLElement),
  ).toBeNull();
  f.cheats.dispose();
});

it("accepts detached Cheats metadata but rejects a connected card without ownership", () => {
  expect(() => setup([], false, "unowned")).toThrow("no live action root");
  const f = setup([], false, "detached");
  expect(f.cheats.isOpen()).toBe(false);
  expect(f.actions.isConnected).toBe(false);
  f.cheats.dispose();
});

it("does not rescan unchanged Cheats node graphs during eligibility refresh", () => {
  const f = setup();
  const modal = f.root.children.find((node) => node.className === "ada-modal")!;
  const modalQueries = vi.spyOn(modal, "querySelectorAll");
  f.cheats.refresh();
  f.cheats.refresh();
  f.cheats.refresh();
  expect(modalQueries).not.toHaveBeenCalled();
  f.cheats.dispose();
});
