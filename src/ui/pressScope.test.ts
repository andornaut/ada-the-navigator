import { expect, it, vi } from "vitest";

import { createModalLayer } from "./modalLayer.ts";
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
  dispose: vi.fn(),
  leave: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: () => ({
    ...published,
    open: (...args: unknown[]) => {
      published.open(...args);
      return published.leave;
    },
  }),
}));
function node(parentElement: HTMLElement | null = null): HTMLElement {
  const element = Object.assign(new EventTarget(), {
    contains(other: HTMLElement): boolean {
      if (other === element) {
        return true;
      }
      const parent = other.parentElement;
      return parent !== null && element.contains(parent);
    },
    isConnected: true,
    parentElement,
  });
  return element as unknown as HTMLElement;
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
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId },
    target: { value: target },
  });
  element.dispatchEvent(event);
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
    expect(close).not.toHaveBeenCalled();
    gesture(backdrop, "pointerdown");
    gesture(backdrop, "pointerup");
    gesture(backdrop, "click");
    expect(close).toHaveBeenCalledOnce();
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
