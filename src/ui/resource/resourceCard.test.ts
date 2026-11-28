import { afterEach, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "../actionBinding.ts";
import { registerAdaActionRoot } from "../actionRegistry.ts";
import { fixtureActionRoot } from "../actionRootFixture.ts";
import { SCROLL } from "../layout/contentCard.ts";
import { currentView, enterPressView, inCurrentView, rootPressGuard } from "../pressScope.ts";
import { createResourceCard } from "./resourceCard.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    tagName = "DIV";
    type = "";
    disabled = false;
    nodeType = 1;
    parentElement: Node | null = null;
    get isConnected(): boolean {
      return (
        this === (document.body as unknown as Node) || (this.parentElement?.isConnected ?? false)
      );
    }
    get ownerDocument() {
      const doc = document as unknown as {
        activeElement?: Node | null;
        addEventListener?: EventTarget["addEventListener"];
        removeEventListener?: EventTarget["removeEventListener"];
        defaultView?: object;
      };
      if (!doc.addEventListener) {
        const events = new EventTarget();
        doc.addEventListener = events.addEventListener.bind(events);
        doc.removeEventListener = events.removeEventListener.bind(events);
      }
      doc.activeElement ??= null;
      doc.defaultView ??= Object.assign(new EventTarget(), {
        Element: Node,
        HTMLElement: Node,
        MutationObserver: class {
          disconnect() {}
          observe() {}
          takeRecords() {
            return [];
          }
        },
        Node,
        getComputedStyle: () => ({}),
      });
      return document;
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
      add: (name: string) => this.classList.toggle(name, true),
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
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    closest(): Node | null {
      return this.hidden || "inert" in this.attributes
        ? this
        : (this.parentElement?.closest() ?? null);
    }
    insertBefore(node: Node, before: Node | null) {
      node.remove();
      node.parentElement = this;
      this.children.splice(
        before === null ? this.children.length : this.children.indexOf(before),
        0,
        node,
      );
    }
    querySelector(selector: string): Node | null {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    private text = "";
    get textContent(): string {
      return this.text + this.children.map((child) => child.textContent).join("");
    }
    set textContent(value: string) {
      this.replaceChildren();
      this.text = value;
    }
    attributes: Record<string, string> = {};
    style = {
      getPropertyValue: () => "",
      removeProperty: vi.fn(),
      setProperty: vi.fn(),
    };
    tabIndex = 0;
    focus = vi.fn(() => {
      (document as unknown as { activeElement: Node | null }).activeElement = this;
    });
    hasAttribute(name: string) {
      return name === "hidden" ? this.hidden : name in this.attributes;
    }
    toggleAttribute(name: string, force?: boolean) {
      const enabled = force ?? !this.hasAttribute(name);
      if (enabled) {
        this.setAttribute(name, "");
      } else {
        this.removeAttribute(name);
      }
      return enabled;
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
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
    remove = vi.fn(() => {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      }
      this.parentElement = null;
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
      this.text = "";
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
    close: Object.assign(new Node(), { tagName: "BUTTON", type: "button" }),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
    title: new Node(),
  };
  return { Node, card };
});
vi.mock("../modal.ts", async (original) => ({
  ...(await original<typeof import("../modal.ts")>()),
  createActions: (actions: { button: InstanceType<typeof fixture.Node>; role: string }[]) => {
    const row = new fixture.Node();
    row.append(...actions.map(({ button }) => button));
    return row;
  },
  createButton: (label: string, role: string) => {
    const button = Object.assign(new fixture.Node(), { tagName: "BUTTON", type: "button" });
    button.textContent = label;
    button.dataset.role = role;
    return button;
  },
  createCard: ({ close }: { close: InstanceType<typeof fixture.Node> }) => {
    fixture.card.close = close;
    fixture.card.card.replaceChildren(fixture.card.title, fixture.card.body);
    fixture.card.frame.replaceChildren(fixture.card.card, fixture.card.close);
    return fixture.card;
  },
  isTap: () => true,
  setFooterAction: (action: string, row: { dataset: Record<string, string> }) => {
    row.dataset.footerAction = action;
  },
}));
vi.mock("../layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", async (original) => ({
  ...(await original<typeof import("@andornaut/game-kit/runtime/web/ui/dom/focusModality")>()),
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  if (typeof document !== "undefined") {
    document.body?.replaceChildren();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
});

function attach(root: InstanceType<typeof fixture.Node>) {
  if (!document.body) {
    Object.assign(document, { body: Object.assign(new fixture.Node(), { tagName: "BODY" }) });
  }
  document.body.append(root as unknown as HTMLElement);
  return root;
}
function detailParts() {
  return fixture.card.body.children[0]!.children;
}

function attachedActionRoot(root = new fixture.Node()) {
  attach(root);
  fixtureActionRoot(root);
  return root;
}

it("uses the shared card and reports exactly one pause/close transition, restoring origin focus", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
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
  expect(detailParts()[0]!.textContent).toBe("Approved description");
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
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
  const origin = new fixture.Node();
  const resource = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  resource.open("Ore", "First", origin as unknown as HTMLElement);
  resource.close();
  resource.open("Stardust", "Second", origin as unknown as HTMLElement);
  const target = document.activeElement;
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    composedPath: () => [target, document, document.defaultView],
    key: "Tab",
  });
  document.defaultView!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(fixture.card.title.textContent).toBe("Stardust");
  expect(detailParts()[0]!.textContent).toBe("Second");
  resource.dispose();
});

it("shows canonical supplied content and secondary Quests before primary Close without a resume gap", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
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
  const [description, quantity, actions] = detailParts();
  expect(fixture.card.title.children[0]).toBe(icon);
  expect(quantity!.hidden).toBe(true);
  expect(description!.textContent).toBe("Canonical quest description");
  expect(fixture.card.frame.attributes["aria-label"]).toBe("Toolkit");
  expect(actions!.dataset.footerAction).toBe("close");
  const buttons = actions!.querySelectorAll("button");
  expect(
    buttons.map((button) => [
      button.textContent,
      button.getAttribute("data-ui-button-role") ?? button.dataset.role,
    ]),
  ).toEqual([
    ["Quests", "secondary"],
    ["Close", "primary"],
  ]);
  expect(buttons[0]!.matches(".ui-standard-button")).toBe(true);
  expect(buttons[1]!.matches(".ui-standard-button")).toBe(true);
  buttons[0]!.dispatchEvent(new Event("click"));
  expect(lifecycle).toEqual(["paused", "quests-open", "closed"]);
  expect(origin.focus).not.toHaveBeenCalled();
  resource.open("Ore", "Ore use", origin as unknown as HTMLElement);
  expect(quantity!.hidden).toBe(true);
  expect(quantity!.children).toEqual([]);
  expect(fixture.card.title.children).toHaveLength(1);
  expect(buttons[0]!.hidden).toBe(true);
  buttons[1]!.dispatchEvent(new Event("click"));
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(resource.isOpen()).toBe(false);
  resource.dispose();
});

it("shows current resource quantities including zero separately and updates them on reopening", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const detail = createResourceCard(attachedActionRoot() as unknown as HTMLElement, {
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
    const row = detailParts()[1]!;
    expect(row.hidden).toBe(false);
    expect(fixture.card.title.children).toHaveLength(1);
    expect(fixture.card.title.children[0]!.textContent).toBe("Ore");
    expect(row.children[0]!.className).toBe("ada-status-ore");
    expect(row.children[0]).not.toBe(icon);
    expect(row.children[1]!.textContent).toBe(expected);
    expect(row.attributes["aria-label"]).toBe(`Ore: ${expected}`);
    expect(detailParts()[0]!.textContent).toBe("Approved ore description");
    detail.close();
  }
  detail.open("Ore", "Approved ore description", origin);
  expect(detailParts()[1]!.hidden).toBe(true);
  detail.dispose();
});

it("shows shield identity in the header and formatted HP below while preserving resource reuse", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const detail = createResourceCard(attachedActionRoot() as unknown as HTMLElement, {
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
  const quantity = detailParts()[1]!;
  expect(quantity.hidden).toBe(false);
  expect(quantity.children.at(-1)!.textContent).toBe("8 / 15 HP");
  detail.close();
  detail.open("Ore", "Resource copy", origin as unknown as HTMLElement, { count: 9 });
  expect(quantity.children.at(-1)!.textContent).toBe("9");
  detail.dispose();
});

it("retains footer nodes, resolves the current Quests closure and unregisters disposed actions", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
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
  const footer = detailParts()[2]!;
  const [quests, dismiss] = footer.querySelectorAll("button");
  const captured = resolveAdaHoldAction(root as unknown as HTMLElement, quests!);
  expect(captured?.available()).toBe(true);
  detail.open("Toolkit", "Second", origin as unknown as HTMLElement, {
    quests: { label: "Current quests", onOpen: second },
  });
  expect(footer.querySelectorAll("button")).toEqual([quests, dismiss]);
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
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const listen = vi.spyOn(fixture.Node.prototype, "addEventListener");
  const remove = vi.spyOn(fixture.Node.prototype, "removeEventListener");
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const x = fixture.card.close;
  const action = resolveAdaHoldAction(root as unknown as HTMLElement, x);
  expect(action?.available()).toBe(false);
  detail.open("Ore", "Current", origin as unknown as HTMLElement);
  expect(action?.available()).toBe(true);
  const clickRegistrations = listen.mock.calls.filter(
    ([type], index) => type === "click" && listen.mock.contexts[index] === x,
  );
  expect(clickRegistrations).toEqual([["click", expect.any(Function), true]]);
  expect(x.matches(".ui-standard-button")).toBe(true);
  action?.activate();
  x.dispatchEvent(new Event("click"));
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  detail.dispose();
  expect(remove.mock.calls.filter((_, index) => remove.mock.contexts[index] === x)).toEqual(
    clickRegistrations,
  );
  listen.mockRestore();
  remove.mockRestore();
});

it("rejects background header clicks and removes the registered X callback on disposal", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node();
  attachedActionRoot(root);
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
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node(),
    background = new fixture.Node(),
    origin = new fixture.Node();
  attachedActionRoot(root);
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
    const footer = detailParts()[2]!;
    for (const node of [fixture.card.close, ...footer.querySelectorAll("button")]) {
      expect(inCurrentView(host, node as unknown as HTMLElement)).toBe(true);
      expect(resolveAdaHoldAction(host, node)?.available()).toBe(true);
    }
  } finally {
    detail.dispose();
    binding.dispose();
  }
});

it("releases Resource scope before parent restore and invalidates close/reopen/dispose captures", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node(),
    parent = new fixture.Node(),
    origin = new fixture.Node();
  attachedActionRoot(root);
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
    const dismiss = detailParts()[2]!.querySelector('[data-action="dismiss-resource"]')!;
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
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = new fixture.Node(),
    child = new fixture.Node(),
    origin = new fixture.Node();
  attachedActionRoot(root);
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
    const quests = detailParts()[2]!.querySelectorAll("button")[0]!;
    const action = resolveAdaHoldAction(host, quests);
    expect(action?.available()).toBe(true);
    action?.activate();
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

it("audits the completed dynamic tree before opening or focusing an unbound control", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = attachedActionRoot();
  const onOpenChange = vi.fn();
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const modal = root.children[0]!;
  const rogue = Object.assign(new fixture.Node(), {
    disabled: true,
    hidden: true,
    tagName: "BUTTON",
    type: "button",
  });
  modal.append(rogue);
  try {
    expect(() =>
      detail.open("Ore", "Approved description", new fixture.Node() as unknown as HTMLElement),
    ).toThrow("no registered action binding");
    expect(modal.hidden).toBe(true);
    expect(fixture.card.fit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  } finally {
    rogue.remove();
    detail.dispose();
  }
});

it("requires connected ownership at open without querying the root policy", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
  });
  const root = attach(new fixture.Node());
  const onOpenChange = vi.fn();
  const detail = createResourceCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  const origin = new fixture.Node() as unknown as HTMLElement;
  const open = () => detail.open("Ore", "Approved description", origin);
  const permits = vi.fn(() => {
    throw new Error("Audit must not query eligibility");
  });
  let release = () => {};
  try {
    expect(() => open()).toThrow("no live action root");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(fixture.card.fit).not.toHaveBeenCalled();
    release = registerAdaActionRoot({ permits }, root as unknown as HTMLElement);
    expect(() => open()).not.toThrow();
    expect(permits).not.toHaveBeenCalled();
    detail.close();
    root.remove();
    expect(root.isConnected).toBe(false);
    expect(() => open()).toThrow("no live action root");
    expect(permits).not.toHaveBeenCalled();
  } finally {
    detail.dispose();
    release();
  }
});
