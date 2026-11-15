import { expect, it, vi } from "vitest";

import { createModalLayer } from "./modalLayer.ts";
import { currentView, inCurrentView, invalidatePressScope, rootPressGuard } from "./pressScope.ts";

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
  const element = {
    contains(other: HTMLElement): boolean {
      if (other === element) {
        return true;
      }
      const parent = other.parentElement;
      return parent !== null && element.contains(parent);
    },
    isConnected: true,
    parentElement,
  };
  return element as HTMLElement;
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
