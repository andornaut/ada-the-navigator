import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import {
  type AdaButtonProps,
  type AdaCardProps,
  type AdaLayoutSchema,
  createAdaLayoutPorts,
  mountAdaLayout,
} from "./layoutTree.ts";
import { enterPressView, rootPressGuard } from "./pressScope.ts";

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
  inert = false;
  disabled = false;
  type = "";
  readonly properties = new Map<string, string>();
  style = {
    alignSelf: "",
    getPropertyValue: (name: string) => this.properties.get(name) ?? "",
    minWidth: "",
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  };
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
    defaultView: { HTMLElement: Element, Node: Element, getComputedStyle: () => ({}) },
    fonts: { ready: Promise.resolve() },
  };
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): Element | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  closest(selector = "[hidden]"): Element | null {
    return this.hidden || (selector.includes("[inert]") && this.inert)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parentElement) && this.contains(node.parentElement))
    );
  }
  classList = {
    add: (...names: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(
        " ",
      );
    },
    toggle: (name: string, force: boolean) => {
      if (force) {
        this.classList.add(name);
      } else {
        this.className = this.className
          .split(" ")
          .filter((entry) => entry !== name)
          .join(" ");
      }
      return force;
    },
  };
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
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean) {
    if (force) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
    return force;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  click() {
    this.dispatchEvent(new Event("click", { cancelable: true }));
  }
}

const factories = vi.hoisted(() => ({
  buttonDispose: vi.fn(),
  buttonUpdate: vi.fn(),
  dispose: vi.fn(),
  fit: vi.fn(),
  unboundCard: false,
}));
vi.mock("./buttonPresentation.ts", async (original) => {
  const actual = await original<typeof import("./buttonPresentation.ts")>();
  return {
    ...actual,
    presentAdaButtonContent: (...args: Parameters<typeof actual.presentAdaButtonContent>) => {
      const presented = actual.presentAdaButtonContent(...args);
      return {
        ...presented,
        dispose() {
          presented.dispose();
          factories.buttonDispose();
        },
        update(props: AdaButtonProps<string>) {
          presented.update(props);
          factories.buttonUpdate(presented.element);
        },
      };
    },
  };
});
vi.mock("./modal.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./modal.ts")>()),
  createActions: () => new Element(),
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
    fixtureActionRoot(frame);
    return { body, close, dispose: factories.dispose, fit: factories.fit, frame, header, title };
  },
  setFooterAction: (intent: string, element: Element) => {
    element.dataset.footerAction = intent;
  },
}));

const inputReleases: (() => void)[] = [];
beforeEach(() => vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" })));
afterEach(() => {
  for (const stop of inputReleases.splice(0).reverse()) {
    stop();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  factories.buttonUpdate.mockReset();
  factories.unboundCard = false;
});

function fixture(onUnavailable?: (reason: string) => void, actualInput = false) {
  const first = vi.fn(),
    second = vi.fn();
  let state: { kind: "available" } | { kind: "unavailable"; reason: string } | { kind: "omitted" } =
    { kind: "available" };
  const root = new Element();
  if (!actualInput) {
    fixtureActionRoot(root);
  }
  const ports = createAdaLayoutPorts({
    actionRoot: root as unknown as HTMLElement,
    actions: new Map([
      ["first", first],
      ["second", second],
    ]),
    availability: () => state,
    ...(onUnavailable ? { onUnavailable } : {}),
  });
  let button: Element;
  let reason: Element;
  const mountButton = (props: AdaButtonProps<string>) => {
    const part = ports.components.button.create(props);
    root.append(part.element as unknown as Element);
    button = root.querySelectorAll("button")[0]!;
    reason = root.querySelectorAll(".ada-button-reason")[0]!;
    return part;
  };
  return {
    button: () => button,
    dispose: factories.buttonDispose,
    first,
    mountButton,
    ports,
    reason: () => reason,
    root,
    second,
    setState: (next: typeof state) => {
      state = next;
    },
    update: factories.buttonUpdate,
  };
}

it("retains actual label/root identity while dispatch resolves the current action and availability", () => {
  const f = fixture();
  const initial: AdaButtonProps<string> = { actionId: "first", label: "First", role: "secondary" };
  const part = f.mountButton(initial);
  const root = part.element,
    label = f.button().firstChild!;
  f.button().click();
  expect(f.first).toHaveBeenCalledOnce();
  part.update({ actionId: "second", label: "Second", role: "primary" });
  expect(part.element).toBe(root);
  expect(f.button().firstChild).toBe(label);
  expect((label as Element).textContent).toBe("Second");
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
  const part = f.mountButton({
    actionId: "first",
    label: "First",
    role: "secondary",
  });
  const resolve = () =>
    resolveAdaHoldAction(f.root as unknown as HTMLElement, f.button() as unknown as HTMLElement);
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

it("routes a new authored button to Kit and rejects a blank accessible name before mounting", () => {
  const f = fixture();
  const initial: AdaButtonProps<string> = { actionId: "second", label: "", role: "secondary" };
  expect(() => f.mountButton(initial)).toThrow("a nonempty accessible name");
  expect(f.root.querySelectorAll("button")).toEqual([]);
  const part = f.mountButton({ ...initial, label: "Quests" });
  const button = f.button();
  const label = button.children[0]!;
  expect(button.matches(".ui-standard-button")).toBe(true);
  expect(label.textContent).toBe("Quests");
  part.update({ ...initial, label: "Current quests" });
  expect(f.button()).toBe(button);
  expect(button.children[0]).toBe(label);
  expect(label.textContent).toBe("Current quests");
  button.click();
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
      actionRoot: host as unknown as HTMLElement,
      actions: new Map([
        ["first", f.first],
        ["second", f.second],
      ]),
      availability: () => ({ kind: "available" }),
    },
    { artReady: Promise.resolve(), host: host as unknown as HTMLElement },
    cardTree(),
  );
  return { f, host, mounted };
}
it("audits complete initial semantic components, including hidden disabled and custom native controls", () => {
  const f = fixture();
  f.update.mockImplementation((element: Element) => {
    const extra = new Element("button");
    extra.hidden = true;
    extra.disabled = true;
    element.append(extra);
  });
  expect(() => f.mountButton({ actionId: "first", label: "First", role: "primary" })).toThrow(
    "no registered action binding",
  );
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
        actionRoot: host as unknown as HTMLElement,
        actions: new Map(),
        availability: () => ({ kind: "available" }),
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
      actionRoot: host as unknown as HTMLElement,
      actions: new Map(),
      availability,
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

function semanticRefusalFixture(onUnavailable?: (reason: string) => void) {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const f = fixture(onUnavailable, true);
  f.setState({ kind: "unavailable", reason: "Need fuel" });
  const part = f.mountButton({
    actionId: "first",
    label: "First",
    role: "secondary",
  });
  const { root } = f;
  const actionRoot = root as unknown as HTMLElement;
  const document = Object.assign(new EventTarget(), root.ownerDocument, {
    defaultView: Object.assign(new EventTarget(), root.ownerDocument.defaultView, {
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      performance: { now: () => Date.now() },
      setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
    }),
    elementFromPoint: () => f.button() as unknown as HTMLElement,
    hidden: false,
  });
  for (const node of [root, part.element as unknown as Element, f.button(), f.reason()]) {
    node.ownerDocument = document;
  }
  const input = bindAdaActionRoot(
    {
      guard: rootPressGuard(actionRoot),
      pointerRelease: { resolvePointer: () => undefined },
      requiredReady: () => true,
      subscribeRequired: () => () => {},
    },
    actionRoot,
  );
  inputReleases.push(input.dispose);
  const event = (type: string, detail = 1) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(e, {
      button: { value: 0 },
      clientX: { value: 0 },
      clientY: { value: 0 },
      detail: { value: type === "click" ? detail : 0 },
      isPrimary: { value: true },
      pointerId: { value: 7 },
      target: { value: f.button() },
    });
    if (type === "pointerdown") {
      document.dispatchEvent(e);
      root.dispatchEvent(e);
    } else if (type === "click") {
      root.dispatchEvent(e);
      if (!e.defaultPrevented) {
        f.button().dispatchEvent(e);
      }
    } else {
      document.dispatchEvent(e);
    }
    return e;
  };
  return { ...f, actionRoot, document, event, input, part, root };
}

it("gives an explicit semantic unavailable callback the same current refusal on hold once before release", () => {
  const onUnavailable = vi.fn();
  const f = semanticRefusalFixture(onUnavailable);
  f.event("click", 0);
  expect(onUnavailable).toHaveBeenCalledExactlyOnceWith("Need fuel");
  expect(f.first).not.toHaveBeenCalled();
  const nativeCallbackContext = onUnavailable.mock.contexts[0];
  onUnavailable.mockClear();
  f.event("pointerdown");
  f.part.update({ actionId: "second", label: "Second", role: "primary" });
  f.setState({ kind: "unavailable", reason: "Need current supplies" });
  expect(f.reason().textContent).toBe("Need fuel");
  vi.advanceTimersByTime(530);
  expect(onUnavailable).toHaveBeenCalledExactlyOnceWith("Need current supplies");
  expect(onUnavailable.mock.contexts[0]).toBe(nativeCallbackContext);
  expect(f.reason().textContent).toBe("Need current supplies");
  expect(f.button().getAttribute("aria-description")).toBe("Need current supplies");
  expect(f.button().getAttribute("aria-disabled")).toBe("true");
  f.event("pointerup");
  expect(f.event("click").defaultPrevented).toBe(true);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).not.toHaveBeenCalled();
  f.setState({ kind: "available" });
  f.part.update({ actionId: "second", label: "Second", role: "primary" });
  f.event("pointerdown");
  vi.advanceTimersByTime(530);
  f.event("pointerup");
  f.event("click");
  expect(f.second).toHaveBeenCalledOnce();
  f.part.dispose();
});

it("does not opt unavailable semantic controls into hold when no refusal callback exists", () => {
  const f = semanticRefusalFixture();
  const action = resolveAdaHoldAction(f.actionRoot, f.button() as unknown as HTMLElement);
  expect(action?.ownAriaDisabled).toBeUndefined();
  expect(action?.available()).toBe(false);
  f.event("pointerdown");
  vi.advanceTimersByTime(530);
  f.event("pointerup");
  f.event("click");
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).not.toHaveBeenCalled();
  f.part.dispose();
});

it.each(["native disabled", "inert", "ancestor ARIA", "root ARIA", "covered", "disposed"])(
  "does not let the semantic refusal flag bypass %s for a held action",
  (kind) => {
    const onUnavailable = vi.fn();
    const f = semanticRefusalFixture(onUnavailable);
    let leave = () => {};
    if (kind === "native disabled") {
      f.button().disabled = true;
    }
    if (kind === "inert") {
      f.root.inert = true;
    }
    if (kind === "root ARIA") {
      f.root.setAttribute("aria-disabled", "true");
    }
    if (kind === "ancestor ARIA") {
      const ancestor = new Element();
      ancestor.ownerDocument = f.document;
      f.button().parentElement!.insertBefore(ancestor, f.button());
      ancestor.append(f.button());
      ancestor.setAttribute("aria-disabled", "true");
    }
    if (kind === "covered") {
      const dialog = new Element();
      dialog.ownerDocument = f.document;
      f.root.append(dialog);
      leave = enterPressView(f.actionRoot, dialog as unknown as HTMLElement);
    }
    if (kind === "disposed") {
      f.part.dispose();
    }
    f.event("pointerdown");
    vi.advanceTimersByTime(530);
    f.event("pointerup");
    expect(onUnavailable).not.toHaveBeenCalled();
    expect(f.first).not.toHaveBeenCalled();
    expect(f.second).not.toHaveBeenCalled();
    if (kind === "native disabled") {
      expect(f.button().disabled).toBe(true);
    }
    leave();
    if (kind !== "disposed") {
      f.part.dispose();
    }
  },
);

it("cancels reentrant semantic refusal ownership without repeating it after a modal returns", () => {
  const onUnavailable = vi.fn((): void => {
    const dialog = new Element();
    dialog.ownerDocument = f.document;
    f.root.append(dialog);
    const leave = enterPressView(f.actionRoot, dialog as unknown as HTMLElement);
    leave();
  });
  const f = semanticRefusalFixture(onUnavailable);
  f.event("pointerdown");
  vi.advanceTimersByTime(530);
  expect(onUnavailable).toHaveBeenCalledOnce();
  f.event("pointerup");
  expect(f.event("click").defaultPrevented).toBe(true);
  expect(onUnavailable).toHaveBeenCalledOnce();
  expect(f.first).not.toHaveBeenCalled();
  f.part.dispose();
});

it("does not add a refusal callback to a card close without an original native refusal binding", () => {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const onUnavailable = vi.fn();
  const f = fixture(onUnavailable);
  f.setState({ kind: "unavailable", reason: "Blocked" });
  const part = f.ports.components.card.create({
    closeAction: "first",
    closeLabel: "Close",
    footerAction: "close",
    size: "small",
    title: "Card",
  });
  const close = (part.element as unknown as Element).children[2]!;
  const action = resolveAdaHoldAction(part.element, close as unknown as HTMLElement);
  expect(action?.ownAriaDisabled).toBeUndefined();
  expect(action?.available()).toBe(false);
  close.click();
  expect(onUnavailable).not.toHaveBeenCalled();
  expect(f.first).not.toHaveBeenCalled();
  part.dispose();
});

it("removes a semantic refusal binding before a pending hold can invoke its caller", () => {
  const onUnavailable = vi.fn();
  const f = semanticRefusalFixture(onUnavailable);
  f.event("pointerdown");
  f.part.dispose();
  vi.advanceTimersByTime(530);
  f.event("pointerup");
  f.event("click");
  expect(onUnavailable).not.toHaveBeenCalled();
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).not.toHaveBeenCalled();
});
