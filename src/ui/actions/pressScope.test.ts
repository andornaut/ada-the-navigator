import { afterEach, expect, it, vi } from "vitest";

import { createModalLayer } from "../modalLayer.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import {
  currentView,
  enterPressView,
  inCurrentView,
  invalidatePressScope,
  rootPressGuard,
  subscribePressScope,
} from "./pressScope.ts";

const published = vi.hoisted(() => ({
  back: vi.fn(() => true),
  create: vi.fn(),
  dispose: vi.fn(),
  leave: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: (root: HTMLElement) => {
    published.create(root);
    return {
      ...published,
      open: (...args: unknown[]) => {
        published.open(...args);
        return published.leave;
      },
    };
  },
}));
class FixtureDocument extends EventTarget {
  hitTarget: HTMLElement | null = null;
  readonly defaultView = Object.assign(new EventTarget(), {
    HTMLElement: FixtureNode,
    Node: FixtureNode,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
  elementFromPoint() {
    return this.hitTarget;
  }
}
class FixtureNode extends EventTarget {
  readonly ownerDocument: FixtureDocument;
  readonly parentElement: FixtureNode | null;
  constructor(parent: FixtureNode | null) {
    super();
    this.parentElement = parent;
    this.ownerDocument = parent?.ownerDocument ?? new FixtureDocument();
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? true;
  }
  contains(other: FixtureNode): boolean {
    return other === this || (other.parentElement !== null && this.contains(other.parentElement));
  }
  getAttribute() {
    return null;
  }
  closest() {
    return null;
  }
  matches() {
    return false;
  }
}
const attached = new Set<() => void>();
afterEach(() => {
  for (const stop of attached) {
    stop();
  }
  attached.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function node(parentElement: HTMLElement | null = null): HTMLElement {
  const element = new FixtureNode(parentElement as unknown as FixtureNode | null);
  const host = element as unknown as HTMLElement;
  if (!parentElement) {
    const binding = bindAdaActionRoot(
      {
        guard: rootPressGuard(host),
        pointerRelease: {
          pointerTarget: element.ownerDocument as unknown as Document,
          resolvePointer: () => undefined,
        },
        requiredReady: () => true,
        subscribeRequired: () => () => {},
      },
      host,
    );
    attached.add(binding.dispose);
  }
  return host;
}

it("invalidates captures across nested open and dismissal while keeping modal actions eligible", () => {
  const root = node(),
    shell = node(root),
    menu = node(shell),
    details = node(shell),
    live = node(root);
  const guard = rootPressGuard(root),
    base = guard.gate.capture();
  expect(guard.gate.accepts()).toBe(true);
  const layer = createModalLayer(shell),
    options = { focus: menu, live: [live], restore: () => root };
  const leaveMenu = layer.open(options, menu);
  expect(published.open).toHaveBeenLastCalledWith(options, menu);
  expect(base()).toBe(false);
  expect(guard.gate.accepts()).toBe(true);
  expect(currentView(root)).toBe(menu);
  expect(inCurrentView(root, live)).toBe(true);
  const menuPress = guard.gate.capture();
  const leaveDetails = layer.open({ close: () => {} }, details);
  expect(menuPress()).toBe(false);
  expect(inCurrentView(root, menu)).toBe(false);
  const detailPress = guard.gate.capture();
  expect(layer.back()).toBe(true);
  expect(published.back).toHaveBeenCalledOnce();
  // back delegates the caller's close contract; leaving reports actual dismissal.
  leaveDetails();
  expect(detailPress()).toBe(false);
  expect(currentView(root)).toBe(menu);
  expect(menuPress()).toBe(false);
  leaveMenu();
  leaveMenu();
  expect(currentView(root)).toBe(root);
  layer.dispose();
});

it("disposes reporting without invoking leave/focus restoration and invalidates detached roots", () => {
  published.leave.mockClear();
  published.dispose.mockClear();
  const root = node(),
    dialog = node(root);
  const guard = rootPressGuard(root),
    layer = createModalLayer(root);
  const leave = layer.open({}, dialog),
    captured = guard.gate.capture();
  layer.dispose();
  layer.dispose();
  leave();
  expect(published.dispose).toHaveBeenCalledOnce();
  expect(published.leave).not.toHaveBeenCalled();
  expect(captured()).toBe(false);
  expect(currentView(root)).toBe(root);
  Object.defineProperty(root, "isConnected", { value: false });
  expect(guard.gate.accepts()).toBe(false);
});

it("invalidates a disabled group press without changing the foreground view", () => {
  const root = node(),
    dialog = node(root);
  const guard = rootPressGuard(root),
    layer = createModalLayer(root);
  const leave = layer.open({}, dialog),
    captured = guard.gate.capture();
  invalidatePressScope(root);
  expect(captured()).toBe(false);
  expect(currentView(root)).toBe(dialog);
  expect(guard.gate.accepts()).toBe(true);
  leave();
  layer.dispose();
});

function gesture(
  element: HTMLElement,
  type: string,
  x = 0,
  target: HTMLElement = element,
  pointerId = 1,
  isPrimary = true,
) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: 0 },
    detail: { value: type === "click" ? 1 : 0 },
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId },
    target: { value: target },
  });
  const document = element.ownerDocument as unknown as FixtureDocument;
  document.hitTarget = target;
  let root = element;
  while (root.parentElement) {
    root = root.parentElement;
  }
  if (type === "pointerdown") {
    document.dispatchEvent(event);
    root.dispatchEvent(event);
  } else if (type === "click") {
    root.dispatchEvent(event);
    if (!event.defaultPrevented) {
      element.dispatchEvent(event);
    }
  } else {
    document.dispatchEvent(event);
  }
  return event;
}

it("dismisses only the top view and cannot dismiss its restored parent on the same click", () => {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = node(),
    backdrop = node(root),
    parent = node(backdrop),
    child = node(backdrop);
  rootPressGuard(root);
  const parentClose = vi.fn();
  const leaveParent = enterPressView(root, parent, [], { backdrop, close: parentClose });
  const childClose = vi.fn(() => leaveChild());
  const leaveChild = enterPressView(root, child, [], { backdrop, close: childClose });
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointerup");
  const event = gesture(backdrop, "click");
  expect(event.defaultPrevented).toBe(true);
  expect(childClose).toHaveBeenCalledOnce();
  expect(parentClose).not.toHaveBeenCalled();
  expect(currentView(root)).toBe(parent);
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(parentClose).toHaveBeenCalledOnce();
  leaveParent();
  vi.unstubAllGlobals();
});

it("rejects card-origin drags, cancelled gestures, stale view captures and disposed listeners", () => {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = node(),
    backdrop = node(root),
    card = node(backdrop),
    cover = node(root);
  const close = vi.fn();
  const leave = enterPressView(root, card, [], { backdrop, close });
  gesture(backdrop, "pointerdown", 0, card);
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointerup", 100);
  gesture(backdrop, "click", 100);
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointercancel");
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  gesture(backdrop, "pointerdown");
  const leaveCover = enterPressView(root, cover);
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  leaveCover();
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  gesture(backdrop, "pointerdown");
  const leaveTransient = enterPressView(root, cover);
  leaveTransient();
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).not.toHaveBeenCalled();
  gesture(backdrop, "pointerdown");
  leave();
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("does not route a backdrop event after the UI root unmounts", () => {
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = node(),
    backdrop = node(root),
    dialog = node(backdrop),
    close = vi.fn();
  const leave = enterPressView(root, dialog, [], { backdrop, close });
  gesture(backdrop, "pointerdown");
  Object.defineProperty(root, "isConnected", { value: false });
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).not.toHaveBeenCalled();
  leave();
  vi.unstubAllGlobals();
});

it.each(["card-up", "missing-up", "different-pointer", "secondary-up", "different-click"])(
  "rejects %s while retaining the next complete primary backdrop tap",
  (kind) => {
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
    const root = node(),
      backdrop = node(root),
      card = node(backdrop),
      close = vi.fn();
    const leave = enterPressView(root, card, [], { backdrop, close });
    gesture(backdrop, "pointerdown");
    if (kind !== "missing-up") {
      gesture(
        backdrop,
        "pointerup",
        1,
        kind === "card-up" ? card : backdrop,
        kind === "different-pointer" ? 2 : 1,
        kind !== "secondary-up",
      );
    }
    gesture(backdrop, "click", 1, backdrop, kind === "different-click" ? 2 : 1);
    expect(close).toHaveBeenCalledTimes(kind === "different-click" ? 1 : 0);
    gesture(backdrop, "pointerdown");
    gesture(backdrop, "pointerup");
    gesture(backdrop, "click");
    expect(close).toHaveBeenCalledTimes(kind === "different-click" ? 2 : 1);
    leave();
    vi.unstubAllGlobals();
  },
);

it("notifies modal enter, leave and explicit revisions synchronously without retaining disposed subscribers", () => {
  const root = node(),
    dialog = node(root);
  rootPressGuard(root);
  const notify = vi.fn();
  const stop = subscribePressScope(notify, root);
  const leave = enterPressView(root, dialog);
  expect(notify).toHaveBeenCalledOnce();
  invalidatePressScope(root);
  expect(notify).toHaveBeenCalledTimes(2);
  leave();
  expect(notify).toHaveBeenCalledTimes(3);
  leave();
  expect(notify).toHaveBeenCalledTimes(3);
  stop();
  invalidatePressScope(root);
  expect(notify).toHaveBeenCalledTimes(3);
});

it("shares the published sibling root and preserves the remaining top modal on owner disposal", () => {
  published.create.mockClear();
  published.dispose.mockClear();
  const root = node(),
    firstRoot = node(root),
    secondRoot = node(root);
  const firstDialog = node(firstRoot),
    secondDialog = node(secondRoot);
  rootPressGuard(root);
  const first = createModalLayer(firstRoot),
    second = createModalLayer(secondRoot);
  first.open({}, firstDialog);
  const leave = second.open({}, secondDialog);
  expect(published.create).toHaveBeenCalledExactlyOnceWith(root);
  first.dispose();
  expect(published.dispose).not.toHaveBeenCalled();
  expect(currentView(root)).toBe(secondDialog);
  leave();
  second.dispose();
  expect(currentView(root)).toBe(root);
  expect(published.dispose).toHaveBeenCalledOnce();
  second.open({}, secondDialog);
  expect(currentView(root)).toBe(root);
});

it("shares child modal coverage and synchronous revisions with a parent-first application root", () => {
  const app = node(),
    controls = node(app),
    start = node(app),
    dialog = node(controls),
    live = node(controls);
  const appGuard = rootPressGuard(app);
  const childGuard = rootPressGuard(controls);
  const appPress = appGuard.gate.capture();
  const childPress = childGuard.gate.capture();
  const appChanged = vi.fn(),
    childChanged = vi.fn();
  const stopApp = subscribePressScope(appChanged, app);
  const stopChild = subscribePressScope(childChanged, controls);
  const leave = enterPressView(controls, dialog, [live]);
  expect(currentView(app)).toBe(dialog);
  expect(currentView(controls)).toBe(dialog);
  expect(inCurrentView(app, start)).toBe(false);
  expect(inCurrentView(app, dialog)).toBe(true);
  expect(inCurrentView(controls, live)).toBe(true);
  expect(appPress()).toBe(false);
  expect(childPress()).toBe(false);
  expect(appChanged).toHaveBeenCalledTimes(1);
  expect(childChanged).toHaveBeenCalledTimes(1);
  const modalPress = appGuard.gate.capture();
  leave();
  expect(modalPress()).toBe(false);
  expect(inCurrentView(app, start)).toBe(true);
  expect(appChanged).toHaveBeenCalledTimes(2);
  expect(childChanged).toHaveBeenCalledTimes(2);
  invalidatePressScope(controls);
  expect(appChanged).toHaveBeenCalledTimes(3);
  expect(childChanged).toHaveBeenCalledTimes(3);
  stopChild();
  stopApp();
});

it("keeps inherited child guards connection-sensitive and independent roots isolated", () => {
  const app = node(),
    controls = node(app),
    recovery = node();
  const appGuard = rootPressGuard(app);
  const childGuard = rootPressGuard(controls);
  const recoveryGuard = rootPressGuard(recovery);
  const childPress = childGuard.gate.capture();
  const recoveryPress = recoveryGuard.gate.capture();
  Object.defineProperty(controls, "isConnected", { value: false });
  expect(childGuard.gate.accepts()).toBe(false);
  expect(childPress()).toBe(false);
  expect(appGuard.gate.accepts()).toBe(true);
  const leave = enterPressView(app, node(app));
  expect(recoveryPress()).toBe(true);
  expect(recoveryGuard.gate.accepts()).toBe(true);
  leave();
});

it("holds only the current backdrop once, never child text or a mandatory overlay", () => {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = node(),
    backdrop = node(root),
    card = node(backdrop),
    text = node(card);
  const close = vi.fn();
  const leave = enterPressView(root, card, [], { backdrop, close });
  expect(inCurrentView(root, backdrop)).toBe(true);
  gesture(backdrop, "pointerdown", 0, text);
  vi.advanceTimersByTime(530);
  gesture(backdrop, "pointerup", 0, text);
  gesture(backdrop, "click", 0, text);
  expect(close).not.toHaveBeenCalled();
  const leaveMandatory = enterPressView(root, card);
  expect(inCurrentView(root, backdrop)).toBe(false);
  gesture(backdrop, "pointerdown");
  vi.advanceTimersByTime(530);
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).not.toHaveBeenCalled();
  leaveMandatory();
  gesture(backdrop, "pointerdown");
  vi.advanceTimersByTime(530);
  expect(close).toHaveBeenCalledOnce();
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).toHaveBeenCalledOnce();
  leave();
});

it("does not reuse a held logical view after closing and reopening the same descriptor and DOM", () => {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const root = node(),
    backdrop = node(root),
    card = node(backdrop);
  const close = vi.fn();
  const descriptor = { backdrop, close };
  const leave = enterPressView(root, card, [], descriptor);
  gesture(backdrop, "pointerdown");
  leave();
  const leaveAgain = enterPressView(root, card, [], descriptor);
  vi.advanceTimersByTime(530);
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).not.toHaveBeenCalled();
  gesture(backdrop, "pointerdown");
  gesture(backdrop, "pointerup");
  gesture(backdrop, "click");
  expect(close).toHaveBeenCalledOnce();
  leaveAgain();
});

it("does not assign synthetic keyboard clicks a backdrop dismissal while preserving modal navigation", () => {
  const root = node(),
    backdrop = node(root),
    card = node(backdrop);
  const close = vi.fn();
  const layer = createModalLayer(backdrop);
  const leave = layer.open({ close }, card);
  const event = new Event("click", { cancelable: true });
  Object.defineProperties(event, { detail: { value: 0 }, target: { value: backdrop } });
  root.dispatchEvent(event);
  backdrop.dispatchEvent(event);
  expect(close).not.toHaveBeenCalled();
  expect(layer.back()).toBe(true);
  expect(published.back).toHaveBeenCalled();
  leave();
  layer.dispose();
});
