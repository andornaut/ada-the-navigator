import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAdaActionRoot } from "../actionRegistry.ts";
import { bindAdaActionRoot } from "../holdActionsAdapter.ts";
import { units } from "../layout/css.ts";
import { VIEW_SCALE_EVENT } from "../layout/viewScale.ts";
import { enterPressView, rootPressGuard } from "../pressScope.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    tagName = "DIV";
    type = "";
    disabled = false;
    parentElement: Node | null = null;
    connected = true;
    get isConnected(): boolean {
      return this.parentElement?.isConnected ?? this.connected;
    }
    get ownerDocument() {
      return document;
    }
    contains(target: unknown): boolean {
      return (
        target === this ||
        (target instanceof Node &&
          Boolean(target.parentElement) &&
          this.contains(target.parentElement))
      );
    }
    closest(): Node | null {
      return this.hidden ? this : (this.parentElement?.closest() ?? null);
    }
    nodeType = 1;
    readonly childNodes: Node[] = [];
    clientHeight = 0;
    scrollHeight = 0;
    get childElementCount(): number {
      return this.children.length;
    }
    private data = "";
    get children(): Node[] {
      return this.childNodes.filter((node) => node.nodeType === 1);
    }
    get parentNode(): Node | null {
      return this.parentElement;
    }
    get nextSibling(): Node | null {
      const siblings = this.parentElement?.childNodes;
      return siblings?.[siblings.indexOf(this) + 1] ?? null;
    }
    get firstChild(): Node | null {
      return this.childNodes[0] ?? null;
    }
    get nodeValue(): string | null {
      return this.nodeType === 3 ? this.data : null;
    }
    set nodeValue(value: string | null) {
      if (this.nodeType === 3) {
        this.data = value ?? "";
      }
    }
    get textContent(): string {
      return this.nodeType === 3
        ? this.data
        : this.childNodes.map((node) => node.textContent).join("");
    }
    set textContent(value: string) {
      if (this.nodeType === 3) {
        this.data = value;
      } else {
        this.replaceChildren(
          ...(value ? [Object.assign(new Node(), { nodeType: 3, nodeValue: value })] : []),
        );
      }
    }
    className = "";
    readonly classList = {
      add: (name: string) => {
        this.className += ` ${name}`;
      },
      remove: (name: string) => this.classList.toggle(name, false),
      toggle: (name: string, on: boolean) => {
        const names = new Set(this.className.split(" ").filter(Boolean));
        if (on) {
          names.add(name);
        } else {
          names.delete(name);
        }
        this.className = [...names].join(" ");
      },
    };
    dataset: Record<string, string> = {};
    readonly attributes = new Map<string, string>();
    style = {
      getPropertyValue: () => "",
      removeProperty: vi.fn(),
      rowGap: "",
      setProperty: vi.fn(),
    };
    hidden = false;
    focus = vi.fn();
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    toggleAttribute(name: string, force: boolean) {
      if (force) {
        this.setAttribute(name, "");
      } else {
        this.removeAttribute(name);
      }
      return force;
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
    querySelectorAll(selector: string): Node[] {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector: string): Node | null {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.childNodes;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentElement = null;
      }
    }
    insertBefore(node: Node, before: Node | null) {
      if (node === before) {
        return node;
      }
      node.remove();
      node.parentElement = this;
      this.childNodes.splice(
        before ? this.childNodes.indexOf(before) : this.childNodes.length,
        0,
        node,
      );
      return node;
    }
    append(...nodes: Node[]) {
      for (const node of nodes) {
        this.insertBefore(node, null);
      }
    }
    replaceChildren(...nodes: Node[]) {
      for (const child of [...this.childNodes]) {
        child.remove();
      }
      this.append(...nodes);
    }
  }
  const card = {
    body: new Node(),
    card: new Node(),
    close: Object.assign(new Node(), { tagName: "BUTTON", type: "button" }),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
  };
  const layer = { dispose: vi.fn(), open: vi.fn(() => vi.fn()) };
  return { Node, card, corruptFactory: false, layer, requests: [] as unknown[] };
});
vi.mock("../modal.ts", async (original) => ({
  ...(await original<typeof import("../modal.ts")>()),
  createButton: (label: string, role = "secondary") =>
    Object.assign(new fixture.Node(), {
      className: role,
      tagName: "BUTTON",
      textContent: label,
      type: "button",
    }),
  createCard: (options: { close: InstanceType<typeof fixture.Node> }) => {
    fixture.requests.push(options);
    fixture.card.close = options.close;
    fixture.card.frame.replaceChildren(fixture.card.body, options.close);
    if (fixture.corruptFactory) {
      fixture.card.frame.append(
        Object.assign(new fixture.Node(), { disabled: true, hidden: true, tagName: "BUTTON" }),
      );
    }
    return fixture.card;
  },
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: () => fixture.layer,
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));

import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  resolveAdaHoldAction,
} from "../actionBinding.ts";
import { actionOrder } from "../modal.ts";
import { createMenuCard } from "./menuCard.ts";

const menus: ReturnType<typeof createMenuCard>[] = [];

const rootReleases: (() => void)[] = [];
afterEach(() => {
  for (const menu of menus.splice(0)) {
    menu.dispose();
  }
  for (const stop of rootReleases.splice(0).reverse()) {
    stop();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.replaceChildren();
  fixture.card.body.clientHeight = fixture.card.body.scrollHeight = 0;
  fixture.card.body.style.rowGap = "";
  fixture.requests.length = 0;
  fixture.corruptFactory = false;
});

function setup(onPublish?: (modal: InstanceType<typeof fixture.Node>) => void) {
  const doc = Object.assign(new EventTarget(), {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
    createTextNode: (text: string) =>
      Object.assign(new fixture.Node(), { nodeType: 3, nodeValue: text }),
    defaultView: Object.assign(new EventTarget(), {
      HTMLElement: fixture.Node,
      Node: fixture.Node,
      clearTimeout,
      getComputedStyle: () => ({ getPropertyValue: () => "1" }),
      performance,
      setTimeout,
    }),
    elementFromPoint: (): InstanceType<typeof fixture.Node> | null => doc.hitTarget,
    hitTarget: null as InstanceType<typeof fixture.Node> | null,
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = new fixture.Node();
  let ready = true;
  let notifyReady = () => {};
  const attached = bindAdaActionRoot(
    {
      guard: rootPressGuard(root as unknown as HTMLElement),
      pointerRelease: { resolvePointer: () => undefined },
      requiredReady: () => ready,
      subscribeRequired: (notify) => {
        notifyReady = notify;
        return () => {};
      },
    },
    root as unknown as HTMLElement,
  );
  rootReleases.push(attached.dispose);
  if (onPublish) {
    const append = root.append.bind(root);
    vi.spyOn(root, "append").mockImplementation((...nodes) => {
      append(...nodes);
      for (const node of nodes.filter((candidate) => candidate.matches(".ada-modal"))) {
        onPublish(node);
      }
    });
  }
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  const menu = createMenuCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    labels: {
      achievements: "Achievements",
      backToTitle: "Back to title",
      cheats: "Cheats",
      settings: "Settings",
    },
    onAction,
    onOpenChange,
    title: "Menu",
  });
  menus.push(menu);
  return {
    dispatchPointer(
      type: "pointerdown" | "pointerup" | "click",
      target: InstanceType<typeof fixture.Node>,
    ) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, {
        button: { value: 0 },
        clientX: { value: 0 },
        clientY: { value: 0 },
        detail: { value: type === "click" ? 1 : 0 },
        isPrimary: { value: true },
        pointerId: { value: 1 },
        target: { value: target },
      });
      doc.hitTarget = target;
      if (type === "click") {
        root.dispatchEvent(event);
        if (!event.defaultPrevented) {
          target.dispatchEvent(event);
        }
      } else {
        doc.dispatchEvent(event);
        if (type === "pointerdown") {
          root.dispatchEvent(event);
        }
      }
      return event;
    },
    doc,
    menu,
    onAction,
    onOpenChange,
    root,
    rows: () => fixture.card.body.children[0]!.children.map((node) => node.children[0]!),
    setReady(value: boolean) {
      ready = value;
      notifyReady();
    },
  };
}

it("publishes the initial Menu with its fixed X already registered", () => {
  const addListener = vi.spyOn(fixture.Node.prototype, "addEventListener");
  const removeListener = vi.spyOn(fixture.Node.prototype, "removeEventListener");
  try {
    const published = vi.fn((modal: InstanceType<typeof fixture.Node>) => {
      const subtree = modal as unknown as HTMLElement;
      expect(modal.hidden).toBe(true);
      expect(modal.querySelectorAll("button")).toEqual([fixture.card.close]);
      assertAdaActionMetadata(subtree);
      assertAdaActionBindings(subtree);
    });
    const { menu, onOpenChange, root } = setup(published);
    expect(published).toHaveBeenCalledExactlyOnceWith(root.children[0]);
    const added = addListener.mock.calls.filter(
      (_, i) => addListener.mock.contexts[i] === fixture.card.close,
    );
    expect(added).toEqual([["click", expect.any(Function), true]]);
    menu.dispose();
    const removed = removeListener.mock.calls.filter(
      (_, i) => removeListener.mock.contexts[i] === fixture.card.close,
    );
    expect(removed).toEqual(added);
    expect(root.children).toEqual([]);
    fixture.card.close.dispatchEvent(new Event("click"));
    expect(onOpenChange).not.toHaveBeenCalled();
  } finally {
    addListener.mockRestore();
    removeListener.mockRestore();
  }
});

describe("production Menu consumer", () => {
  it.each(["start", "nonplay"] as const)(
    "uses the small preset and primary Close last (%s)",
    (context) => {
      const { menu, rows } = setup();
      const origin = new fixture.Node();
      menu.setContext(context);
      expect(fixture.requests.at(-1)).toEqual(
        expect.objectContaining({ size: "small", title: "Menu" }),
      );
      menu.open(origin as unknown as HTMLElement);
      expect(rows().map((node) => node.textContent)).toEqual(
        context === "start"
          ? ["Achievements", "Cheats", "Settings", "Close"]
          : ["Achievements", "Cheats", "Settings", "Back to title", "Close"],
      );
      expect(rows().map((node) => node.getAttribute("data-ui-button-role"))).toEqual(
        context === "start"
          ? ["secondary", "secondary", "secondary", "primary"]
          : ["secondary", "secondary", "secondary", "secondary", "primary"],
      );
      expect(fixture.layer.open).toHaveBeenLastCalledWith(
        expect.objectContaining({ focus: rows().at(-1) }),
        fixture.card.frame,
      );
      rows().at(-1)!.dispatchEvent(new Event("click"));
      expect(menu.isOpen()).toBe(false);
      expect(origin.focus).toHaveBeenCalledOnce();
    },
  );
  it("fits all five room actions using gaps and restores ordinary spacing when they fit", () => {
    const { doc, menu, rows } = setup();
    const { body } = fixture.card;
    body.scrollHeight = 286;
    body.clientHeight = 265;
    menu.setContext("nonplay");
    menu.open();
    const stack = body.children[0]!;
    expect(stack.className).toBe("ui-layout-stack");
    expect(rows()).toHaveLength(5);
    expect(stack.style.rowGap).toBe(units(4));
    expect(body.style.rowGap).toBe(units(3));
    body.clientHeight = 286;
    doc.defaultView.dispatchEvent(new Event(VIEW_SCALE_EVENT));
    expect(stack.style.rowGap).toBe("");
    expect(body.style.rowGap).toBe("");
    menu.dispose();
    body.clientHeight = 265;
    doc.defaultView.dispatchEvent(new Event("resize"));
    expect(stack.style.rowGap).toBe("");
    expect(body.style.rowGap).toBe("");
  });

  it("returns from a child to the same Menu action without invoking navigation or story actions", () => {
    const { menu, onAction, rows } = setup();
    menu.setContext("nonplay");
    menu.open();
    expect(rows().map((node) => node.textContent)).toEqual([
      "Achievements",
      "Cheats",
      "Settings",
      "Back to title",
      "Close",
    ]);
    rows()[2]!.dispatchEvent(new Event("click"));
    expect(menu.isOpen()).toBe(false);
    expect(onAction).toHaveBeenCalledExactlyOnceWith("settings", expect.any(Function));
    onAction.mock.calls[0]![1]();
    expect(menu.isOpen()).toBe(true);
    expect(fixture.layer.open).toHaveBeenLastCalledWith(
      expect.objectContaining({ focus: rows()[2] }),
      fixture.card.frame,
    );
    menu.dispose();
    onAction.mock.calls[0]![1]();
    expect(menu.isOpen()).toBe(false);
  });
  it("keeps existing horizontal footer ordering secondary left and primary right", () => {
    expect(
      actionOrder([
        { id: "primary", role: "primary" as const },
        { id: "secondary", role: "secondary" as const },
      ]).map(({ id }) => id),
    ).toEqual(["secondary", "primary"]);
  });
});

it("uses one shared Settings click listener and keeps the live Ada root and disposal fence", () => {
  const added = vi.spyOn(fixture.Node.prototype, "addEventListener");
  const removed = vi.spyOn(fixture.Node.prototype, "removeEventListener");
  try {
    const { menu, onAction, root, rows, setReady } = setup();
    menu.open();
    const settings = rows()[2]!;
    expect(rows()).toHaveLength(5);
    for (const button of rows()) {
      expect(button.className.split(" ")).toContain("ui-standard-button");
      expect(button.querySelector(".ui-control-label")?.textContent).toBe(button.textContent);
      expect(
        added.mock.calls.filter(
          ([type], index) => type === "click" && added.mock.contexts[index] === button,
        ),
      ).toEqual([["click", expect.any(Function), true]]);
    }
    expect(fixture.card.close.className.split(" ")).toContain("ui-standard-button");
    const native = added.mock.calls.filter(
      ([type], index) => type === "click" && added.mock.contexts[index] === settings,
    );
    expect(native).toEqual([["click", expect.any(Function), true]]);
    expect(settings.querySelector(".ui-control-label")?.textContent).toBe("Settings");
    const click = () => settings.dispatchEvent(new Event("click", { cancelable: true }));
    setReady(false);
    expect(click()).toBe(false);
    expect(onAction).not.toHaveBeenCalled();
    setReady(true);
    const cover = new fixture.Node();
    root.append(cover);
    const leave = enterPressView(root as unknown as HTMLElement, cover as unknown as HTMLElement);
    expect(click()).toBe(false);
    expect(onAction).not.toHaveBeenCalled();
    leave();
    cover.remove();
    click();
    expect(onAction).toHaveBeenCalledExactlyOnceWith("settings", expect.any(Function));
    onAction.mock.calls[0]![1]();
    expect(fixture.layer.open).toHaveBeenLastCalledWith(
      expect.objectContaining({ focus: rows()[2] }),
      fixture.card.frame,
    );
    expect(
      removed.mock.calls.filter(
        ([type], index) => type === "click" && removed.mock.contexts[index] === settings,
      ),
    ).toEqual(native);
    click();
    expect(onAction).toHaveBeenCalledTimes(1);
  } finally {
    added.mockRestore();
    removed.mockRestore();
  }
});

it.each(["footer", "x"])("uses the same Menu dismissal and origin focus through %s", (path) => {
  const { menu, onOpenChange, rows } = setup();
  const origin = new fixture.Node();
  menu.setContext("nonplay");
  menu.open(origin as unknown as HTMLElement);
  const target = path === "x" ? fixture.card.close : rows().at(-1)!;
  target.dispatchEvent(new Event("click"));
  expect(menu.isOpen()).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
});

it("opens the child before reporting the parent hidden so pause ownership never drops", () => {
  const { menu, onAction, onOpenChange, rows } = setup();
  let childOpen = false;
  const held: boolean[] = [];
  onAction.mockImplementation(() => {
    childOpen = true;
  });
  onOpenChange.mockImplementation(() => held.push(menu.isOpen() || childOpen));
  menu.setContext("nonplay");
  menu.open();
  rows()[2]!.dispatchEvent(new Event("click"));
  expect(childOpen).toBe(true);
  expect(held).toEqual([true, true]);
  expect(onAction.mock.invocationCallOrder[0]!).toBeLessThan(
    onOpenChange.mock.invocationCallOrder[1]!,
  );
});

it("routes a held Menu action through the original caller and unregisters rebuilt rows", () => {
  const { menu, onAction, root, rows } = setup();
  menu.open();
  const stale = rows()[2]!;
  const held = resolveAdaHoldAction(root as unknown as HTMLElement, stale);
  expect(held?.available()).toBe(true);
  held?.activate();
  expect(onAction).toHaveBeenCalledExactlyOnceWith("settings", expect.any(Function));
  menu.open();
  held?.activate();
  stale.dispatchEvent(new Event("click"));
  expect(onAction).toHaveBeenCalledTimes(1);
  const current = rows()[2]!;
  menu.dispose();
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, current)).toBeNull();
});

it.each(["achievements", "settings"] as const)(
  "opens Menu %s at the hold threshold and consumes the native release click",
  (action) => {
    vi.useFakeTimers();
    const { dispatchPointer, menu, onAction, root } = setup();
    menu.open();
    const button = root.querySelector(`[data-action="menu-${action}"]`)!;
    dispatchPointer("pointerdown", button);
    vi.advanceTimersByTime(499);
    expect(onAction).not.toHaveBeenCalled();
    expect(menu.isOpen()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(onAction).toHaveBeenCalledExactlyOnceWith(action, expect.any(Function));
    expect(menu.isOpen()).toBe(false);
    dispatchPointer("pointerup", button);
    expect(dispatchPointer("click", button).defaultPrevented).toBe(true);
    expect(onAction).toHaveBeenCalledOnce();
  },
);

it("refuses Menu Achievements when disabled and cancels a pending hold on readiness or foreground loss", () => {
  vi.useFakeTimers();
  const { dispatchPointer, menu, onAction, root, setReady } = setup();
  menu.open();
  const button = root.querySelector('[data-action="menu-achievements"]')!;
  const release = () => {
    vi.advanceTimersByTime(500);
    expect(onAction).not.toHaveBeenCalled();
    dispatchPointer("pointerup", button);
    expect(onAction).not.toHaveBeenCalled();
  };
  const expectCanceledRelease = () => {
    release();
    expect(dispatchPointer("click", button).defaultPrevented).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
    expect(menu.isOpen()).toBe(true);
  };

  button.disabled = true;
  dispatchPointer("pointerdown", button);
  release();
  expect(menu.isOpen()).toBe(true);
  button.disabled = false;

  dispatchPointer("pointerdown", button);
  setReady(false);
  setReady(true);
  expectCanceledRelease();

  const cover = new fixture.Node();
  root.append(cover);
  dispatchPointer("pointerdown", button);
  const leave = enterPressView(root as unknown as HTMLElement, cover as unknown as HTMLElement);
  leave();
  expectCanceledRelease();
});

it("invokes Back to title once and keeps Close as the primary dismissal", () => {
  const { menu, onAction, rows } = setup();
  menu.setContext("nonplay");
  menu.open();
  const back = rows().at(-2)!;
  expect(back.dataset.action).toBe("menu-backToTitle");
  expect(rows().at(-1)!.textContent).toBe("Close");
  back.dispatchEvent(new Event("click"));
  back.dispatchEvent(new Event("click"));
  expect(onAction).toHaveBeenCalledExactlyOnceWith("backToTitle", expect.any(Function));
  expect(menu.isOpen()).toBe(false);
});

it("forwards the actual controls callback and clears the old Menu return before title navigation", () => {
  const source = ts.createSourceFile(
    "controls.ts",
    readFileSync(new URL("../../input/controls.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "createMenuCard") {
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const property = options.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(source) === "onAction",
        );
        if (property && ts.isPropertyAssignment(property)) {
          callback = property.initializer;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(callback).toBeDefined();
  const settings = { open: vi.fn() },
    achievements = { open: vi.fn() };
  const context = {
    achievements,
    cheats: { open: vi.fn() },
    options: {
      pause: {
        labels: { close: "Close", mapScreen: { questBack: "Back" } },
        onBackToTitle: vi.fn(() => expect(context.returnToMenu).toBeUndefined()),
      },
    },
    returnToMenu: vi.fn(),
    settings,
  };
  const js = ts.transpileModule(`(${callback!.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const handler = runInNewContext(js, context) as (action: string, reopen: () => void) => void;
  const reopen = vi.fn();
  handler("settings", reopen);
  expect(settings.open).toHaveBeenCalledOnce();
  expect(context.returnToMenu).toBe(reopen);
  handler("cheats", reopen);
  expect(context.cheats.open).toHaveBeenCalledOnce();
  expect(context.returnToMenu).toBe(reopen);
  handler("achievements", reopen);
  expect(achievements.open).toHaveBeenCalledOnce();
  expect(achievements.open).toHaveBeenCalledWith({ intent: "back", label: "Back" });
  const { menu, onAction, rows } = setup();
  onAction.mockImplementation(handler);
  menu.setContext("nonplay");
  menu.open();
  const back = rows().at(-2)!;
  back.dispatchEvent(new Event("click"));
  back.dispatchEvent(new Event("click"));
  expect(context.options.pause.onBackToTitle).toHaveBeenCalledOnce();
  expect(context.returnToMenu).toBeUndefined();
  expect(settings.open).toHaveBeenCalledTimes(1);
  expect(achievements.open).toHaveBeenCalledTimes(1);
});

it.each(["start", "nonplay"] as const)(
  "dismisses the actual %s Menu backdrop once and restores its opener",
  (context) => {
    const { dispatchPointer, menu, onOpenChange, root } = setup();
    const origin = new fixture.Node();
    menu.setContext(context);
    menu.open(origin as unknown as HTMLElement);
    const modal = root.children[0]!;
    dispatchPointer("pointerdown", fixture.card.body);
    dispatchPointer("pointerup", modal);
    dispatchPointer("click", modal);
    expect(menu.isOpen()).toBe(true);
    dispatchPointer("pointerdown", modal);
    dispatchPointer("pointerup", modal);
    dispatchPointer("click", modal);
    expect(menu.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(origin.focus).toHaveBeenCalledOnce();
    dispatchPointer("pointerdown", modal);
    dispatchPointer("pointerup", modal);
    dispatchPointer("click", modal);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  },
);

it("keeps a child-covered Menu painted but semantically closed and restores the original parent", () => {
  const { menu, onAction, root, rows } = setup();
  menu.open();
  const modal = root.children[0]!;
  const originalFrame = modal.children[0];
  rows()[0]!.dispatchEvent(new Event("click"));
  expect(menu.isOpen()).toBe(false);
  expect(modal.hidden).toBe(true);
  expect(modal.getAttribute("data-ada-modal-underlay")).toBe("");
  expect(modal.getAttribute("inert")).toBe("");
  expect(modal.children[0]).toBe(originalFrame);
  onAction.mock.calls[0]![1]();
  expect(menu.isOpen()).toBe(true);
  expect(modal.getAttribute("data-ada-modal-underlay")).toBeNull();
  expect(modal.getAttribute("inert")).toBeNull();
});

it("rebuilds Start with its direct Cheats entry and without Back to title", () => {
  const { menu, onAction, rows } = setup();
  menu.open();
  expect(rows().map((node) => node.textContent)).toEqual([
    "Achievements",
    "Cheats",
    "Settings",
    "Back to title",
    "Close",
  ]);
  const stale = rows().at(-2)!;
  menu.close();
  menu.setContext("start");
  menu.open();
  expect(rows().map((node) => node.textContent)).toEqual([
    "Achievements",
    "Cheats",
    "Settings",
    "Close",
  ]);
  stale.dispatchEvent(new Event("click"));
  expect(onAction).not.toHaveBeenCalled();
});

it("rejects an unregistered hidden disabled control in the completed Menu factory", () => {
  fixture.corruptFactory = true;
  const published = vi.fn();
  expect(() => setup(published)).toThrow("no registered action binding");
  expect(published).not.toHaveBeenCalled();
  expect(fixture.layer.open).not.toHaveBeenCalled();
  expect(fixture.card.close.focus).not.toHaveBeenCalled();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
  expect(fixture.card.frame.parentElement?.parentElement).toBeNull();
});

it("withdraws the initial Menu if its attached-root audit fails", () => {
  const published = vi.fn((modal: InstanceType<typeof fixture.Node>) => {
    expect(modal.isConnected).toBe(true);
    assertAdaActionMetadata(modal as unknown as HTMLElement);
    rootReleases.pop()!();
    return modal;
  });
  expect(() => setup(published)).toThrow("no live action root");
  expect(published).toHaveBeenCalledOnce();
  const modal = published.mock.results[0]!.value;
  expect(modal.parentElement).toBeNull();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
  expect(() => assertAdaActionMetadata(fixture.card.close as unknown as HTMLElement)).toThrow(
    "no registered action binding",
  );
});

it("audits each Menu rebuild before focus and rejects a native refusal bypass", () => {
  const f = setup();
  const unbound = Object.assign(new fixture.Node(), {
    disabled: true,
    hidden: true,
    tagName: "BUTTON",
  });
  unbound.setAttribute("aria-disabled", "true");
  const bypass = vi.fn();
  unbound.addEventListener("click", bypass);
  fixture.card.frame.append(unbound);
  expect(() => f.menu.open()).toThrow("no registered action binding");
  expect(f.menu.isOpen()).toBe(false);
  expect(fixture.layer.open).not.toHaveBeenCalled();
  expect(f.onOpenChange).not.toHaveBeenCalled();
  expect(f.onAction).not.toHaveBeenCalled();
  expect(bypass).not.toHaveBeenCalled();
  unbound.remove();
  f.menu.open();
  expect(f.menu.isOpen()).toBe(true);
  expect(fixture.layer.open).toHaveBeenCalledOnce();
});

it("audits detached Menu metadata and attached ownership without probing root eligibility", () => {
  setup().menu.dispose();
  const root = new fixture.Node();
  root.connected = false;
  const menu = createMenuCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    labels: {
      achievements: "Achievements",
      backToTitle: "Back to title",
      cheats: "Cheats",
      settings: "Settings",
    },
    onAction: vi.fn(),
    onOpenChange: vi.fn(),
    title: "Menu",
  });
  menus.push(menu);
  expect(menu.isOpen()).toBe(false);
  root.connected = true;
  expect(() => menu.open()).toThrow("no live action root");
  expect(menu.isOpen()).toBe(false);
  const permits = vi.fn(() => {
    throw new Error("Policy must not be probed by construction");
  });
  rootReleases.push(registerAdaActionRoot({ permits }, root as unknown as HTMLElement));
  expect(() => menu.open()).not.toThrow();
  expect(permits).not.toHaveBeenCalled();
  expect(menu.isOpen()).toBe(true);
});
