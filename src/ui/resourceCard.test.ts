import { afterEach, expect, it, vi } from "vitest";

import { createResourceCard } from "./resourceCard.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    textContent = "";
    attributes: Record<string, string> = {};
    style: Record<string, string> = {};
    focus = vi.fn();
    remove = vi.fn();
    append(...nodes: Node[]) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes: Node[]) {
      this.children = nodes;
    }
    removeAttribute(name: string) {
      delete this.attributes[name];
    }
    cloneNode(): Node {
      return Object.assign(new Node(), { className: this.className });
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }
  const card = {
    body: new Node(),
    card: new Node(),
    close: new Node(),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
    title: new Node(),
  };
  return { Node, card };
});
vi.mock("./modal.ts", () => ({
  createActions: (actions: { button: InstanceType<typeof fixture.Node>; role: string }[]) => {
    const row = new fixture.Node();
    row.append(...actions.map(({ button }) => button));
    return row;
  },
  createButton: (label: string, role: string) => {
    const button = new fixture.Node();
    button.textContent = label;
    button.dataset.role = role;
    return button;
  },
  createCard: () => fixture.card,
  isTap: () => true,
}));
vi.mock("./layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
});

it("uses the shared card and reports exactly one pause/close transition, restoring origin focus", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const resource = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  expect(resource.isOpen()).toBe(false);
  resource.open("Ore", "Approved description", origin as unknown as HTMLElement);
  expect(resource.isOpen()).toBe(true);
  expect(fixture.card.title.textContent).toBe("Ore");
  expect(fixture.card.body.children[0]!.textContent).toBe("Approved description");
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(fixture.card.fit).toHaveBeenCalledOnce();
  resource.close();
  resource.close();
  expect(resource.isOpen()).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  resource.dispose();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
});

it("reopens with current content and traps Tab on the close control", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const resource = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  resource.open("Ore", "First", origin as unknown as HTMLElement);
  resource.close();
  resource.open("Stardust", "Second", origin as unknown as HTMLElement);
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { value: "Tab" });
  root.children[0]!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(fixture.card.title.textContent).toBe("Stardust");
  expect(fixture.card.body.children[0]!.textContent).toBe("Second");
  resource.dispose();
});

it("shows canonical supplied content and secondary Quests before primary Close without a resume gap", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const icon = new fixture.Node();
  const lifecycle: string[] = [];
  const resource = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: (open) => lifecycle.push(open ? "paused" : "closed"),
  });
  resource.open("Toolkit", "Canonical quest description", origin as unknown as HTMLElement, {
    icon: icon as unknown as HTMLElement,
    quests: { label: "Quests", onOpen: () => lifecycle.push("quests-open") },
  });
  const [description, quantity, actions] = fixture.card.body.children;
  expect(fixture.card.title.children[0]).toBe(icon);
  expect(quantity!.hidden).toBe(true);
  expect(description!.textContent).toBe("Canonical quest description");
  expect(fixture.card.frame.attributes["aria-label"]).toBe("Toolkit");
  expect(actions!.children.map((button) => [button.textContent, button.dataset.role])).toEqual([
    ["Quests", "secondary"],
    ["Close", "primary"],
  ]);
  actions!.children[0]!.dispatchEvent(new Event("click"));
  expect(lifecycle).toEqual(["paused", "quests-open", "closed"]);
  expect(origin.focus).not.toHaveBeenCalled();
  resource.open("Ore", "Ore use", origin as unknown as HTMLElement);
  expect(quantity!.hidden).toBe(true);
  expect(quantity!.children).toEqual([]);
  expect(fixture.card.title.children).toHaveLength(1);
  expect(actions!.children[0]!.hidden).toBe(true);
  actions!.children[1]!.dispatchEvent(new Event("click"));
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(resource.isOpen()).toBe(false);
  resource.dispose();
});

it("shows current resource quantities including zero separately and updates them on reopening", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const detail = createResourceCard(new fixture.Node() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  const icon = new fixture.Node();
  icon.className = "ada-status-ore";
  const origin = new fixture.Node() as unknown as HTMLElement;
  for (const [count, expected] of [
    [12345, "12,345"],
    [0, "0"],
    [17, "17"],
  ] as const) {
    detail.open("Ore", "Approved ore description", origin, {
      count,
      icon: icon as unknown as HTMLElement,
    });
    const row = fixture.card.body.children[1]!;
    expect(row.hidden).toBe(false);
    expect(fixture.card.title.children).toHaveLength(1);
    expect(fixture.card.title.children[0]!.textContent).toBe("Ore");
    expect(row.children[0]!.className).toBe("ada-status-ore");
    expect(row.children[0]).not.toBe(icon);
    expect(row.children[1]!.textContent).toBe(expected);
    expect(row.attributes["aria-label"]).toBe(`Ore: ${expected}`);
    expect(fixture.card.body.children[0]!.textContent).toBe("Approved ore description");
    detail.close();
  }
  detail.open("Ore", "Approved ore description", origin);
  expect(fixture.card.body.children[1]!.hidden).toBe(true);
  detail.dispose();
});
