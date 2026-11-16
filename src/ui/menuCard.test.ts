import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAdaActionRoot } from "./actionRegistry.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { rootPressGuard } from "./pressScope.ts";

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
    style = { getPropertyValue: () => "", removeProperty: vi.fn(), setProperty: vi.fn() };
    hidden = false;
    focus = vi.fn();
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
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
vi.mock("./modal.ts", async (original) => ({
  ...(await original<typeof import("./modal.ts")>()),
  createButton: (label: string, role = "secondary") =>
    Object.assign(new fixture.Node(), {
      className: role,
      tagName: "BUTTON",
      textContent: label,
      type: "button",
    }),
  createCard: (options: unknown) => {
    fixture.requests.push(options);
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

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { createMenuCard } from "./menuCard.ts";
import { actionOrder } from "./modal.ts";

const menus: ReturnType<typeof createMenuCard>[] = [];

const rootReleases: (() => void)[] = [];
afterEach(() => {
  for (const menu of menus.splice(0)) {
    menu.dispose();
  }
  for (const stop of rootReleases.splice(0).reverse()) {
    stop();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.replaceChildren();
  fixture.requests.length = 0;
  fixture.corruptFactory = false;
});

function setup(exit?: { label: string; onExit: () => void }) {
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
  fixture.card.frame.replaceChildren(fixture.card.body, fixture.card.close);
  const root = new fixture.Node();
  const attached = bindAdaActionRoot(
    {
      guard: rootPressGuard(root as unknown as HTMLElement),
      pointerRelease: { resolvePointer: () => undefined },
      requiredReady: () => true,
      subscribeRequired: () => () => {},
    },
    root as unknown as HTMLElement,
  );
  rootReleases.push(attached.dispose);
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  const menu = createMenuCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    ...(exit ? { exit } : {}),
    labels: { achievements: "Achievements", backToTitle: "Back to title", settings: "Settings" },
    onAction,
    onOpenChange,
    title: "Menu",
  });
  menus.push(menu);
  return {
    doc,
    menu,
    onAction,
    onOpenChange,
    root,
    rows: () => fixture.card.body.children[0]!.children.map((node) => node.children[0]!),
  };
}

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
          ? ["Achievements", "Settings", "Close"]
          : ["Achievements", "Settings", "Back to title", "Close"],
      );
      expect(rows().map((node) => node.className.split(" ")[0])).toEqual(
        context === "start"
          ? ["secondary", "secondary", "primary"]
          : ["secondary", "secondary", "secondary", "primary"],
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
  it("returns from a child to the same Menu action without invoking navigation or story actions", () => {
    const { menu, onAction, rows } = setup();
    menu.setContext("nonplay");
    menu.open();
    expect(rows().map((node) => node.textContent)).toEqual([
      "Achievements",
      "Settings",
      "Back to title",
      "Close",
    ]);
    rows()[1]!.dispatchEvent(new Event("click"));
    expect(menu.isOpen()).toBe(false);
    expect(onAction).toHaveBeenCalledExactlyOnceWith("settings", expect.any(Function));
    onAction.mock.calls[0]![1]();
    expect(menu.isOpen()).toBe(true);
    expect(fixture.layer.open).toHaveBeenLastCalledWith(
      expect.objectContaining({ focus: rows()[1] }),
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
  rows()[1]!.dispatchEvent(new Event("click"));
  expect(childOpen).toBe(true);
  expect(held).toEqual([true, true]);
  expect(onAction.mock.invocationCallOrder[0]!).toBeLessThan(
    onOpenChange.mock.invocationCallOrder[1]!,
  );
});

it("routes a held Menu action through the original caller and unregisters rebuilt rows", () => {
  const { menu, onAction, root, rows } = setup();
  menu.open();
  const stale = rows()[1]!;
  const held = resolveAdaHoldAction(root as unknown as HTMLElement, stale);
  expect(held?.available()).toBe(true);
  held?.activate();
  expect(onAction).toHaveBeenCalledExactlyOnceWith("settings", expect.any(Function));
  menu.open();
  held?.activate();
  stale.dispatchEvent(new Event("click"));
  expect(onAction).toHaveBeenCalledTimes(1);
  const current = rows()[1]!;
  menu.dispose();
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, current)).toBeNull();
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
    readFileSync(new URL("../input/controls.ts", import.meta.url), "utf8"),
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
    const { doc, menu, onOpenChange, root } = setup();
    const origin = new fixture.Node();
    menu.setContext(context);
    menu.open(origin as unknown as HTMLElement);
    const modal = root.children[0]!;
    const event = (type: string, target = modal) => {
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
      if (type === "pointerdown") {
        doc.dispatchEvent(event);
        root.dispatchEvent(event);
      } else if (type === "click") {
        root.dispatchEvent(event);
        if (!event.defaultPrevented) {
          modal.dispatchEvent(event);
        }
      } else {
        doc.dispatchEvent(event);
      }
    };
    event("pointerdown", fixture.card.body);
    event("pointerup");
    event("click");
    expect(menu.isOpen()).toBe(true);
    event("pointerdown");
    event("pointerup");
    event("click");
    expect(menu.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(origin.focus).toHaveBeenCalledOnce();
    event("pointerdown");
    event("pointerup");
    event("click");
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

it("uses the original Exit callback from the actual Start action and retires it on rebuild/disposal", () => {
  const onExit = vi.fn();
  const { menu, rows } = setup({ label: "Exit", onExit });
  menu.setContext("start");
  menu.open();
  const exit = rows().find((node) => node.textContent === "Exit")!;
  exit.dispatchEvent(new Event("click"));
  expect(onExit).toHaveBeenCalledOnce();
  menu.close();
  exit.dispatchEvent(new Event("click"));
  expect(onExit).toHaveBeenCalledOnce();
  menu.setContext("nonplay");
  menu.open();
  expect(rows().some((node) => node.textContent === "Exit")).toBe(false);
  menu.dispose();
  exit.dispatchEvent(new Event("click"));
  expect(onExit).toHaveBeenCalledOnce();
});

it("rejects an unregistered hidden disabled control in the completed Menu factory", () => {
  fixture.corruptFactory = true;
  expect(() => setup()).toThrow("no registered action binding");
  expect(fixture.layer.open).not.toHaveBeenCalled();
  expect(fixture.card.close.focus).not.toHaveBeenCalled();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
  expect(fixture.card.frame.parentElement?.parentElement).toBeNull();
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
    labels: { achievements: "Achievements", backToTitle: "Back to title", settings: "Settings" },
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
