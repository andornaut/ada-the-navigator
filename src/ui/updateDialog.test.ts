import { ObsoleteUpdateOfferError } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { afterEach, expect, it, vi } from "vitest";

import { createUpdateOffer, type UpdateOffer } from "../pwa/updateOffer.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { rootPressGuard } from "./pressScope.ts";
import { createUpdateDialog } from "./updateDialog.ts";
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
      return this.hidden ? this : (this.parentElement?.closest() ?? null);
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
    clientWidth = 380;
    getBoundingClientRect() {
      return { height: 48, width: this.textContent === "Cancel" ? 70 : 105 };
    }
    getClientRects() {
      return [this.getBoundingClientRect()];
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
      display: "",
      getPropertyValue: () => "",
      removeProperty: vi.fn(),
      setProperty: vi.fn(),
    };
    focus = vi.fn();
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
    toggleAttribute(name: string, force?: boolean) {
      const enabled = force ?? (name === "hidden" ? !this.hidden : !(name in this.attributes));
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
  return { Node, card, disposed: vi.fn(), left: vi.fn(), opened: vi.fn() };
});
vi.mock("./modal.ts", async (original) => ({
  ...(await original<typeof import("./modal.ts")>()),
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
  isTap: (_unit: number, a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= 8,
  setFooterAction: (action: string, row: { dataset: Record<string, string> }) => {
    row.dataset.footerAction = action;
  },
}));
vi.mock("./layout/viewScale.ts", async (original) => ({
  ...(await original<typeof import("./layout/viewScale.ts")>()),
  readViewUnit: () => 1,
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
const rootReleases: (() => void)[] = [];
afterEach(() => {
  for (const stop of rootReleases.splice(0).reverse()) {
    stop();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
  fixture.card.body.clientWidth = 380;
  fixture.card.title.children = [];
});

vi.mock("./settings.ts", () => ({ FONT_ROLES: { heading: "heading" } }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: () => ({
    back: vi.fn(),
    dispose: fixture.disposed,
    open: (options: { close(): void; focus: HTMLElement }, dialog: HTMLElement) => {
      fixture.opened(options, dialog);
      options.focus.focus();
      return fixture.left;
    },
  }),
}));
const labels = {
  accept: "Update now",
  cancel: "Cancel",
  close: "Close",
  title: "Update available",
};
function setup(initial = false, liveOffer?: UpdateOffer, applicationScope = false) {
  const root = new fixture.Node();
  const app = applicationScope ? new fixture.Node() : root;
  const doc = Object.assign(new EventTarget(), {
    activeElement: null as unknown,
    body: new fixture.Node(),
    createElement: (tag: string) =>
      Object.assign(new fixture.Node(), { tagName: tag.toUpperCase() }),
    defaultView: Object.assign(new EventTarget(), {
      HTMLElement: fixture.Node,
      Node: fixture.Node,
      clearTimeout,
      getComputedStyle: (node: InstanceType<typeof fixture.Node>) => {
        const { height, width } = node.getBoundingClientRect();
        return {
          boxSizing: "border-box",
          getPropertyValue: () => "",
          height: `${height}px`,
          width: `${width}px`,
        };
      },
      performance,
      setTimeout,
    }),
    elementFromPoint: (): InstanceType<typeof fixture.Node> | null => doc.hitTarget,
    hitTarget: null as InstanceType<typeof fixture.Node> | null,
  });
  vi.stubGlobal("document", doc);
  doc.body.append(app);
  if (applicationScope) {
    app.append(root);
  }
  for (const node of applicationScope ? [app, root] : [root]) {
    const host = node as unknown as HTMLElement;
    rootReleases.push(
      bindAdaActionRoot(
        {
          guard: rootPressGuard(host),
          pointerRelease: { resolvePointer: () => undefined },
          requiredReady: () => true,
          subscribeRequired: () => () => {},
        },
        host,
      ).dispose,
    );
  }
  const guard = rootPressGuard(root as unknown as HTMLElement);
  let notify: (visible: boolean) => void = vi.fn();
  const stop = vi.fn();
  const offer = {
    accept: vi.fn(),
    defer: vi.fn(),
    subscribe: (listener: (visible: boolean) => void) => {
      notify = listener;
      listener(initial);
      return stop;
    },
  };
  const restore = vi.fn();
  const changed = vi.fn();
  const dialog = createUpdateDialog(
    root as unknown as HTMLElement,
    app as unknown as HTMLElement,
    labels,
    liveOffer ?? offer,
    restore,
    changed,
  );
  const button = (id: string) => root.querySelector(`[data-action="${id}-update"]`)!;
  return {
    app,
    button,
    changed,
    dialog,
    doc,
    guard,
    notify: (v: boolean) => notify(v),
    offer,
    restore,
    root,
    stop,
  };
}
it("constructs typed Cancel/Update now with synchronous offer notification and preserves transition timing", () => {
  const f = setup(true);
  expect(f.dialog.isOpen()).toBe(true);
  expect(fixture.card.fit).toHaveBeenCalledOnce();
  expect(f.button("accept").textContent).toBe(labels.accept);
  expect(f.button("cancel").textContent).toBe(labels.cancel);
  expect(f.button("accept").matches(".ui-standard-button")).toBe(true);
  expect(f.button("cancel").matches(".ui-standard-button")).toBe(true);
  expect(fixture.opened).toHaveBeenCalledWith(
    expect.objectContaining({ focus: f.button("accept"), live: [fixture.card.close] }),
    fixture.card.card,
  );
  expect(f.changed.mock.calls).toEqual([[true]]);
  f.notify(true);
  expect(fixture.opened).toHaveBeenCalledOnce();
  f.doc.activeElement = f.button("accept");
  f.notify(false);
  expect(fixture.left).toHaveBeenCalledOnce();
  expect(f.restore).toHaveBeenCalledOnce();
  expect(f.changed.mock.calls).toEqual([[true], [false]]);
  f.notify(true);
  f.doc.activeElement = null;
  f.notify(false);
  expect(f.restore).toHaveBeenCalledOnce();
  f.dialog.dispose();
});
it("keeps row faces at their own widths and equalizes only the stack without replacing actions", () => {
  const f = setup(true);
  const group = f.root.querySelector(".ui-action-group")!;
  const cancel = f.button("cancel");
  const accept = f.button("accept");
  const secondary = cancel.parentElement!;
  const primary = accept.parentElement!;
  expect(group.getAttribute("data-ui-action-axis")).toBe("row");
  expect(group.getAttribute("data-ui-action-variant")).toBe("footer");
  expect(secondary.style.setProperty).toHaveBeenCalledWith("--ui-action-width", "70");
  expect(primary.style.setProperty).toHaveBeenCalledWith("--ui-action-x", "86");
  expect(primary.style.setProperty).toHaveBeenCalledWith("--ui-action-width", "105");

  fixture.card.body.clientWidth = 135;
  f.doc.defaultView.dispatchEvent(new Event("resize"));
  expect(group.getAttribute("data-ui-action-axis")).toBe("stack");
  expect(secondary.style.setProperty).toHaveBeenCalledWith("--ui-action-x", "15");
  expect(secondary.style.setProperty).toHaveBeenCalledWith("--ui-action-width", "105");
  expect(primary.style.setProperty).toHaveBeenCalledWith("--ui-action-y", "56");
  expect(f.button("cancel")).toBe(cancel);
  expect(f.button("accept")).toBe(accept);
  f.dialog.dispose();
});

it("only Update now accepts; all defer routes retain visibility until notification", () => {
  const f = setup(true);
  f.button("accept").dispatchEvent(new Event("click"));
  expect(f.offer.accept).toHaveBeenCalledOnce();
  expect(f.dialog.isOpen()).toBe(true);
  f.button("cancel").dispatchEvent(new Event("click"));
  fixture.card.close.dispatchEvent(new Event("click"));
  fixture.opened.mock.calls[0]![0].close();
  f.dialog.defer();
  expect(f.offer.defer).toHaveBeenCalledTimes(4);
  expect(f.offer.accept).toHaveBeenCalledOnce();
  f.notify(false);
  f.button("accept").dispatchEvent(new Event("click"));
  expect(f.offer.accept).toHaveBeenCalledOnce();
  f.dialog.dispose();
});
it.each([
  ["shown", false],
  ["older", true],
])(
  "keeps or dismisses the visible dialog after an obsolete %s version",
  async (version, remains) => {
    const switching = vi.fn();
    const offer = createUpdateOffer({ save: vi.fn(), switching });
    const f = setup(false, offer);
    let reject!: (reason: unknown) => void;
    const pending = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    const update = { dismiss: vi.fn(), updateNow: vi.fn(() => pending), version: "shown" };
    offer.offer(update);
    f.doc.activeElement = f.button("accept");
    f.button("accept").dispatchEvent(new Event("click"));
    expect(f.dialog.isOpen()).toBe(true);
    expect(f.restore).not.toHaveBeenCalled();
    reject(new ObsoleteUpdateOfferError(version));
    await vi.waitFor(() => expect(switching.mock.calls).toEqual([[true], [false]]));
    expect(f.dialog.isOpen()).toBe(remains);
    expect(f.restore).toHaveBeenCalledTimes(remains ? 0 : 1);
    expect(update.dismiss).toHaveBeenCalledTimes(remains ? 0 : 1);
    f.dialog.dispose();
  },
);
it("invalidates previous captures and registers both native header and typed footer in the current scope", () => {
  const f = setup();
  const captured = f.guard.gate!.capture();
  f.notify(true);
  expect(captured()).toBe(false);
  for (const button of [fixture.card.close, f.button("cancel"), f.button("accept")]) {
    const action = resolveAdaHoldAction(f.root as unknown as HTMLElement, button);
    expect(action?.available()).toBe(true);
    action!.activate();
  }
  expect(f.offer.accept).toHaveBeenCalledOnce();
  expect(f.offer.defer).toHaveBeenCalledTimes(2);
  const held = resolveAdaHoldAction(f.root as unknown as HTMLElement, f.button("accept"))!;
  f.notify(false);
  expect(held.available()).toBe(false);
  f.notify(true);
  f.dialog.dispose();
  f.dialog.dispose();
  held.activate();
  expect(f.offer.accept).toHaveBeenCalledOnce();
  expect(f.stop).toHaveBeenCalledOnce();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
  expect(f.restore).not.toHaveBeenCalled();
  f.notify(true);
  expect(f.changed.mock.calls).toEqual([[true], [false], [true]]);
});
it("requires an outside pointer origin and a tap, refusing inside-origin releases and drags", () => {
  const f = setup(true);
  const modal = f.root.children[0]!;
  const event = (type: string, x: number) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(
      e,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: x,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 1,
          target: modal,
        }).map(([key, value]) => [key, { value }]),
      ),
    );
    f.doc.hitTarget = modal;
    if (type === "pointerdown") {
      f.doc.dispatchEvent(e);
      f.root.dispatchEvent(e);
    } else if (type === "click") {
      f.root.dispatchEvent(e);
      if (!e.defaultPrevented) {
        modal.dispatchEvent(e);
      }
    } else {
      f.doc.dispatchEvent(e);
    }
  };
  event("click", 0);
  expect(f.offer.defer).not.toHaveBeenCalled();
  event("pointerdown", 0);
  event("pointerup", 30);
  event("click", 30);
  expect(f.offer.defer).not.toHaveBeenCalled();
  event("pointerdown", 0);
  event("pointerup", 2);
  event("click", 2);
  expect(f.offer.defer).toHaveBeenCalledOnce();
  event("click", 2);
  expect(f.offer.defer).toHaveBeenCalledOnce();
  f.dialog.dispose();
  event("pointerdown", 0);
  event("pointerup", 0);
  event("click", 0);
  expect(f.offer.defer).toHaveBeenCalledOnce();
});

it("owns the whole Update offer in the application action scope", () => {
  const f = setup(true, undefined, true);
  const app = f.app as unknown as HTMLElement;
  const controls = f.root as unknown as HTMLElement;
  const backdrop = f.root.children[0]!;
  for (const target of [f.button("accept"), f.button("cancel"), fixture.card.close, backdrop]) {
    expect(resolveAdaHoldAction(controls, target)).toBeNull();
    expect(resolveAdaHoldAction(app, target)?.available()).toBe(true);
  }
  const close = fixture.card.close;
  const held = resolveAdaHoldAction(app, close)!;
  expect(close.matches(".ui-standard-button")).toBe(true);
  expect(close.getAttribute("aria-label")).toBe(labels.close);
  close.dispatchEvent(new Event("click", { cancelable: true }));
  expect(f.offer.defer).toHaveBeenCalledOnce();
  held.activate();
  expect(f.offer.defer).toHaveBeenCalledTimes(2);
  expect(f.offer.accept).not.toHaveBeenCalled();
  f.dialog.dispose();
  expect(resolveAdaHoldAction(app, backdrop)).toBeNull();
  expect(resolveAdaHoldAction(app, close)).toBeNull();
  held.activate();
  close.dispatchEvent(new Event("click", { cancelable: true }));
  expect(f.offer.defer).toHaveBeenCalledTimes(2);
});

it("checks completed offer reconciliation before exposing unbound controls", () => {
  const f = setup();
  const modal = f.root.children[0]!;
  const rogue = Object.assign(new fixture.Node(), {
    disabled: true,
    hidden: true,
    tagName: "BUTTON",
    type: "button",
  });
  modal.append(rogue);
  try {
    expect(() => f.notify(true)).toThrow("no registered action binding");
    expect(modal.hidden).toBe(true);
    expect(fixture.opened).not.toHaveBeenCalled();
    expect(f.changed).not.toHaveBeenCalled();
  } finally {
    rogue.remove();
    f.dialog.dispose();
  }
});

it("requires live connected ownership before an offer opens", () => {
  const f = setup();
  f.root.remove();
  expect(f.root.isConnected).toBe(false);
  try {
    expect(() => f.notify(true)).toThrow("no live action root");
    expect(fixture.opened).not.toHaveBeenCalled();
    expect(f.changed).not.toHaveBeenCalled();
  } finally {
    f.dialog.dispose();
  }
});
