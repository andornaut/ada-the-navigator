import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { enterPressView, rootPressGuard } from "./pressScope.ts";
import { createRestartCard } from "./restartCard.ts";

let doc: {
  activeElement: Element | null;
  createElement: () => Element;
  defaultView: { HTMLElement: typeof Element; Node: typeof Element };
  fonts: { ready: Promise<void> };
};
class Element extends EventTarget {
  nodeType = 1;
  parentElement: Element | null = null;
  children: Element[] = [];
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  isConnected = true;
  firstChild = { nodeType: 3, nodeValue: "" };
  style = { alignSelf: "", minWidth: "", setProperty() {} };
  attributes = new Map<string, string>();
  textContent = "";
  get ownerDocument() {
    return doc;
  }
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): Element | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  classList = {
    remove: (name: string) => this.classList.toggle(name, false),
    toggle: (name: string, force?: boolean) => {
      const classes = new Set(this.className.split(" ").filter(Boolean));
      const on = force ?? !classes.has(name);
      if (on) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      this.className = [...classes].join(" ");
      return on;
    },
  };
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  insertBefore(node: Element, before: Element | null) {
    node.remove();
    node.parentElement = this;
    node.isConnected = this.isConnected;
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index, 0, node);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    }
    this.parentElement = null;
    this.isConnected = false;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parentElement?.closest() ?? null);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  querySelector(selector: string): Element | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string): Element[] {
    const matches = (node: Element) =>
      selector === "img"
        ? false
        : selector.startsWith(".")
          ? node.className.split(" ").includes(selector.slice(1))
          : selector.startsWith("[role=")
            ? node.attributes.get("role") === "dialog"
            : node.dataset.action === /data-action="([^"]+)"/.exec(selector)?.[1];
    return this.children.flatMap((child) => [
      ...(matches(child) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  click() {
    this.dispatchEvent(new Event("click", { cancelable: true }));
  }
  focus() {
    doc.activeElement = this;
  }
}

const native = vi.hoisted(() => ({ dispose: vi.fn(), fit: vi.fn(), tap: vi.fn() }));
vi.mock("./modal.ts", () => ({
  createActions: () => new Element(),
  createButton: (label: string) => {
    const button = new Element();
    button.firstChild.nodeValue = label;
    return button;
  },
  createCard: () => {
    const frame = new Element(),
      card = new Element(),
      body = new Element(),
      header = new Element(),
      title = new Element(),
      close = new Element();
    frame.setAttribute("role", "dialog");
    card.className = "ada-card";
    body.className = "ada-card-body";
    close.className = "ada-close";
    header.append(title);
    card.append(header, body);
    frame.append(card, close);
    return { body, card, close, dispose: native.dispose, fit: native.fit, frame, header, title };
  },
  isTap: native.tap,
  setFooterAction: (intent: string, root: Element) => {
    root.dataset.footerAction = intent;
  },
}));
vi.mock("./buttonPresentation.ts", () => ({
  applyAdaControlTheme: () => {},
  presentAdaButton: (button: Element) => {
    const root = new Element(),
      reason = new Element();
    root.append(button, reason);
    return {
      dispose() {
        root.remove();
      },
      element: root,
      reason,
      update() {},
    };
  },
}));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({
  focusTarget: (element: Element) => element.focus(),
}));

beforeEach(() => {
  native.tap.mockReturnValue(true);
  doc = {
    activeElement: null,
    createElement: () => new Element(),
    defaultView: { HTMLElement: Element, Node: Element },
    fonts: { ready: Promise.resolve() },
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function fixture() {
  const root = new Element(),
    onRestart = vi.fn();
  const guard = rootPressGuard(root as unknown as HTMLElement);
  const card = createRestartCard(root as unknown as HTMLElement, {
    labels: { cancel: "Cancel", close: "Close", restart: "Restart", title: "Restart?" },
    onRestart,
  });
  const modal = root.children[0]!;
  const action = (name: string) => modal.querySelector(`[data-action="${name}"]`)!;
  return { action, card, guard, modal, onRestart, root };
}

describe("Restart's configured production binding", () => {
  it("retains the native dialog, hidden empty body, keyed controls and Cancel focus across reopen", async () => {
    const f = fixture(),
      cancel = f.action("restart-cancel"),
      frame = f.modal.querySelector('[role="dialog"]')!;
    expect(f.modal.hidden).toBe(true);
    expect(f.modal.querySelector(".ada-card")?.dataset.dialog).toBe("restart");
    const body = f.modal.querySelector(".ada-card-body")!;
    expect(body.children[0]!.hidden).toBe(true);
    f.card.open();
    expect(doc.activeElement).toBe(cancel);
    expect(native.fit).toHaveBeenCalledOnce();
    await f.card.settle();
    cancel.click();
    expect(f.card.isOpen()).toBe(false);
    expect(f.onRestart).not.toHaveBeenCalled();
    f.card.open();
    expect(f.action("restart-cancel")).toBe(cancel);
    expect(f.modal.querySelector('[role="dialog"]')).toBe(frame);
    expect(doc.activeElement).toBe(cancel);
    f.card.dispose();
  });

  it("holds the original Restart action once and refuses hidden or covered controls", () => {
    const f = fixture();
    f.card.open();
    const button = f.action("restart-confirm");
    const resolve = () =>
      resolveAdaHoldAction(f.root as unknown as HTMLElement, button as unknown as HTMLElement);
    const other = new Element();
    f.root.append(other);
    const leave = enterPressView(f.root as unknown as HTMLElement, other as unknown as HTMLElement);
    expect(resolve()?.available()).toBe(false);
    resolve()?.activate();
    expect(f.onRestart).not.toHaveBeenCalled();
    leave();
    expect(resolve()?.available()).toBe(true);
    resolve()?.activate();
    expect(f.card.isOpen()).toBe(false);
    expect(f.onRestart).toHaveBeenCalledOnce();
    button.click();
    resolve()?.activate();
    expect(f.onRestart).toHaveBeenCalledOnce();
    f.card.dispose();
    expect(resolve()).toBeNull();
  });

  it("invalidates captured gestures on open, Close and imperative Back without restarting", () => {
    const f = fixture(),
      before = f.guard.gate.capture();
    f.card.open();
    expect(before()).toBe(false);
    const whileOpen = f.guard.gate.capture();
    f.modal.querySelector(".ada-close")!.click();
    expect(whileOpen()).toBe(false);
    expect(f.card.isOpen()).toBe(false);
    f.card.open();
    const reopened = f.guard.gate.capture();
    f.card.close();
    expect(reopened()).toBe(false);
    expect(f.onRestart).not.toHaveBeenCalled();
    f.card.dispose();
    f.card.open();
    expect(f.card.isOpen()).toBe(false);
    expect(f.root.className).not.toContain("ada-restart-open");
  });

  it("delegates outside dismissal to the native tap guard without restarting", () => {
    const f = fixture();
    f.card.open();
    native.tap.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const event = (type: string, x: number) =>
      Object.assign(new Event(type), { clientX: x, clientY: 0 });
    f.modal.dispatchEvent(event("pointerdown", 0));
    f.modal.dispatchEvent(event("click", 30));
    expect(f.card.isOpen()).toBe(true);
    f.modal.dispatchEvent(event("pointerdown", 0));
    f.modal.dispatchEvent(event("click", 1));
    expect(f.card.isOpen()).toBe(false);
    expect(native.tap).toHaveBeenNthCalledWith(1, 1, { x: 0, y: 0 }, { x: 30, y: 0 });
    expect(native.tap).toHaveBeenNthCalledWith(2, 1, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(f.onRestart).not.toHaveBeenCalled();
    f.card.dispose();
    expect(native.dispose).toHaveBeenCalledOnce();
  });
});
