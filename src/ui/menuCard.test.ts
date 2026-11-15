import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    parentElement: Node | null = null;
    readonly isConnected = true;
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
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    textContent = "";
    focus = vi.fn();
    remove = vi.fn();
    append(...nodes: Node[]) {
      for (const node of nodes) {
        node.parentElement = this;
      }
      this.children.push(...nodes);
    }
    replaceChildren(...nodes: Node[]) {
      for (const node of nodes) {
        node.parentElement = this;
      }
      this.children = nodes;
    }
  }
  const card = {
    body: new Node(),
    card: new Node(),
    close: new Node(),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
  };
  const layer = { dispose: vi.fn(), open: vi.fn(() => vi.fn()) };
  return { Node, card, layer, requests: [] as unknown[] };
});
vi.mock("./modal.ts", async (original) => ({
  ...(await original<typeof import("./modal.ts")>()),
  createButton: (label: string, role = "secondary") =>
    Object.assign(new fixture.Node(), { className: role, textContent: label }),
  createCard: (options: unknown) => {
    fixture.requests.push(options);
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

afterEach(() => {
  for (const menu of menus.splice(0)) {
    menu.dispose();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
  fixture.requests.length = 0;
});

function setup() {
  vi.stubGlobal("document", {
    createElement: () => new fixture.Node(),
    defaultView: { HTMLElement: fixture.Node, Node: fixture.Node },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  fixture.card.frame.replaceChildren(fixture.card.body, fixture.card.close);
  const root = new fixture.Node();
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  const menu = createMenuCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    labels: { achievements: "Achievements", backToTitle: "Back to title", settings: "Settings" },
    onAction,
    onOpenChange,
    title: "Menu",
  });
  menus.push(menu);
  return {
    menu,
    onAction,
    onOpenChange,
    root,
    rows: () => fixture.card.body.children[0]!.children,
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
      expect(rows().map((node) => node.className)).toEqual(
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
      pause: { onBackToTitle: vi.fn(() => expect(context.returnToMenu).toBeUndefined()) },
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
