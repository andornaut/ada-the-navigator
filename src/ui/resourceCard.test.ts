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
  expect(fixture.card.body.children[1]!.textContent).toBe("Approved description");
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
  expect(fixture.card.body.children[1]!.textContent).toBe("Second");
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
  const [image, description, actions] = fixture.card.body.children;
  expect(image!.children).toEqual([icon]);
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
  expect(image!.hidden).toBe(true);
  expect(image!.children).toEqual([]);
  expect(actions!.children[0]!.hidden).toBe(true);
  actions!.children[1]!.dispatchEvent(new Event("click"));
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(resource.isOpen()).toBe(false);
  resource.dispose();
});
