import { afterEach, expect, it, vi } from "vitest";

import { type AdaActionOptions, bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { bindAdaHoldActions } from "./holdActionsAdapter.ts";

class Element extends EventTarget {
  parentElement: Element | null = null;
  hidden = false;
  inert = false;
  disabled = false;
  connected = true;
  readonly attributes = new Map<string, string>();
  readonly ownerDocument: FixtureDocument;
  constructor(ownerDocument: FixtureDocument) {
    super();
    this.ownerDocument = ownerDocument;
  }
  get isConnected(): boolean {
    return this.connected && (this.parentElement?.isConnected ?? true);
  }
  contains(target: unknown): boolean {
    return (
      target === this ||
      (target instanceof Element &&
        Boolean(target.parentElement) &&
        this.contains(target.parentElement))
    );
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  closest(_selector: string): Element | null {
    return this.hidden || this.inert ? this : (this.parentElement?.closest(_selector) ?? null);
  }
}
class FixtureDocument extends EventTarget {
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
}
function setup() {
  vi.useFakeTimers();
  const document = new FixtureDocument();
  const root = new Element(document),
    button = new Element(document),
    label = new Element(document);
  button.parentElement = root;
  label.parentElement = button;
  const element = button as unknown as HTMLElement;
  const host = root as unknown as HTMLElement;
  let generation = 0;
  const gate = {
    accepts: () => true,
    capture() {
      const captured = generation;
      return () => captured === generation;
    },
  };
  const stop = bindAdaHoldActions({ gate }, host);
  const event = (type: string, target: Element = label, extra = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(
      e,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: 0,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 7,
          target,
          ...extra,
        }).map(([key, value]) => [key, { value }]),
      ),
    );
    return e;
  };
  const down = () => {
    document.dispatchEvent(event("pointerdown"));
    root.dispatchEvent(event("pointerdown"));
  };
  const click = (detail = 1) => {
    const e = event("click", label, { detail });
    root.dispatchEvent(e);
    if (!e.defaultPrevented) {
      button.dispatchEvent(event("click", label, { detail }));
    }
    return e;
  };
  const up = () => document.dispatchEvent(event("pointerup"));
  const run = vi.fn();
  const options: AdaActionOptions = {
    click: { availability: () => ({ kind: "available" }), run },
    current: () => true,
    slopPx: () => 8,
  };
  return {
    button,
    changeScope: () => {
      generation++;
    },
    click,
    document,
    down,
    element,
    event,
    host,
    options,
    root,
    run,
    stop,
    up,
  };
}
afterEach(() => {
  vi.useRealTimers();
});

it("uses the published dispatcher with current native callbacks and one release suppression", () => {
  const f = setup();
  const binding = bindAdaAction(f.options, f.element);
  const newer = vi.fn();
  f.down();
  binding.update({ ...f.options, click: { ...f.options.click, run: newer } });
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  expect(newer).toHaveBeenCalledOnce();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(newer).toHaveBeenCalledOnce();
  f.click(0);
  expect(newer).toHaveBeenCalledTimes(2);
  binding.dispose();
  f.stop();
});

it("keeps an explicit unavailable hold separate from the native selection action", () => {
  const f = setup(),
    hold = vi.fn();
  let allowed = false;
  const binding = bindAdaAction(
    {
      ...f.options,
      hold: {
        availability: () =>
          allowed ? { kind: "available" } : { kind: "unavailable", reason: "Needs weapon" },
        run: hold,
      },
    },
    f.element,
  );
  f.down();
  vi.advanceTimersByTime(500);
  expect(hold).not.toHaveBeenCalled();
  expect(f.run).not.toHaveBeenCalled();
  f.document.dispatchEvent(f.event("pointercancel"));
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  allowed = true;
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(hold).toHaveBeenCalledOnce();
  expect(f.run).toHaveBeenCalledOnce();
  binding.dispose();
  f.stop();
});

it("invalidates a captured UI scope without treating an open Menu as blocked gameplay", () => {
  const f = setup();
  const binding = bindAdaAction(f.options, f.element);
  f.down();
  f.changeScope();
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  f.document.dispatchEvent(f.event("pointercancel"));
  f.down();
  vi.advanceTimersByTime(500);
  expect(f.run).toHaveBeenCalledOnce();
  binding.dispose();
  f.stop();
});

it("excludes unregistered controls and refuses hidden or disposed bindings without stale teardown", () => {
  const f = setup();
  expect(resolveAdaHoldAction(f.host, f.element)).toBeNull();
  const old = bindAdaAction(f.options, f.element);
  expect(() => bindAdaAction(f.options, f.element)).toThrow("already registered");
  f.button.hidden = true;
  expect(resolveAdaHoldAction(f.host, f.element)?.available()).toBe(false);
  f.button.hidden = false;
  old.dispose();
  const next = bindAdaAction(f.options, f.element);
  old.dispose();
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  f.down();
  next.dispose();
  vi.advanceTimersByTime(500);
  expect(f.run).toHaveBeenCalledOnce();
  expect(resolveAdaHoldAction(f.host, f.element)).toBeNull();
  f.stop();
  f.stop();
  expect(vi.getTimerCount()).toBe(0);
});
