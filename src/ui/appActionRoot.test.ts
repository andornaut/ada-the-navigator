import { afterEach, expect, it, vi } from "vitest";

import { requiredLoading, requiredReady } from "../loading/required.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { enterPressView, rootPressGuard } from "./pressScope.ts";

class Element extends EventTarget {
  parentElement: Element | null = null;
  isConnected = true;
  readonly ownerDocument: FixtureDocument;
  constructor(ownerDocument: FixtureDocument) {
    super();
    this.ownerDocument = ownerDocument;
  }
  contains(target: unknown): boolean {
    return (
      target === this ||
      (target instanceof Element &&
        Boolean(target.parentElement && this.contains(target.parentElement)))
    );
  }
  matches() {
    return false;
  }
  closest() {
    return null;
  }
  getAttribute() {
    return null;
  }
}
class FixtureDocument extends EventTarget {
  hidden = false;
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  });
}
afterEach(() => vi.useRealTimers());

it("shares App and child foreground ownership with actual required-resource and terminal disposal fences", () => {
  vi.useFakeTimers();
  const document = new FixtureDocument();
  const app = new Element(document),
    controls = new Element(document),
    start = new Element(document),
    dialog = new Element(document),
    close = new Element(document);
  controls.parentElement = app;
  start.parentElement = app;
  dialog.parentElement = controls;
  close.parentElement = dialog;
  const html = (node: Element) => node as unknown as HTMLElement;
  let status: "ready" | "loading" = "ready";
  const unobserve = requiredLoading.observe({ retry: async () => {}, status: () => status });
  const attach = (node: Element) =>
    bindAdaActionRoot(
      {
        guard: rootPressGuard(html(node)),
        requiredReady,
        subscribeRequired: (invalidate) => requiredLoading.subscribe(invalidate),
      },
      html(node),
    );
  const outer = attach(app),
    inner = attach(controls);
  const background = vi.fn(),
    foreground = vi.fn();
  const bind = (run: () => void, node: Element) =>
    bindAdaAction(
      {
        click: { availability: () => ({ kind: "available" }), run },
        current: () => true,
        slopPx: () => 8,
      },
      html(node),
    );
  const a = bind(background, start),
    b = bind(foreground, close);
  const event = (type: string, target: Element) => {
    const value = new Event(type, { cancelable: true });
    Object.defineProperties(
      value,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: 0,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 7,
          target,
        }).map(([key, property]) => [key, { value: property }]),
      ),
    );
    return value;
  };
  const down = (target: Element) => {
    document.dispatchEvent(event("pointerdown", target));
    app.dispatchEvent(event("pointerdown", target));
    if (controls.contains(target)) {
      controls.dispatchEvent(event("pointerdown", target));
    }
  };
  const release = (target: Element) => {
    document.dispatchEvent(event("pointerup", target));
    const click = event("click", target);
    app.dispatchEvent(click);
    if (!click.defaultPrevented && controls.contains(target)) {
      controls.dispatchEvent(click);
    }
    return click;
  };
  expect(requiredReady()).toBe(true);
  down(start);
  const leave = enterPressView(html(controls), html(dialog));
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(500);
  expect(background).not.toHaveBeenCalled();
  expect(release(start).defaultPrevented).toBe(true);
  expect(a.activate()).toBe(false);
  down(close);
  vi.advanceTimersByTime(500);
  expect(foreground).toHaveBeenCalledOnce();
  expect(release(close).defaultPrevented).toBe(true);
  expect(foreground).toHaveBeenCalledOnce();
  leave();
  down(start);
  status = "loading";
  requiredLoading.invalidate();
  expect(requiredReady()).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  status = "ready";
  requiredLoading.invalidate();
  vi.advanceTimersByTime(500);
  expect(release(start).defaultPrevented).toBe(true);
  expect(background).not.toHaveBeenCalled();
  down(start);
  outer.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(500);
  expect(a.activate()).toBe(false);
  expect(b.activate()).toBe(false);
  expect(background).not.toHaveBeenCalled();
  expect(foreground).toHaveBeenCalledOnce();
  a.dispose();
  b.dispose();
  inner.dispose();
  unobserve();
  requiredLoading.dispose();
});
