import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdaHoldAction } from "./actionBinding.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { enterPressView, rootPressGuard } from "./pressScope.ts";
import { createRestartCard } from "./restartCard.ts";

let doc: EventTarget & {
  hitTarget: Element | null;
  elementFromPoint: () => Element | null;
  activeElement: Element | null;
  createElement: (tag: string) => Element;
  defaultView: EventTarget & {
    HTMLElement: typeof Element;
    Node: typeof Element;
    clearTimeout: typeof clearTimeout;
    setTimeout: typeof setTimeout;
    performance: typeof performance;
  };
  fonts: { ready: Promise<void> };
};
class Element extends EventTarget {
  readonly tagName: string;
  type = "";
  constructor(tag = "div") {
    super();
    this.tagName = tag.toUpperCase();
    if (tag === "button") {
      this.type = "button";
    }
  }
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
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
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
  matches(selector: string): boolean {
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
        return this.dataset.action !== undefined || this.attributes.has("data-action");
      }
      const input = /^input\[type=["'](button|submit|reset)["']\]$/.exec(value);
      if (input) {
        return this.tagName === "INPUT" && (this.attributes.get("type") ?? this.type) === input[1];
      }
      const role = /^\[role=["']([^"']+)["']\]$/.exec(value);
      if (role) {
        return this.attributes.get("role") === role[1];
      }
      const action = /^\[data-action=["']([^"']+)["']\]$/.exec(value);
      return (
        action !== null && (this.dataset.action ?? this.attributes.get("data-action")) === action[1]
      );
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
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

const native = vi.hoisted(() => ({
  dispose: vi.fn(),
  fit: vi.fn(),
  present: vi.fn(),
  tap: vi.fn(),
}));
vi.mock("./modal.ts", () => ({
  createActions: () => new Element(),
  createButton: (label: string) => {
    const button = new Element("button");
    button.firstChild.nodeValue = label;
    return button;
  },
  createCard: () => {
    const frame = new Element(),
      card = new Element(),
      body = new Element(),
      header = new Element(),
      title = new Element(),
      close = new Element("button");
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
      update: native.present,
    };
  },
}));
// The controls overlay's shared modal layer, recorded: the confirm must take the top over Cheats.
const published = vi.hoisted(() => ({
  dispose: vi.fn(),
  leave: vi.fn(),
  open: vi.fn(),
  roots: [] as unknown[],
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: (root: unknown) => {
    published.roots.push(root);
    return {
      back: () => false,
      dispose: published.dispose,
      open: (options: unknown, dialog: unknown) => {
        published.open(options, dialog);
        return published.leave;
      },
    };
  },
}));
const focusTarget = vi.hoisted(() => vi.fn((element: Element) => element.focus()));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({ focusTarget }));

beforeEach(() => {
  native.tap.mockReturnValue(true);
  doc = Object.assign(new EventTarget(), {
    activeElement: null,
    createElement: (tag: string) => new Element(tag),
    defaultView: Object.assign(new EventTarget(), {
      HTMLElement: Element,
      Node: Element,
      clearTimeout,
      performance,
      setTimeout,
    }),
    elementFromPoint: () => doc.hitTarget,
    fonts: { ready: Promise.resolve() },
    hitTarget: null as Element | null,
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
});
const rootReleases: (() => void)[] = [];
afterEach(() => {
  for (const stop of rootReleases.splice(0).reverse()) {
    stop();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function fixture(rewind?: (current: () => boolean) => Promise<(() => void) | null>) {
  const root = new Element(),
    onRestart = vi.fn();
  const guard = rootPressGuard(root as unknown as HTMLElement);
  rootReleases.push(
    bindAdaActionRoot(
      {
        guard,
        pointerRelease: { resolvePointer: () => undefined },
        requiredReady: () => true,
        subscribeRequired: () => () => {},
      },
      root as unknown as HTMLElement,
    ).dispose,
  );
  const labels = { cancel: "Cancel", close: "Close", restart: "Restart", title: "Restart?" };
  const card = createRestartCard(
    root as unknown as HTMLElement,
    rewind
      ? { commit: rewind, kind: "rewind-quests", labels: { ...labels, body: "Confirm rewind." } }
      : { labels, onRestart },
  );
  const modal = root.children[0]!;
  const action = (name: string) => modal.querySelector(`[data-action="${name}"]`)!;
  return { action, card, guard, modal, onRestart, root };
}

describe("Restart's configured production binding", () => {
  it("opens on top of the controls overlay's shared modal layer, focused on Cancel", () => {
    published.roots.length = 0;
    const f = fixture(),
      cancel = f.action("restart-cancel"),
      frame = f.modal.querySelector('[role="dialog"]')!;
    // One layer shared by every modal in the overlay, Cheats and Settings included.
    expect(published.roots).toEqual([f.root]);
    f.card.open();
    expect(published.open).toHaveBeenCalledOnce();
    expect(published.open.mock.calls[0]![1]).toBe(frame);
    expect(published.open.mock.calls[0]![0]).toMatchObject({ focus: cancel });
    f.card.open();
    expect(published.open).toHaveBeenCalledOnce();
    cancel.click();
    expect(published.leave).toHaveBeenCalledOnce();
    f.card.dispose();
    expect(published.dispose).toHaveBeenCalledOnce();
  });

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
    expect(focusTarget).toHaveBeenLastCalledWith(cancel);
    expect(native.fit).toHaveBeenCalledOnce();
    await f.card.settle();
    cancel.click();
    expect(f.card.isOpen()).toBe(false);
    expect(f.onRestart).not.toHaveBeenCalled();
    f.card.open();
    expect(f.action("restart-cancel")).toBe(cancel);
    expect(f.modal.querySelector('[role="dialog"]')).toBe(frame);
    expect(doc.activeElement).toBe(cancel);
    expect(focusTarget).toHaveBeenCalledTimes(2);
    f.card.dispose();
  });

  it("lays out a closed card again only when it opens, not on each close", () => {
    const f = fixture();
    f.card.open();
    f.card.close();
    native.present.mockClear();
    for (let frame = 0; frame < 3; frame++) {
      f.card.close();
    }
    expect(native.present).not.toHaveBeenCalled();
    expect(f.card.isOpen()).toBe(false);
    f.card.open();
    expect(native.present).toHaveBeenCalled();
    expect(f.card.isOpen()).toBe(true);
    f.card.close();
    expect(f.card.isOpen()).toBe(false);
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
            target: f.modal,
          }).map(([key, value]) => [key, { value }]),
        ),
      );
      doc.hitTarget = f.modal;
      if (type === "pointerdown") {
        doc.dispatchEvent(e);
        f.root.dispatchEvent(e);
      } else if (type === "click") {
        f.root.dispatchEvent(e);
        if (!e.defaultPrevented) {
          f.modal.dispatchEvent(e);
        }
      } else {
        doc.dispatchEvent(e);
      }
      return e;
    };
    event("pointerdown", 0);
    event("pointerup", 30);
    const dragClick = event("click", 30);
    expect(f.card.isOpen()).toBe(true);
    event("pointerdown", 0);
    event("pointerup", 1);
    const tapClick = event("click", 1);
    expect(f.card.isOpen()).toBe(false);
    expect(dragClick.defaultPrevented).toBe(true);
    expect(tapClick.defaultPrevented).toBe(true);
    expect(f.onRestart).not.toHaveBeenCalled();
    f.card.dispose();
    expect(native.dispose).toHaveBeenCalledOnce();
  });
});

it("keeps rewind confirmation open on failed commit and accepts a successful retry only once", async () => {
  let finish!: (handoff: (() => void) | null) => void;
  const commit = vi.fn<(current: () => boolean) => Promise<(() => void) | null>>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const f = fixture(commit);
  const cheats = new Element();
  f.root.append(cheats);
  f.card.open();
  expect(f.root.children.at(-1)).toBe(f.modal);
  const reset = f.action("rewind-quests-confirm");
  reset.dispatchEvent(new Event("click"));
  reset.dispatchEvent(new Event("click"));
  expect(commit).toHaveBeenCalledOnce();
  expect(commit.mock.calls[0]![0]()).toBe(true);
  f.card.close();
  expect(f.card.isOpen()).toBe(true);
  finish(null);
  await vi.waitFor(() => {
    reset.dispatchEvent(new Event("click"));
    expect(commit).toHaveBeenCalledTimes(2);
  });
  const handoff = vi.fn(() => expect(f.card.isOpen()).toBe(false));
  finish(handoff);
  await vi.waitFor(() => expect(handoff).toHaveBeenCalledOnce());
  expect(f.onRestart).not.toHaveBeenCalled();
  f.card.dispose();
});
