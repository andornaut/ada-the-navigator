import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    textContent = "";
    focus = vi.fn();
    remove = vi.fn();
    append(...nodes: Node[]) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes: Node[]) {
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
vi.mock("@andornaut/game-kit/web/ui/dom/modalLayer", () => ({
  createModalLayer: () => fixture.layer,
}));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));

import { createMenuCard } from "./menuCard.ts";
import { actionOrder } from "./modal.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
  fixture.requests.length = 0;
});

function setup() {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  const menu = createMenuCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    labels: { achievements: "Achievements", settings: "Settings" },
    onAction,
    onOpenChange,
    title: "Menu",
  });
  return { menu, onAction, onOpenChange, rows: () => fixture.card.body.children[0]!.children };
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
      expect(rows().map((node) => node.textContent)).toEqual(["Achievements", "Settings", "Close"]);
      expect(rows().map((node) => node.className)).toEqual(["secondary", "secondary", "primary"]);
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
    expect(rows().map((node) => node.textContent)).toEqual(["Achievements", "Settings", "Close"]);
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
