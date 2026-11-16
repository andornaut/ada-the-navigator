import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import {
  type AdaButtonProps,
  type AdaCardProps,
  type AdaLayoutSchema,
  createAdaLayoutPorts,
  mountAdaLayout,
} from "./layoutTree.ts";

class Element extends EventTarget {
  readonly nodeType = 1;
  nodeValue: string | null = null;
  parentElement: Element | null = null;
  connected = true;
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.connected;
  }
  set isConnected(value: boolean) {
    this.connected = value;
  }
  children: Element[] = [];
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  type = "";
  style = { alignSelf: "", minWidth: "" };
  textContent = "";
  firstChild: Element | { nodeType: number; nodeValue: string } | null = null;
  attributes = new Map<string, string>();
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }
  ownerDocument = {
    createElement: (tag: string) => new Element(tag),
    createTextNode: (nodeValue: string) => ({ nodeType: 3, nodeValue }),
    defaultView: { HTMLElement: Element, Node: Element },
    fonts: { ready: Promise.resolve() },
  };
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): Element | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parentElement?.closest() ?? null);
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parentElement) && this.contains(node.parentElement))
    );
  }
  classList = { toggle: vi.fn() };
  append(...nodes: (Element | { nodeType: number; nodeValue: string })[]) {
    for (const node of nodes) {
      if (node instanceof Element) {
        this.insertBefore(node, null);
      } else {
        this.firstChild ??= node;
      }
    }
  }
  insertBefore(node: Element, before: Element | null) {
    if (node === before) {
      return;
    }
    node.remove();
    node.parentElement = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
    this.firstChild = this.children[0] ?? null;
  }
  remove() {
    const parent = this.parentElement;
    if (parent) {
      parent.children.splice(parent.children.indexOf(this), 1);
      parent.firstChild = parent.children[0] ?? null;
    }
    this.parentElement = null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const value = part.trim();
      if (value === ":disabled") {
        return this.disabled;
      }
      if (value === "[data-action]") {
        return this.dataset.action !== undefined || this.attributes.has("data-action");
      }
      if (value.startsWith(".")) {
        return this.className.split(" ").includes(value.slice(1));
      }
      const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
      if (input) {
        return this.tag === "input" && (this.attributes.get("type") ?? this.type) === input[1];
      }
      const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
      if (role) {
        return this.attributes.get("role") === role[1];
      }
      const action = /^\[data-action=["']([^"']+)["']\]$/.exec(value);
      if (action) {
        return (this.dataset.action ?? this.attributes.get("data-action")) === action[1];
      }
      return value === this.tag;
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  click() {
    this.dispatchEvent(new Event("click", { cancelable: true }));
  }
}

const factories = vi.hoisted(() => ({ dispose: vi.fn(), fit: vi.fn(), unboundCard: false }));
vi.mock("./modal.ts", () => ({
  createActions: () => new Element(),
  createButton: (label: string) => {
    const button = new Element("button");
    button.firstChild = { nodeType: 3, nodeValue: label };
    if (label === "") {
      Object.defineProperty(button, "firstChild", { value: null, writable: true });
    }
    return button;
  },
  createCard: () => {
    const body = new Element(),
      header = new Element(),
      title = new Element(),
      close = new Element("button"),
      frame = new Element();
    header.append(title);
    if (factories.unboundCard) {
      header.append(new Element("button"));
    }
    frame.append(header, body, close);
    return { body, close, dispose: factories.dispose, fit: factories.fit, frame, header, title };
  },
  setFooterAction: (intent: string, element: Element) => {
    element.dataset.footerAction = intent;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  factories.unboundCard = false;
});

function fixture() {
  const first = vi.fn(),
    second = vi.fn(),
    dispose = vi.fn(),
    update = vi.fn();
  let state: { kind: "available" } | { kind: "unavailable"; reason: string } | { kind: "omitted" } =
    { kind: "available" };
  let button: Element;
  let reason: Element;
  const ports = createAdaLayoutPorts({
    actions: new Map([
      ["first", first],
      ["second", second],
    ]),
    availability: () => state,
    presentButton(actual) {
      button = actual as unknown as Element;
      reason = new Element();
      const root = new Element();
      fixtureActionRoot(root);
      root.append(button, reason);
      return {
        dispose,
        element: root as unknown as HTMLElement,
        reason: reason as unknown as HTMLElement,
        update,
      };
    },
  });
  return {
    button: () => button!,
    dispose,
    first,
    ports,
    reason: () => reason!,
    second,
    setState: (next: typeof state) => {
      state = next;
    },
    update,
  };
}

it("retains actual label/root identity while dispatch resolves the current action and availability", () => {
  const f = fixture();
  const initial: AdaButtonProps<string> = { actionId: "first", label: "First", role: "secondary" };
  const part = f.ports.components.button.create(initial);
  const root = part.element,
    label = f.button().firstChild!;
  f.button().click();
  expect(f.first).toHaveBeenCalledOnce();
  part.update({ actionId: "second", label: "Second", role: "primary" });
  expect(part.element).toBe(root);
  expect(f.button().firstChild).toBe(label);
  expect(label.nodeValue).toBe("Second");
  f.button().click();
  expect(f.second).toHaveBeenCalledOnce();
  f.setState({ kind: "unavailable", reason: "Requires weapon" });
  f.button().click();
  expect(f.second).toHaveBeenCalledOnce();
  expect(f.reason().textContent).toBe("Requires weapon");
  expect(f.button().disabled).toBe(false);
  expect(f.button().attributes.get("aria-disabled")).toBe("true");
  f.setState({ kind: "omitted" });
  part.update(initial);
  expect(root.hidden).toBe(true);
  f.setState({ kind: "available" });
  part.dispose();
  f.button().click();
  expect(f.first).toHaveBeenCalledOnce();
  expect(f.dispose).toHaveBeenCalledOnce();
});

it("uses the same guard for programmatic/context actions", () => {
  const f = fixture();
  f.setState({ kind: "unavailable", reason: "Busy" });
  expect(f.ports.dispatch("first")).toBe(false);
  expect(f.first).not.toHaveBeenCalled();
  f.setState({ kind: "available" });
  expect(f.ports.dispatch("first")).toBe(true);
  expect(f.first).toHaveBeenCalledOnce();
});

it("retains native title and sibling body/footer slots without fitting before descendants", () => {
  const f = fixture();
  const initial: AdaCardProps<string> = {
    closeAction: "first",
    closeLabel: "Close",
    footerAction: "close",
    size: "medium",
    title: "Menu",
  };
  const card = f.ports.components.card.create(initial);
  const slots = card.slots;
  const child = new Element();
  (slots.body as unknown as Element).append(child);
  card.update({ ...initial, closeAction: "second", footerAction: "back", title: "Detail" });
  expect(card.slots).toBe(slots);
  expect(slots.body.style.alignSelf).toBe("stretch");
  expect(slots.body.hidden).toBe(false);
  expect((slots.body as unknown as Element).children).toEqual([child]);
  expect((slots.header as unknown as Element).children[0]!.textContent).toBe("Detail");
  expect(slots.footer.dataset.footerAction).toBe("back");
  expect(factories.fit).not.toHaveBeenCalled();
  f.ports.fit();
  expect(factories.fit).toHaveBeenCalledOnce();
  const close = (card.element as unknown as Element).children[2]!;
  close.click();
  expect(f.second).toHaveBeenCalledOnce();
  card.dispose();
  f.ports.fit();
  expect(factories.fit).toHaveBeenCalledOnce();
  close.click();
  expect(f.second).toHaveBeenCalledOnce();
  expect(factories.dispose).toHaveBeenCalledOnce();
});

describe("shared production prose", () => {
  it("retains its element when authored text changes", () => {
    vi.stubGlobal("document", { createElement: () => new Element() });
    const f = fixture();
    const part = f.ports.components.text.create({ text: "First" });
    const node = part.element;
    expect(node.className).toBe("ada-prose");
    part.update({ className: "ada-card-note", text: "Second" });
    expect(part.element).toBe(node);
    expect(node.textContent).toBe("Second");
    expect(node.className).toBe("ada-prose ada-card-note");
  });
});

it("registers held activation against updated action identity and removes it with the component", () => {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "2" }));
  const f = fixture();
  const part = f.ports.components.button.create({
    actionId: "first",
    label: "First",
    role: "secondary",
  });
  const root = part.element;
  const resolve = () => resolveAdaHoldAction(root, f.button() as unknown as HTMLElement);
  expect(resolve()?.rule.slopPx).toBe(16);
  part.update({ actionId: "second", label: "Second", role: "primary" });
  resolve()?.activate();
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).toHaveBeenCalledOnce();
  f.setState({ kind: "unavailable", reason: "Needs weapon" });
  expect(resolve()?.available()).toBe(false);
  resolve()?.activate();
  expect(f.second).toHaveBeenCalledOnce();
  part.dispose();
  expect(resolve()).toBeNull();
});

it("creates and retains the native text binding for an initially empty button label", () => {
  const f = fixture();
  const part = f.ports.components.button.create({
    actionId: "first",
    label: "",
    role: "secondary",
  });
  const label = f.button().firstChild!;
  expect(label.nodeType).toBe(3);
  expect(label.nodeValue).toBe("");
  part.update({ actionId: "second", label: "Quests", role: "secondary" });
  expect(f.button().firstChild).toBe(label);
  expect(label.nodeValue).toBe("Quests");
  f.button().click();
  expect(f.second).toHaveBeenCalledOnce();
  part.dispose();
});

function cardTree(label = "First"): LayoutNode<AdaLayoutSchema<string>> {
  return {
    component: "card",
    key: "card",
    kind: "component",
    props: {
      closeAction: "first",
      closeLabel: "Close",
      footerAction: "close",
      size: "small",
      title: "Card",
    },
    slots: {
      footer: [
        {
          component: "button",
          key: "action",
          kind: "component",
          props: { actionId: "first", label, role: "primary" },
        },
      ],
    },
  };
}
function mountFixture(attached = false) {
  const f = fixture(),
    host = new Element();
  host.isConnected = attached;
  vi.stubGlobal("document", host.ownerDocument);
  if (attached) {
    fixtureActionRoot(host);
  }
  const mounted = mountAdaLayout(
    {
      actions: new Map([
        ["first", f.first],
        ["second", f.second],
      ]),
      availability: () => ({ kind: "available" }),
      presentButton: presentation,
    },
    { artReady: Promise.resolve(), host: host as unknown as HTMLElement },
    cardTree(),
  );
  function presentation(button: HTMLButtonElement) {
    const root = new Element(),
      reason = new Element();
    root.append(button as unknown as Element, reason);
    return {
      dispose: vi.fn(),
      element: root as unknown as HTMLElement,
      reason: reason as unknown as HTMLElement,
      update: f.update,
    };
  }
  return { f, host, mounted };
}
it("audits complete initial semantic components, including hidden disabled and custom native controls", () => {
  const f = fixture();
  f.update.mockImplementation(() => {
    const extra = new Element("button");
    extra.hidden = true;
    extra.disabled = true;
    f.button().parentElement!.append(extra);
  });
  expect(() =>
    f.ports.components.button.create({ actionId: "first", label: "First", role: "primary" }),
  ).toThrow("no registered action binding");
  expect(f.dispose).toHaveBeenCalledOnce();
  factories.unboundCard = true;
  expect(() =>
    f.ports.components.card.create({
      closeAction: "first",
      closeLabel: "Close",
      footerAction: "close",
      size: "small",
      title: "Card",
    }),
  ).toThrow("no registered action binding");
  expect(factories.dispose).toHaveBeenCalledOnce();
});
it.each([false, true])("audits completed layout reconciliation with attached=%s", (attached) => {
  const f = mountFixture(attached);
  expect(f.host.querySelectorAll("button")).toHaveLength(2);
  f.mounted.update(cardTree("Updated"));
  expect(f.host.querySelectorAll("button")).toHaveLength(2);
  f.mounted.dispose();
});
it("rejects an attached layout with no owning root even when its metadata is complete", () => {
  const f = fixture(),
    host = new Element();
  vi.stubGlobal("document", host.ownerDocument);
  expect(() =>
    mountAdaLayout(
      {
        actions: new Map(),
        availability: () => ({ kind: "available" }),
        presentButton: () => {
          throw Error("No button port requested");
        },
      },
      { artReady: Promise.resolve(), host: host as unknown as HTMLElement },
      { component: "text", key: "text", kind: "component", props: { text: "Text" } },
    ),
  ).toThrow("no live action root");
  expect(f.first).not.toHaveBeenCalled();
});
it("fails closed on an unbound lazy update before any asynchronous font/art settlement", async () => {
  const f = mountFixture(false);
  let finish!: () => void;
  f.host.ownerDocument.fonts.ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const pending = f.mounted.settle();
  f.f.update.mockImplementation(() => {
    const frame = f.host.children[0]!;
    const extra = new Element("button");
    extra.hidden = true;
    extra.disabled = true;
    frame.append(extra);
  });
  expect(() => f.mounted.update(cardTree("Lazy"))).toThrow("no registered action binding");
  finish();
  await pending;
  expect(factories.fit).not.toHaveBeenCalled();
  expect(() => f.mounted.dispatch("first")).toThrow("disposed");
});
it("structurally audits custom native host controls without evaluating runtime policy", () => {
  const host = new Element(),
    custom = new Element("button");
  const policy = vi.fn(() => {
    throw Error("Runtime policy must not run");
  });
  const release = registerAdaActionRoot({ permits: policy }, host as unknown as HTMLElement);
  custom.hidden = true;
  custom.disabled = true;
  host.append(custom);
  const availability = vi.fn(() => {
    throw Error("Runtime availability must not run");
  });
  const action = bindAdaAction(
    { click: { availability, run: vi.fn() }, current: () => true, slopPx: () => 8 },
    custom as unknown as HTMLElement,
  );
  vi.stubGlobal("document", host.ownerDocument);
  const mounted = mountAdaLayout(
    {
      actions: new Map(),
      availability,
      presentButton: () => {
        throw Error("No button port requested");
      },
    },
    { artReady: Promise.resolve(), host: host as unknown as HTMLElement },
    { component: "text", key: "text", kind: "component", props: { text: "Text" } },
  );
  mounted.update({ component: "text", key: "text", kind: "component", props: { text: "Updated" } });
  expect(policy).not.toHaveBeenCalled();
  expect(availability).not.toHaveBeenCalled();
  mounted.dispose();
  action.dispose();
  release();
});
