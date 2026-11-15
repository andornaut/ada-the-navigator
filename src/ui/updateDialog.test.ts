import { afterEach, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { rootPressGuard } from "./pressScope.ts";
import { createUpdateDialog } from "./updateDialog.ts";
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
    style = { display: "", setProperty: vi.fn() };
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
  return { Node, card, disposed: vi.fn(), left: vi.fn(), opened: vi.fn() };
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
  isTap: (_unit: number, a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= 8,
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
function setup(initial = false) {
  const root = new fixture.Node();
  const doc = { activeElement: null as unknown, createElement: () => new fixture.Node() };
  vi.stubGlobal("document", doc);
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
    labels,
    offer,
    restore,
    changed,
  );
  const button = (id: string) => root.querySelector(`[data-action="${id}-update"]`)!;
  return {
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
    const e = new Event(type);
    Object.assign(e, { clientX: x, clientY: 0 });
    modal.dispatchEvent(e);
  };
  event("click", 0);
  expect(f.offer.defer).not.toHaveBeenCalled();
  event("pointerdown", 0);
  event("click", 30);
  expect(f.offer.defer).not.toHaveBeenCalled();
  event("pointerdown", 0);
  event("click", 2);
  expect(f.offer.defer).toHaveBeenCalledOnce();
  event("click", 2);
  expect(f.offer.defer).toHaveBeenCalledOnce();
  f.dialog.dispose();
  event("pointerdown", 0);
  event("click", 0);
  expect(f.offer.defer).toHaveBeenCalledOnce();
});
