import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import type { CheatAction } from "./cheatActions.ts";
import { createCheats } from "./cheats.ts";
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
  setFooterAction: (action: string, row: Element) => {
    row.dataset.footerAction = action;
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
  footer?: { readonly intent: "back" | "close"; readonly label: string },
  actionList: readonly CheatAction[] = [],
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
  const run = {};
  const changed = vi.fn();
  const onSave = vi.fn();
  const beforeOpen = vi.fn();
  const cheats = createCheats(root as unknown as HTMLElement, actions as unknown as HTMLElement, {
    actions: actionList,
    beforeOpen,
    canExecute: () => true,
    ...(footer ? { footer } : {}),
    labels: {
      close: "Close",
      open: "Open cheats",
      runGroup: "Run",
      runPersistence: "Run only",
      saveGroup: "Save",
      savePersistence: "Saved",
      title: "Cheats",
    },
    onOpenChange: changed,
    onSave,
    restoreFocus: vi.fn(),
    run: () => run,
  });
  return { actions, beforeOpen, changed, cheats, close, onSave, root };
}

describe("Settings cheat launcher", () => {
  it("places the secondary launcher before the existing primary Close", () => {
    const { actions, cheats, close } = setup();
    expect(actions.children.map((node) => node.textContent)).toEqual(["Open cheats", "Close"]);
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

function descendants(root: Element): Element[] {
  return [root, ...root.children.flatMap(descendants)];
}
it("keeps group order, executes actions once and unregisters on disposal", async () => {
  const root = new Element(),
    launcher = new Element();
  fixtureActionRoot(root);
  mountedRoots.add(root);
  root.append(launcher);
  const save = vi.fn(),
    runEffect = vi.fn(),
    onSave = vi.fn();
  const run = {};
  const cheats = createCheats(root as unknown as HTMLElement, launcher as unknown as HTMLElement, {
    actions: [
      {
        description: "Run description",
        execute: ({ commit }) => {
          commit(runEffect);
        },
        id: "run",
        label: "Run action",
        scope: "run",
      },
      {
        description: "Save description",
        execute: ({ commit }) => {
          commit(save);
        },
        id: "save",
        label: "Save action",
        scope: "save",
      },
    ],
    beforeOpen: vi.fn(),
    canExecute: () => true,
    labels: {
      close: "Close",
      open: "Open cheats",
      runGroup: "Run",
      runPersistence: "Run only",
      saveGroup: "Save",
      savePersistence: "Saved",
      title: "Cheats",
    },
    onOpenChange: vi.fn(),
    onSave,
    restoreFocus: vi.fn(),
    run: () => run,
  });
  const nodes = descendants(root);
  expect(
    nodes.filter((n) => n.className === "ada-cheat-section").map((n) => n.children[0]!.textContent),
  ).toEqual(["Save", "Run"]);
  expect(nodes.filter((n) => n.className === "ada-prose").map((n) => n.textContent)).toEqual([
    "Saved",
    "Save description",
    "Run only",
    "Run description",
  ]);
  const buttons = nodes.filter((n) => n.dataset.cheat);
  launcher.children[0]!.dispatchEvent(new Event("click"));
  buttons[0]!.dispatchEvent(new Event("click"));
  buttons[0]!.dispatchEvent(new Event("click"));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(save).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledOnce();
  expect(runEffect).not.toHaveBeenCalled();
  cheats.refresh();
  buttons[1]!.dispatchEvent(new Event("click"));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(runEffect).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledOnce();
  cheats.dispose();
  buttons[0]!.dispatchEvent(new Event("click"));
  expect(save).toHaveBeenCalledOnce();
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

it("uses a supplied parent Back only for the footer and preserves one dismissal path", () => {
  const f = setup({ intent: "back", label: "Back" });
  const footer = descendants(f.root).find((node) => node.dataset.footerAction === "back")!;
  const dismiss = footer.children[0]!;
  expect(dismiss.textContent).toBe("Back");
  f.actions.children[0]!.dispatchEvent(new Event("click"));
  dismiss.dispatchEvent(new Event("click"));
  dismiss.dispatchEvent(new Event("click"));
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.cheats.dispose();
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, dismiss)?.available()).not.toBe(
    true,
  );
});

it("holds launcher and execute once while preserving busy and deferred installed-app refusal", async () => {
  vi.useFakeTimers();
  const finish: (() => void)[] = [];
  const effect = vi.fn();
  const execute = vi.fn(async ({ commit }: Parameters<CheatAction["execute"]>[0]) => {
    await new Promise<void>((resolve) => {
      finish.push(resolve);
    });
    commit(effect);
  });
  const f = setup(
    undefined,
    [{ description: "Save description", execute, id: "save", label: "Save action", scope: "save" }],
    true,
  );
  const launcher = f.actions.children[0]!;
  const button = descendants(f.root).find((node) => node.dataset.cheat === "save")!;
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
  const settle = async () => {
    for (let n = 0; n < 10; n++) {
      // Each turn settles the session commit and native refresh boundary.
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  };
  down(launcher);
  vi.advanceTimersByTime(499);
  expect(f.cheats.isOpen()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(f.cheats.isOpen()).toBe(true);
  expect(release(launcher).defaultPrevented).toBe(true);
  expect(f.changed.mock.calls).toEqual([[true]]);
  down(button);
  vi.advanceTimersByTime(500);
  expect(execute).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(true);
  expect(release(button).defaultPrevented).toBe(true);
  button.dispatchEvent(new Event("click"));
  expect(execute).toHaveBeenCalledOnce();
  finish.shift()!();
  await settle();
  expect(effect).toHaveBeenCalledOnce();
  expect(f.onSave).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(false);
  down(button);
  vi.advanceTimersByTime(500);
  release(button);
  expect(execute).toHaveBeenCalledTimes(2);
  installed = true;
  finish.shift()!();
  await settle();
  expect(effect).toHaveBeenCalledOnce();
  expect(f.onSave).toHaveBeenCalledOnce();
  expect(f.cheats.isOpen()).toBe(false);
  expect(launcher.hidden).toBe(true);
  installed = false;
  f.cheats.refresh();
  down(launcher);
  f.cheats.dispose();
  vi.advanceTimersByTime(500);
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, launcher)).toBeNull();
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, button)).toBeNull();
  launcher.dispatchEvent(new Event("click"));
  button.dispatchEvent(new Event("click"));
  expect(execute).toHaveBeenCalledTimes(2);
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
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
  expect(() => setup(undefined, [], false, "unowned")).toThrow("no live action root");
  const f = setup(undefined, [], false, "detached");
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
