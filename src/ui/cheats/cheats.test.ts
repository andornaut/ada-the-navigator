import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CHEAT_COPY } from "../../data/cheatCopy.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { resolveAdaHoldAction } from "../actionBinding.ts";
import { fixtureActionRoot } from "../actionRootFixture.ts";
import type { CheatAction } from "../cheatActions.ts";
import { bindAdaActionRoot } from "../holdActionsAdapter.ts";
import { rootPressGuard } from "../pressScope.ts";
import { createCheats } from "./cheats.ts";

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
  hasAttribute(name: string) {
    return this.attributes.has(name);
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
  readonly classList = {
    add: (name: string) => {
      this.className = [...new Set([...this.className.split(" "), name])].filter(Boolean).join(" ");
    },
    remove: (name: string) => {
      this.className = this.className
        .split(" ")
        .filter((value) => value !== name)
        .join(" ");
    },
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | undefined;
  readonly properties = new Map<string, string>();
  readonly style = {
    backgroundImage: "",
    removeProperty: (name: string) => this.properties.delete(name),
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  };
  private text = "";
  get textContent(): string {
    return this.text + this.children.map(({ textContent }) => textContent).join("");
  }
  set textContent(text: string) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.text = text;
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  replaceChildren(...nodes: Element[]) {
    this.textContent = "";
    this.append(...nodes);
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
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, on: boolean) {
    if (on) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
}

vi.mock("../modalLayer.ts", () => ({
  createModalLayer: () => ({ dispose: vi.fn(), open: () => vi.fn() }),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: Element) => node.focus(),
}));

vi.mock("../layoutDom/viewScaleBridge.ts", () => ({
  VIEW_SCALE_EVENT: "ada-view-scale",
  readViewUnit: () => 1,
}));
vi.mock("../modal.ts", () => ({
  createActions: (items: { button: Element }[]) => {
    const row = new Element();
    row.append(...items.map((item) => item.button));
    return row;
  },
  createCard: ({ close }: { close: Element }) => {
    const body = new Element(),
      card = new Element(),
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
  rows: readonly CheatAction[] = [],
  hold = false,
  placement: "connected" | "detached" | "unowned" = "connected",
  reducedMotion = false,
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
    reducedMotion: () => reducedMotion,
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
  const dust = { ...action("addStardust", 1), label: "Add 1,000 Stardust" };
  const selective = action("selectiveReset", 1);
  const f = setup([
    ore,
    action("unlockAllWeapons"),
    dust,
    action("unlockAllGalaxies"),
    action("maxWeaponLevels"),
    unlock,
    { ...selective, label: CHEAT_COPY.selectiveReset },
  ]);
  const nodes = descendants(f.root);
  const list = nodes.find((node) => node.className === "ada-cheat-items")!;
  expect(list.dataset.scroll).toBeUndefined();
  const [left, right] = list.children;
  expect(left!.children.map((node) => node.className)).toEqual(["ada-cheat-rows"]);
  expect(right!.children.map((node) => node.className)).toEqual(["ada-cheat-rows"]);
  expect(descendants(left!).flatMap((node) => node.dataset.cheat ?? [])).toEqual([
    "unlockAllEquipment",
    "unlockAllGalaxies",
    "unlockAllWeapons",
  ]);
  expect(descendants(right!).flatMap((node) => node.dataset.cheat ?? [])).toEqual([
    "addStardust",
    "addOre",
    "maxWeaponLevels",
    "selectiveReset",
  ]);
  const [grants, maximizeButton, selectiveButton] = right!.children[0]!.children;
  const [dustButton, addButton] = grants!.children;
  const unlockButton = left!.children[0]!.children[0]!;
  for (const [button, resource, label] of [
    [dustButton!, "stardust", dust.label],
    [addButton!, "ore", ore.label],
  ] as const) {
    expect(button.textContent).toBe("+1,000");
    expect(button.matches(".ui-standard-button")).toBe(true);
    expect(button.getAttribute("aria-label")).toBe(label);
    const [amount, decoration] = button.children;
    expect(amount!.matches(".ui-control-label")).toBe(true);
    expect(amount!.getAttribute("aria-hidden")).toBeNull();
    expect(decoration!.getAttribute("aria-hidden")).toBeNull();
    const [icon] = decoration!.children;
    expect(icon!.matches(".ada-cheat-resource-icon")).toBe(true);
    expect(icon!.getAttribute("aria-hidden")).toBe("true");
    expect(icon!.style.backgroundImage).toBe(`url('${uiIconUrl(`icon-${resource}-20`)}')`);
  }
  expect(maximizeButton!.dataset.cheat).toBe("maxWeaponLevels");
  expect(selectiveButton!.tagName).toBe("BUTTON");
  expect(selectiveButton!.matches(".ui-standard-button")).toBe(true);
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
  dustButton!.dispatchEvent(new Event("click"));
  expect(dust.run).toHaveBeenCalledOnce();
  expect(dustButton!.disabled).toBe(true);
  expect(dustButton!.hidden).toBe(false);
  dustButton!.dispatchEvent(new Event("click"));
  expect(dust.run).toHaveBeenCalledOnce();
  selectiveButton!.dispatchEvent(new Event("click"));
  expect(selective.run).toHaveBeenCalledOnce();
  expect(selectiveButton!.disabled).toBe(true);
  selectiveButton!.dispatchEvent(new Event("click"));
  expect(selective.run).toHaveBeenCalledOnce();
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
  expect(dismiss.matches(".ui-standard-button")).toBe(true);
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

it.each(["addOre", "addStardust", "unlockAllEquipment"])(
  "runs a held %s action just once",
  (id) => {
    vi.useFakeTimers();
    const add = action(id);
    const f = setup([add], true);
    const button = descendants(f.root).find((node) => node.dataset.cheat === id)!;
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
  },
);

it("rechecks a button that became busy since the last refresh before running its callback", () => {
  const run = vi.fn();
  let busy = false;
  const available = vi.fn(() => !busy);
  const id = "selectiveReset";
  const f = setup([{ available, id, label: CHEAT_COPY.selectiveReset, run }]);
  const button = descendants(f.root).find((node) => node.dataset.cheat === id)!;
  f.cheats.open();
  const held = resolveAdaHoldAction(f.root as unknown as HTMLElement, button)!;
  expect(held.available()).toBe(true);
  busy = true;
  expect(held.available()).toBe(false);
  held.activate();
  expect(run).not.toHaveBeenCalled();
  f.cheats.refresh();
  expect(button.disabled).toBe(true);
  busy = false;
  f.cheats.refresh();
  expect(button.disabled).toBe(false);
  button.dispatchEvent(new Event("click"));
  expect(run).toHaveBeenCalledOnce();
  f.cheats.dispose();
});

it.each([false, true])(
  "refuses an exhausted grant without running it, reduced motion=%s",
  (reducedMotion) => {
    vi.useFakeTimers();
    const grant = action("unlockAllWeapons", 0);
    let protectedSession = false;
    const { cheats, root } = setup(
      [{ ...grant, refusalReason: () => (protectedSession ? null : "Action unavailable.") }],
      false,
      "connected",
      reducedMotion,
    );
    const button = descendants(root).find((node) => node.dataset.cheat === grant.id)!;
    cheats.open();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-description")).toBe("Action unavailable.");
    const refusal = resolveAdaHoldAction(root as unknown as HTMLElement, button)!;
    expect(refusal.ownAriaDisabled).toBe("refusal-feedback");
    refusal.activate();
    expect(button.hasAttribute("data-ui-refusal-red")).toBe(true);
    expect(button.hasAttribute("data-ui-refusal-shake")).toBe(!reducedMotion);
    expect(grant.run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(320);
    protectedSession = true;
    cheats.refresh();
    expect(button.disabled).toBe(true);
    expect(refusal.available()).toBe(false);
    refusal.activate();
    expect(button.hasAttribute("data-ui-refusal-red")).toBe(false);
    expect(grant.run).not.toHaveBeenCalled();
    cheats.dispose();
  },
);

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
