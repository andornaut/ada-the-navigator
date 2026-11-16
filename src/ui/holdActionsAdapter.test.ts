import { bindButtonAvailability } from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";
import { afterEach, expect, it, vi } from "vitest";

import {
  type AdaActionOptions,
  assertAdaActionBindings,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { bindAdaActionRoot, bindAdaHoldActions } from "./holdActionsAdapter.ts";
import { enterPressView, invalidatePressScope } from "./pressScope.ts";

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
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  closest(selector: string): Element | null {
    return (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert) ||
      (selector.includes("aria-disabled") &&
        this.attributes.get("aria-disabled")?.toLowerCase() === "true")
      ? this
      : (this.parentElement?.closest(selector) ?? null);
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
function setup(readiness?: {
  ready: () => boolean;
  subscribe: (invalidate: () => void) => () => void;
}) {
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
  const attachment = readiness
    ? bindAdaActionRoot(
        { guard: { gate }, requiredReady: readiness.ready, subscribeRequired: readiness.subscribe },
        host,
      )
    : undefined;
  const stop = attachment?.dispose ?? bindAdaHoldActions({ gate }, host);
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

it("shares required readiness and foreground eligibility across click and default hold, then rearms", () => {
  let ready = true;
  let invalidate = () => {};
  const unsubscribe = vi.fn();
  const f = setup({
    ready: () => ready,
    subscribe: (notify) => {
      invalidate = notify;
      return unsubscribe;
    },
  });
  const binding = bindAdaAction(f.options, f.element);
  f.down();
  ready = false;
  invalidate();
  f.click(0);
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  ready = true;
  invalidate();
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  f.document.dispatchEvent(f.event("pointercancel"));
  f.down();
  Object.assign(f.document, { hidden: true });
  f.document.dispatchEvent(new Event("visibilitychange"));
  f.click(0);
  Object.assign(f.document, { hidden: false });
  f.document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  f.document.dispatchEvent(f.event("pointercancel"));
  f.down();
  vi.advanceTimersByTime(499);
  expect(f.run).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(f.run).toHaveBeenCalledOnce();
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledOnce();
  f.stop();
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
  binding.dispose();
});

it("blocks unavailable mutation and native-disabled input while preserving movement and pointer identity", () => {
  const f = setup();
  const binding = bindAdaAction(
    {
      ...f.options,
      click: {
        ...f.options.click,
        availability: () =>
          f.button.attributes.has("aria-disabled")
            ? { kind: "unavailable", reason: "Unavailable" }
            : { kind: "available" },
      },
    },
    f.element,
  );
  for (const disabled of ["native", "aria"] as const) {
    f.button.disabled = disabled === "native";
    if (disabled === "aria") {
      f.button.attributes.set("aria-disabled", "TRUE");
    }
    f.down();
    vi.advanceTimersByTime(500);
    f.up();
    f.click(0);
    expect(f.run).not.toHaveBeenCalled();
    f.button.disabled = false;
    f.button.attributes.delete("aria-disabled");
  }
  f.down();
  f.document.dispatchEvent(f.event("pointermove", f.button, { clientX: 9 }));
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  f.up();
  f.down();
  f.document.dispatchEvent(f.event("pointerup", f.button, { pointerId: 8 }));
  vi.advanceTimersByTime(500);
  expect(f.run).toHaveBeenCalledOnce();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  f.stop();
  binding.dispose();
});

it("rejects an unbound newly constructed action control and a missing root, accepting registered overrides", () => {
  const f = setup();
  Object.assign(f.root, { querySelectorAll: () => [f.element] });
  expect(() => assertAdaActionBindings(f.host)).toThrow("no registered action binding");
  const binding = bindAdaAction(
    { ...f.options, hold: { ...f.options.click, run: vi.fn() } },
    f.element,
  );
  expect(() => assertAdaActionBindings(f.host)).not.toThrow();
  f.stop();
  expect(() => assertAdaActionBindings(f.host)).toThrow("no live action root");
  binding.dispose();
  expect(() => assertAdaActionBindings(f.host)).toThrow("no registered action binding");
});

it("keeps Pause refusal feedback and denies inherited aria-disabled hold", () => {
  const f = setup();
  const refused = vi.fn(),
    mutate = vi.fn();
  let allowed = false;
  f.root.attributes.set("aria-disabled", "true");
  const binding = bindAdaAction(
    {
      ...f.options,
      click: {
        ...f.options.click,
        run: () => {
          if (!allowed) {
            refused();
            return;
          }
          mutate();
        },
      },
    },
    f.element,
  );
  f.click(0);
  expect(refused).toHaveBeenCalledOnce();
  expect(mutate).not.toHaveBeenCalled();
  f.down();
  vi.advanceTimersByTime(500);
  expect(refused).toHaveBeenCalledOnce();
  expect(mutate).not.toHaveBeenCalled();
  f.up();
  f.root.attributes.delete("aria-disabled");
  allowed = true;
  f.down();
  vi.advanceTimersByTime(500);
  expect(mutate).toHaveBeenCalledOnce();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(mutate).toHaveBeenCalledOnce();
  binding.dispose();
  f.stop();
});

it("keeps the published soft-unavailable feedback guard reachable before normal action listeners", () => {
  const f = setup();
  const refused = vi.fn();
  let allowed = false;
  const availability = () =>
    allowed
      ? { kind: "available" as const }
      : { kind: "unavailable" as const, reason: "Needs fuel" };
  const reason = { hidden: true, textContent: "" };
  const presentation = bindButtonAvailability(
    {
      getAvailability: availability,
      onUnavailable: refused,
      reason: reason as unknown as HTMLElement,
    },
    f.element as HTMLButtonElement,
  );
  const binding = bindAdaAction({ ...f.options, click: { availability, run: f.run } }, f.element);
  f.click(0);
  expect(refused).toHaveBeenCalledWith("Needs fuel");
  expect(reason.textContent).toBe("Needs fuel");
  expect(f.run).not.toHaveBeenCalled();
  f.down();
  vi.advanceTimersByTime(500);
  expect(refused).toHaveBeenCalledOnce();
  expect(f.run).not.toHaveBeenCalled();
  f.up();
  allowed = true;
  presentation.refresh();
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  binding.dispose();
  presentation.dispose();
  f.stop();
});

it("dispatches keyboard activation through current click policy independently of hold availability", () => {
  const f = setup(),
    hold = vi.fn();
  const binding = bindAdaAction(
    {
      ...f.options,
      hold: {
        availability: () => ({ kind: "unavailable", reason: "Hold unavailable" }),
        run: hold,
      },
    },
    f.element,
  );
  expect(binding.activate()).toBe(true);
  expect(f.run).toHaveBeenCalledOnce();
  expect(hold).not.toHaveBeenCalled();
  binding.update({
    ...f.options,
    click: {
      availability: () => ({ kind: "unavailable", reason: "Click unavailable" }),
      run: f.run,
    },
    hold: { ...f.options.click, run: hold },
  });
  expect(binding.activate()).toBe(false);
  expect(f.run).toHaveBeenCalledOnce();
  f.down();
  vi.advanceTimersByTime(500);
  expect(hold).toHaveBeenCalledOnce();
  binding.dispose();
  expect(binding.activate()).toBe(false);
  f.stop();
});

it("synchronously cancels root/readiness ownership and suppresses only its matching release", () => {
  let notify = () => {};
  const f = setup({
    ready: () => true,
    subscribe: (invalidate) => {
      notify = invalidate;
      return () => {};
    },
  });
  const binding = bindAdaAction(f.options, f.element);
  f.down();
  expect(vi.getTimerCount()).toBe(1);
  notify();
  expect(vi.getTimerCount()).toBe(0);
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(f.run).not.toHaveBeenCalled();
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  f.down();
  invalidatePressScope(f.host);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(500);
  expect(f.run).toHaveBeenCalledOnce();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  binding.dispose();
  f.stop();
});

it("cancels reentrant modal changes during a hold without double activation on release", () => {
  const f = setup();
  const dialog = new Element(f.document);
  dialog.parentElement = f.root;
  let leave = () => {};
  const opened = vi.fn(() => {
    leave = enterPressView(f.host, dialog as unknown as HTMLElement);
  });
  const binding = bindAdaAction(
    { ...f.options, click: { ...f.options.click, run: opened } },
    f.element,
  );
  f.down();
  vi.advanceTimersByTime(500);
  expect(opened).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(opened).toHaveBeenCalledOnce();
  leave();
  f.down();
  vi.advanceTimersByTime(500);
  expect(opened).toHaveBeenCalledTimes(2);
  leave();
  binding.dispose();
  f.stop();
});

it("suppresses a canceled native compatibility click after eligibility remains available for the entire press", () => {
  const f = setup();
  const binding = bindAdaAction(f.options, f.element);
  const legacyClick = () => {
    const event = new Event("click", { cancelable: true });
    Object.defineProperties(event, { detail: { value: 1 }, target: { value: f.button } });
    f.root.dispatchEvent(event);
    if (!event.defaultPrevented) {
      f.button.dispatchEvent(f.event("click", f.button));
    }
    return event;
  };
  f.down();
  invalidatePressScope(f.host);
  vi.advanceTimersByTime(530);
  expect(f.run).not.toHaveBeenCalled();
  f.up();
  expect(legacyClick().defaultPrevented).toBe(true);
  expect(f.run).not.toHaveBeenCalled();
  f.down();
  f.up();
  expect(legacyClick().defaultPrevented).toBe(false);
  expect(f.run).toHaveBeenCalledOnce();
  binding.dispose();
  f.stop();
});

it("uses captured native-click eligibility even when the current guard accepts again before a short release", () => {
  const f = setup();
  const binding = bindAdaAction(f.options, f.element);
  f.down();
  f.changeScope();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(f.run).not.toHaveBeenCalled();
  f.click(0);
  expect(f.run).toHaveBeenCalledOnce();
  f.down();
  f.up();
  expect(f.click().defaultPrevented).toBe(false);
  expect(f.run).toHaveBeenCalledTimes(2);
  binding.dispose();
  f.stop();
});

it("assigns a nested control to one nearest binder and invalidates replaced entry identities", () => {
  const f = setup();
  const outer = new Element(f.document);
  f.root.parentElement = outer;
  const outerHost = outer as unknown as HTMLElement;
  const stopOuter = bindAdaHoldActions(
    { gate: { accepts: () => true, capture: () => () => true } },
    outerHost,
  );
  const first = bindAdaAction(f.options, f.element);
  expect(resolveAdaHoldAction(outerHost, f.element)).toBeNull();
  const captured = resolveAdaHoldAction(f.host, f.element)!;
  expect(captured).not.toBeNull();
  f.down();
  outer.dispatchEvent(f.event("pointerdown"));
  vi.advanceTimersByTime(500);
  expect(f.run).toHaveBeenCalledTimes(1);
  f.up();
  f.run.mockClear();
  first.update({ ...f.options, click: { ...f.options.click, run: f.run } });
  expect(resolveAdaHoldAction(f.host, f.element)?.identity).toBe(captured.identity);
  first.dispose();
  const replacement = bindAdaAction(f.options, f.element);
  expect(resolveAdaHoldAction(f.host, f.element)?.identity).not.toBe(captured.identity);
  captured.activate();
  expect(f.run).not.toHaveBeenCalled();
  f.stop();
  expect(resolveAdaHoldAction(outerHost, f.element)).toBeNull();
  replacement.dispose();
  stopOuter();
});
