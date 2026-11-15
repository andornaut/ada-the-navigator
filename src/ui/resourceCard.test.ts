import { afterEach, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { currentView, enterPressView, inCurrentView, rootPressGuard } from "./pressScope.ts";
import { createResourceCard } from "./resourceCard.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    nodeType = 1;
    parentElement: Node | null = null;
    private detached = false;
    get isConnected(): boolean {
      return this.parentElement?.isConnected ?? !this.detached;
    }
    set isConnected(value: boolean) {
      this.detached = !value;
    }
    get ownerDocument() {
      return { ...document, defaultView: { HTMLElement: Node, Node } };
    }
    get parentNode() {
      return this.parentElement;
    }
    get nextSibling(): Node | null {
      return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
    }
    get firstChild() {
      const getText = () => this.textContent;
      const setText = (value: string) => {
        this.textContent = value;
      };
      return {
        nodeType: 3,
        get nodeValue() {
          return getText();
        },
        set nodeValue(value: string) {
          setText(value);
        },
      };
    }
    classList = {
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
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    closest(): Node | null {
      return this.hidden ? this : (this.parentElement?.closest() ?? null);
    }
    insertBefore(node: Node, before: Node | null) {
      node.remove();
      node.parentElement = this;
      node.isConnected = this.isConnected;
      this.children.splice(
        before === null ? this.children.length : this.children.indexOf(before),
        0,
        node,
      );
    }
    querySelector(selector: string): Node | null {
      const action = /data-action="([^"]+)"/.exec(selector)?.[1];
      for (const child of this.children) {
        if (action !== undefined && child.dataset.action === action) {
          return child;
        }
        const found = child.querySelector(selector);
        if (found) {
          return found;
        }
      }
      return null;
    }
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    textContent = "";
    attributes: Record<string, string> = {};
    style: Record<string, string> = {};
    focus = vi.fn();
    remove = vi.fn(() => {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      }
      this.parentElement = null;
      this.isConnected = false;
    });
    append(...nodes: Node[]) {
      for (const node of nodes) {
        this.insertBefore(node, null);
      }
    }
    replaceChildren(...nodes: Node[]) {
      for (const child of [...this.children]) {
        child.remove();
      }
      this.append(...nodes);
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
  createCard: () => {
    fixture.card.card.replaceChildren(fixture.card.title, fixture.card.body);
    fixture.card.frame.replaceChildren(fixture.card.card, fixture.card.close);
    return fixture.card;
  },
  isTap: () => true,
  setFooterAction: (action: string, row: { dataset: Record<string, string> }) => {
    row.dataset.footerAction = action;
  },
}));
vi.mock("./buttonPresentation.ts", () => ({
  presentAdaButton: (button: InstanceType<typeof fixture.Node>) => ({
    dispose() {},
    element: button,
    reason: new fixture.Node(),
    update() {},
  }),
}));
vi.mock("./layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
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
  expect(actions!.dataset.footerAction).toBe("close");
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

it("shows shield identity in the header and formatted HP below while preserving resource reuse", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const detail = createResourceCard(new fixture.Node() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  const icon = new fixture.Node();
  const origin = new fixture.Node();
  detail.open("Shield [2]", "Approved recharge copy", origin as unknown as HTMLElement, {
    icon: icon as unknown as HTMLElement,
    quantity: "8 / 15 HP",
  });
  expect(fixture.card.title.children[0]).toBe(icon);
  const quantity = fixture.card.body.children[1]!;
  expect(quantity.hidden).toBe(false);
  expect(quantity.children.at(-1)!.textContent).toBe("8 / 15 HP");
  detail.close();
  detail.open("Ore", "Resource copy", origin as unknown as HTMLElement, { count: 9 });
  expect(quantity.children.at(-1)!.textContent).toBe("9");
  detail.dispose();
});

it("retains footer nodes, resolves the current Quests closure and unregisters disposed actions", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const first = vi.fn(),
    second = vi.fn(),
    onOpenChange = vi.fn();
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  detail.open("Toolkit", "First", origin as unknown as HTMLElement, {
    quests: { label: "Quests", onOpen: first },
  });
  const footer = fixture.card.body.children[2]!;
  const [quests, dismiss] = footer.children;
  const captured = resolveAdaHoldAction(root as unknown as HTMLElement, quests!);
  expect(captured?.available()).toBe(true);
  detail.open("Toolkit", "Second", origin as unknown as HTMLElement, {
    quests: { label: "Current quests", onOpen: second },
  });
  expect(footer.children).toEqual([quests, dismiss]);
  captured?.activate();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
  expect(onOpenChange.mock.calls).toEqual([[true], [true], [false]]);
  detail.open("Ore", "No quests", origin as unknown as HTMLElement);
  expect(quests!.hidden).toBe(true);
  expect(captured?.available()).toBe(false);
  captured?.activate();
  expect(second).toHaveBeenCalledOnce();
  const dismissal = resolveAdaHoldAction(root as unknown as HTMLElement, dismiss!);
  expect(dismissal?.available()).toBe(true);
  detail.dispose();
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, dismiss!)).toBeNull();
  dismissal?.activate();
  dismiss!.dispatchEvent(new Event("click"));
  expect(onOpenChange.mock.calls).toEqual([[true], [true], [false], [true]]);
});

it("registers one native header click and closes once through the shared default hold", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const listen = vi.spyOn(fixture.card.close, "addEventListener");
  const remove = vi.spyOn(fixture.card.close, "removeEventListener");
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const x = fixture.card.close;
  const action = resolveAdaHoldAction(root as unknown as HTMLElement, x);
  expect(action?.available()).toBe(false);
  detail.open("Ore", "Current", origin as unknown as HTMLElement);
  expect(action?.available()).toBe(true);
  const clickRegistrations = listen.mock.calls.filter(([type]) => type === "click");
  expect(clickRegistrations).toHaveLength(1);
  action?.activate();
  x.dispatchEvent(new Event("click"));
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  detail.dispose();
  expect(remove).toHaveBeenCalledWith("click", clickRegistrations[0]![1]);
  listen.mockRestore();
  remove.mockRestore();
});

it("rejects background header clicks and removes the registered X callback on disposal", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  detail.open("Shield", "Current", origin as unknown as HTMLElement, { quantity: "12 / 20" });
  const x = fixture.card.close;
  const action = resolveAdaHoldAction(root as unknown as HTMLElement, x);
  const front = new fixture.Node();
  root.append(front);
  const leave = enterPressView(root as unknown as HTMLElement, front as unknown as HTMLElement);
  expect(action?.available()).toBe(false);
  x.dispatchEvent(new Event("click"));
  action?.activate();
  expect(onOpenChange.mock.calls).toEqual([[true]]);
  leave();
  expect(action?.available()).toBe(true);
  detail.dispose();
  expect(resolveAdaHoldAction(root as unknown as HTMLElement, x)).toBeNull();
  x.dispatchEvent(new Event("click"));
  action?.activate();
  expect(onOpenChange.mock.calls).toEqual([[true]]);
});

it("reports Resource scope and excludes a registered background action", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node(),
    background = new fixture.Node(),
    origin = new fixture.Node();
  root.append(background);
  const host = root as unknown as HTMLElement;
  const guard = rootPressGuard(host),
    beforeOpen = guard.gate.capture(),
    run = vi.fn();
  const binding = bindAdaAction(
    {
      click: { availability: () => ({ kind: "available" }), run },
      current: () => inCurrentView(host, background as unknown as HTMLElement),
      slopPx: () => SCROLL.dragThreshold,
    },
    background as unknown as HTMLElement,
  );
  const action = resolveAdaHoldAction(host, background);
  expect(action?.available()).toBe(true);
  const detail = createResourceCard(host, { closeLabel: "Close", onOpenChange: vi.fn() });
  try {
    detail.open("Ore", "Current", origin as unknown as HTMLElement, {
      count: 0,
      quests: { label: "Quests", onOpen: vi.fn() },
    });
    expect(inCurrentView(host, background as unknown as HTMLElement)).toBe(false);
    expect(beforeOpen()).toBe(false);
    expect(currentView(host) === (fixture.card.frame as unknown as HTMLElement)).toBe(true);
    expect(guard.gate.accepts()).toBe(true);
    expect(action?.available()).toBe(false);
    action?.activate();
    expect(run).not.toHaveBeenCalled();
    const footer = fixture.card.body.children[2]!;
    for (const node of [fixture.card.close, ...footer.children]) {
      expect(inCurrentView(host, node as unknown as HTMLElement)).toBe(true);
      expect(resolveAdaHoldAction(host, node)?.available()).toBe(true);
    }
  } finally {
    detail.dispose();
    binding.dispose();
  }
});

it("releases Resource scope before parent restore and invalidates close/reopen/dispose captures", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node(),
    parent = new fixture.Node(),
    origin = new fixture.Node();
  root.append(parent);
  parent.append(origin);
  const host = root as unknown as HTMLElement;
  const guard = rootPressGuard(host);
  let leaveParent: (() => void) | undefined = enterPressView(
    host,
    parent as unknown as HTMLElement,
  );
  const releaseParent = () => {
    leaveParent?.();
    leaveParent = undefined;
  };
  const parentPress = guard.gate.capture();
  releaseParent();
  expect(parentPress()).toBe(false);
  const afterParentDismissal = guard.gate.capture(),
    transitions: boolean[] = [];
  const detail = createResourceCard(host, {
    closeLabel: "Close",
    onOpenChange(open) {
      transitions.push(open);
      if (!open) {
        expect(currentView(host) === host).toBe(true);
        leaveParent = enterPressView(host, parent as unknown as HTMLElement);
      }
    },
  });
  try {
    detail.open("Ore", "Current", origin as unknown as HTMLElement);
    expect(afterParentDismissal()).toBe(false);
    const resourcePress = guard.gate.capture();
    const dismiss = fixture.card.body.children[2]!.children[1]!;
    resolveAdaHoldAction(host, dismiss)?.activate();
    expect(resourcePress()).toBe(false);
    expect(transitions).toEqual([true, false]);
    expect(currentView(host) === (parent as unknown as HTMLElement)).toBe(true);
    expect(origin.focus).toHaveBeenCalledOnce();
    releaseParent();
    const beforeReopen = guard.gate.capture();
    detail.open("Shield", "Current", origin as unknown as HTMLElement, { quantity: "12 / 20" });
    expect(beforeReopen()).toBe(false);
    const beforeDispose = guard.gate.capture();
    detail.dispose();
    expect(beforeDispose()).toBe(false);
    expect(currentView(host) === host).toBe(true);
    expect(transitions).toEqual([true, false, true]);
    expect(origin.focus).toHaveBeenCalledOnce();
  } finally {
    detail.dispose();
    releaseParent();
  }
});

it("releases only its own Resource scope after Quests has opened a child", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node(),
    child = new fixture.Node(),
    origin = new fixture.Node();
  root.append(child);
  const host = root as unknown as HTMLElement,
    guard = rootPressGuard(host);
  const transitions: string[] = [];
  let leaveChild: (() => void) | undefined;
  const detail = createResourceCard(host, {
    closeLabel: "Close",
    onOpenChange: (open) => transitions.push(open ? "resource-open" : "resource-close"),
  });
  try {
    detail.open("Toolkit", "Current", origin as unknown as HTMLElement, {
      quests: {
        label: "Quests",
        onOpen: () => {
          transitions.push("child-open");
          leaveChild = enterPressView(host, child as unknown as HTMLElement);
        },
      },
    });
    const resourcePress = guard.gate.capture();
    resolveAdaHoldAction(host, fixture.card.body.children[2]!.children[0]!)?.activate();
    expect(resourcePress()).toBe(false);
    expect(transitions).toEqual(["resource-open", "child-open", "resource-close"]);
    expect(currentView(host) === (child as unknown as HTMLElement)).toBe(true);
    expect(guard.gate.accepts()).toBe(true);
    expect(origin.focus).not.toHaveBeenCalled();
    const childPress = guard.gate.capture();
    detail.dispose();
    expect(childPress()).toBe(true);
    expect(currentView(host) === (child as unknown as HTMLElement)).toBe(true);
  } finally {
    detail.dispose();
    leaveChild?.();
  }
});
