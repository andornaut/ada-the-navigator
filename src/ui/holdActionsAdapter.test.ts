import { bindButtonAvailability } from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";
import { afterEach, expect, it, vi } from "vitest";

import {
  type AdaActionOptions,
  assertAdaActionBindings,
  bindAdaAction,
  createAdaFactoryHoldBinding,
  resolveAdaHoldAction,
  resolveAdaPointerTarget,
} from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import {
  type AdaPointerReleaseOptions,
  bindAdaActionRoot,
  bindAdaHoldActions,
  bindAdaRecoveryActionRoot,
} from "./holdActionsAdapter.ts";
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
  hidden = false;
  hitTarget: Element | null = null;
  elementFromPoint() {
    return this.hitTarget;
  }
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
}
function setup(
  readiness?: {
    ready: () => boolean;
    subscribe: (invalidate: () => void) => () => void;
  },
  recovery = false,
  pointerRelease?: AdaPointerReleaseOptions,
  allowNonPrimaryTouch?: boolean,
) {
  vi.useFakeTimers();
  const document = new FixtureDocument();
  const root = new Element(document),
    button = new Element(document),
    label = new Element(document);
  button.parentElement = root;
  label.parentElement = button;
  document.hitTarget = label;
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
  const attachment = recovery
    ? bindAdaRecoveryActionRoot({ guard: { gate } }, host)
    : readiness
      ? bindAdaActionRoot(
          {
            ...(allowNonPrimaryTouch === undefined ? {} : { allowNonPrimaryTouch }),
            guard: { gate },
            ...(pointerRelease ? { pointerRelease } : {}),
            requiredReady: readiness.ready,
            subscribeRequired: readiness.subscribe,
          },
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
    invalidate: attachment?.invalidate,
    label,
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

it("keeps factory native ownership exclusive while recovery works before game readiness", () => {
  const gameFixture = setup({ ready: () => false, subscribe: () => () => {} });
  const game = bindAdaAction(gameFixture.options, gameFixture.element);
  expect(game.activate()).toBe(false);
  game.dispose();
  gameFixture.stop();
  const f = setup(undefined, true);
  let alive = true;
  let busy = false;
  const guardedFactoryClick = vi.fn(() => {
    if (alive && !busy) {
      f.run();
    }
  });
  f.button.addEventListener("click", guardedFactoryClick);
  const listen = vi.spyOn(f.button, "addEventListener");
  const unlisten = vi.spyOn(f.button, "removeEventListener");
  const register = createAdaFactoryHoldBinding({ current: () => alive, slopPx: () => 8 }, f.host);
  const dispose = register({
    activate: guardedFactoryClick,
    available: () => alive && !busy,
    element: f.element,
  });
  expect(listen).not.toHaveBeenCalled();
  f.click(0);
  expect(f.run).toHaveBeenCalledTimes(1);
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  busy = true;
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  busy = false;
  f.down();
  alive = false;
  f.invalidate!();
  alive = true;
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  dispose();
  expect(unlisten).not.toHaveBeenCalled();
  expect(resolveAdaHoldAction(f.host, f.element)).toBeNull();
  f.click(0);
  expect(f.run).toHaveBeenCalledTimes(3);
  f.stop();
});

it("requires construction-time native ownership and refuses foreign factory elements", () => {
  const f = setup();
  const factory = bindAdaAction({ ...f.options, nativeClickOwner: "factory" }, f.element);
  expect(() => factory.update(f.options)).toThrow("ownership cannot change");
  factory.dispose();
  expect(() =>
    bindAdaAction(
      { ...f.options, beforeClick: () => true, nativeClickOwner: "factory" },
      f.element,
    ),
  ).toThrow("registry event hook");
  const foreign = new Element(f.document) as unknown as HTMLElement;
  expect(() =>
    createAdaFactoryHoldBinding(
      { current: () => true, slopPx: () => 8 },
      f.host,
    )({ activate: f.run, available: () => true, element: foreign }),
  ).toThrow("recovery root");
  f.stop();
});

it("uses the public coordinate release lifecycle with registered current actions and no native duplicate", () => {
  let hit: HTMLElement | null = null;
  const pressed = vi.fn();
  const f = setup({ ready: () => true, subscribe: () => () => {} }, false, {
    onPressChange: pressed,
    resolvePointer: () => hit,
  });
  hit = f.element;
  const binding = bindAdaAction(f.options, f.element);
  f.document.dispatchEvent(f.event("pointerdown", f.root));
  f.root.dispatchEvent(f.event("pointerdown", f.root));
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(pressed.mock.calls.map(([element]) => element)).toEqual([f.element, null]);
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  f.down();
  hit = null;
  f.document.dispatchEvent(f.event("pointermove"));
  hit = f.element;
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  f.down();
  const newer = vi.fn();
  binding.update({ ...f.options, click: { ...f.options.click, run: newer } });
  f.up();
  f.click();
  expect(newer).toHaveBeenCalledTimes(1);
  f.down();
  binding.dispose();
  const replacement = bindAdaAction(f.options, f.element);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  f.down();
  f.invalidate!();
  expect(pressed).toHaveBeenLastCalledWith(null);
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  f.click(0);
  expect(f.run).toHaveBeenCalledTimes(3);
  replacement.dispose();
  f.stop();
});

it("rejects unregistered coordinate hits and uses physical target fallback", () => {
  let hit: HTMLElement | null | undefined;
  const f = setup({ ready: () => true, subscribe: () => () => {} }, false, {
    resolvePointer: () => hit,
  });
  const binding = bindAdaAction(f.options, f.element);
  hit = f.root as unknown as HTMLElement;
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  expect(f.run).not.toHaveBeenCalled();
  hit = undefined;
  f.down();
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(1);
  binding.dispose();
  f.stop();
});

it("cancels a sibling app hold synchronously when a child modal opens and arms the modal action once", () => {
  vi.useFakeTimers();
  const document = new FixtureDocument();
  const app = new Element(document),
    controls = new Element(document),
    start = new Element(document),
    dialog = new Element(document),
    button = new Element(document);
  controls.parentElement = app;
  start.parentElement = app;
  dialog.parentElement = controls;
  button.parentElement = dialog;
  const html = (element: Element) => element as unknown as HTMLElement;
  const gate = { accepts: () => true, capture: () => () => true };
  const options = { guard: { gate }, requiredReady: () => true, subscribeRequired: () => () => {} };
  const outer = bindAdaActionRoot(options, html(app));
  const inner = bindAdaActionRoot(options, html(controls));
  const background = vi.fn(),
    foreground = vi.fn();
  const bind = (run: () => void, element: Element) =>
    bindAdaAction(
      {
        click: { availability: () => ({ kind: "available" }), run },
        current: () => true,
        slopPx: () => 8,
      },
      html(element),
    );
  const a = bind(background, start),
    b = bind(foreground, button);
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
  document.dispatchEvent(event("pointerdown", start));
  app.dispatchEvent(event("pointerdown", start));
  const leave = enterPressView(html(controls), html(dialog));
  vi.advanceTimersByTime(500);
  expect(background).not.toHaveBeenCalled();
  document.dispatchEvent(event("pointerup", start));
  const stale = event("click", start);
  app.dispatchEvent(stale);
  expect(stale.defaultPrevented).toBe(true);
  expect(resolveAdaHoldAction(html(app), html(button))).toBeNull();
  document.dispatchEvent(event("pointerdown", button));
  app.dispatchEvent(event("pointerdown", button));
  controls.dispatchEvent(event("pointerdown", button));
  vi.advanceTimersByTime(500);
  expect(foreground).toHaveBeenCalledTimes(1);
  document.dispatchEvent(event("pointerup", button));
  const released = event("click", button);
  app.dispatchEvent(released);
  if (!released.defaultPrevented) {
    controls.dispatchEvent(released);
  }
  expect(released.defaultPrevented).toBe(true);
  expect(foreground).toHaveBeenCalledTimes(1);
  leave();
  expect(a.activate()).toBe(true);
  expect(background).toHaveBeenCalledTimes(1);
  a.dispose();
  b.dispose();
  inner.dispose();
  outer.dispose();
});

it("requires an exact self target for native clicks and hold construction, without ancestor fallback", () => {
  const f = setup();
  const outer = bindAdaAction({ ...f.options, nativeClickOwner: "factory" }, f.host);
  const binding = bindAdaAction({ ...f.options, hitTarget: "self" }, f.element);
  expect(resolveAdaHoldAction(f.host, f.button)).not.toBeNull();
  expect(resolveAdaHoldAction(f.host, f.label)).toBeNull();
  f.down();
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  f.document.dispatchEvent(f.event("pointercancel"));
  f.click(0);
  expect(f.run).not.toHaveBeenCalled();
  f.button.dispatchEvent(f.event("click", f.button, { detail: 0 }));
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(() => binding.update(f.options)).toThrow("hit target cannot change");
  binding.dispose();
  outer.dispose();
  f.stop();
});

it.each([false, true])(
  "opts non-primary touch into the same published lifecycle (release mode %s)",
  (release) => {
    const f = setup(
      { ready: () => true, subscribe: () => () => {} },
      false,
      release ? { resolvePointer: () => undefined } : undefined,
      true,
    );
    const binding = bindAdaAction(f.options, f.element);
    const down = (pointerType: string, button = 0) => {
      f.document.dispatchEvent(
        f.event("pointerdown", f.label, { button, isPrimary: false, pointerId: 8, pointerType }),
      );
      f.root.dispatchEvent(
        f.event("pointerdown", f.label, { button, isPrimary: false, pointerId: 8, pointerType }),
      );
    };
    down("mouse");
    vi.advanceTimersByTime(500);
    expect(f.run).not.toHaveBeenCalled();
    down("touch", 1);
    vi.advanceTimersByTime(500);
    expect(f.run).not.toHaveBeenCalled();
    down("touch");
    vi.advanceTimersByTime(500);
    expect(f.run).toHaveBeenCalledTimes(1);
    f.document.dispatchEvent(
      f.event("pointerup", f.label, { isPrimary: false, pointerId: 8, pointerType: "touch" }),
    );
    const clicked = f.event("click", f.label, { pointerId: 8 });
    f.root.dispatchEvent(clicked);
    expect(clicked.defaultPrevented).toBe(true);
    expect(f.run).toHaveBeenCalledTimes(1);
    binding.dispose();
    f.stop();
  },
);

it("keeps non-primary touch disabled without the explicit root option", () => {
  const f = setup({ ready: () => true, subscribe: () => () => {} });
  const binding = bindAdaAction(f.options, f.element);
  f.document.dispatchEvent(
    f.event("pointerdown", f.label, { isPrimary: false, pointerType: "touch" }),
  );
  f.root.dispatchEvent(f.event("pointerdown", f.label, { isPrimary: false, pointerType: "touch" }));
  vi.advanceTimersByTime(500);
  expect(f.run).not.toHaveBeenCalled();
  binding.dispose();
  f.stop();
});

it("routes own-ARIA refusal once without mutation and never exempts native/inert/ancestor/root blocks", () => {
  const f = setup();
  const refuse = vi.fn();
  f.button.setAttribute("aria-disabled", "true");
  const binding = bindAdaAction(
    {
      ...f.options,
      click: {
        availability: () => ({ kind: "unavailable", reason: "Need fuel" }),
        refuse,
        run: f.run,
      },
      ownAriaDisabled: "refusal-feedback",
    },
    f.element,
  );
  expect(resolveAdaHoldAction(f.host, f.element)?.ownAriaDisabled).toBe("refusal-feedback");
  f.down();
  vi.advanceTimersByTime(500);
  f.up();
  f.click();
  expect(refuse).toHaveBeenCalledExactlyOnceWith("Need fuel");
  expect(f.run).not.toHaveBeenCalled();
  const block = (change: () => void, restore: () => void) => {
    change();
    f.down();
    vi.advanceTimersByTime(500);
    f.up();
    restore();
  };
  block(
    () => {
      f.button.disabled = true;
    },
    () => {
      f.button.disabled = false;
    },
  );
  block(
    () => {
      f.button.inert = true;
    },
    () => {
      f.button.inert = false;
    },
  );
  block(
    () => f.root.setAttribute("aria-disabled", "true"),
    () => f.root.removeAttribute("aria-disabled"),
  );
  f.label.parentElement = f.button;
  const ancestor = new Element(f.document);
  ancestor.parentElement = f.root;
  f.button.parentElement = ancestor;
  block(
    () => ancestor.setAttribute("aria-disabled", "true"),
    () => ancestor.removeAttribute("aria-disabled"),
  );
  expect(refuse).toHaveBeenCalledTimes(1);
  expect(f.run).not.toHaveBeenCalled();
  binding.dispose();
  f.stop();
});

it("does not promote unavailable or omitted actions without the exact registered refusal policy", () => {
  const f = setup();
  const refuse = vi.fn();
  const binding = bindAdaAction(
    {
      ...f.options,
      click: {
        availability: () => ({ kind: "unavailable", reason: "Need fuel" }),
        refuse,
        run: f.run,
      },
    },
    f.element,
  );
  expect(resolveAdaHoldAction(f.host, f.element)?.available()).toBe(false);
  binding.update({
    ...f.options,
    click: { availability: () => ({ kind: "omitted" }), refuse, run: f.run },
    ownAriaDisabled: "refusal-feedback",
  });
  expect(resolveAdaHoldAction(f.host, f.element)?.available()).toBe(false);
  binding.update({
    ...f.options,
    click: { availability: () => ({ kind: "unavailable", reason: "Need fuel" }), run: f.run },
    ownAriaDisabled: "refusal-feedback",
  });
  expect(resolveAdaHoldAction(f.host, f.element)?.available()).toBe(false);
  f.down();
  vi.advanceTimersByTime(500);
  expect(refuse).not.toHaveBeenCalled();
  expect(f.run).not.toHaveBeenCalled();
  binding.dispose();
  f.stop();
});

it("revalidates physical self ownership at move, timer and release despite captured targets", () => {
  const f = setup({ ready: () => true, subscribe: () => () => {} }, false, {
    resolvePointer: () => undefined,
  });
  const binding = bindAdaAction({ ...f.options, hitTarget: "self" }, f.element);
  f.document.hitTarget = f.button;
  const down = () => {
    f.document.dispatchEvent(f.event("pointerdown", f.button));
    f.root.dispatchEvent(f.event("pointerdown", f.button));
  };
  const up = () => {
    f.document.dispatchEvent(f.event("pointerup", f.button));
    const click = f.event("click", f.button);
    f.root.dispatchEvent(click);
    if (!click.defaultPrevented) {
      f.button.dispatchEvent(click);
    }
  };
  down();
  f.document.hitTarget = f.label;
  f.document.dispatchEvent(f.event("pointermove", f.button, { clientX: 1 }));
  vi.advanceTimersByTime(530);
  up();
  expect(f.run).not.toHaveBeenCalled();
  f.document.hitTarget = f.button;
  down();
  f.document.hitTarget = f.label;
  vi.advanceTimersByTime(530);
  up();
  expect(f.run).not.toHaveBeenCalled();
  f.document.hitTarget = f.button;
  down();
  f.document.hitTarget = null;
  up();
  expect(f.run).not.toHaveBeenCalled();
  f.document.hitTarget = f.button;
  down();
  vi.advanceTimersByTime(530);
  expect(f.run).toHaveBeenCalledTimes(1);
  up();
  expect(f.run).toHaveBeenCalledTimes(1);
  down();
  up();
  expect(f.run).toHaveBeenCalledTimes(2);
  binding.dispose();
  f.stop();
});

function spatialFixture(
  outer: AdaPointerReleaseOptions["resolvePointer"] = () => undefined,
  ready: () => boolean = () => true,
) {
  const f = setup({ ready, subscribe: () => () => {} }, false, { resolvePointer: outer });
  const surface = new Element(f.document),
    paint = new Element(f.document);
  surface.parentElement = f.root;
  paint.parentElement = surface;
  f.button.parentElement = surface;
  f.document.hitTarget = paint;
  let target: HTMLElement | null | undefined = f.element;
  const router = vi.fn(() => target);
  const surfaceOptions: AdaActionOptions = {
    ...f.options,
    click: { ...f.options.click, run: vi.fn() },
    hitTarget: "self",
    nativeClickOwner: "factory",
    resolvePointerTarget: router,
  };
  const fieldBinding = bindAdaAction(surfaceOptions, surface as unknown as HTMLElement);
  const binding = bindAdaAction(f.options, f.element);
  const send = (type: string, eventTarget: Element = paint) => {
    const event = f.event(type, eventTarget);
    if (type === "pointerdown") {
      f.document.dispatchEvent(event);
      f.root.dispatchEvent(event);
    } else if (type === "click") {
      f.root.dispatchEvent(event);
      if (!event.defaultPrevented) {
        eventTarget.dispatchEvent(event);
      }
    } else {
      f.document.dispatchEvent(event);
    }
    return event;
  };
  return {
    ...f,
    binding,
    fieldBinding,
    paint,
    route: () =>
      resolveAdaPointerTarget(
        { physicalTarget: paint as unknown as HTMLElement, root: f.host },
        f.event("pointerdown", paint) as PointerEvent,
      ),
    router,
    send,
    setTarget: (next: HTMLElement | null | undefined) => {
      target = next;
    },
    surface,
    surfaceOptions,
    teardown: () => {
      binding.dispose();
      fieldBinding.dispose();
      f.stop();
    },
  };
}

it("uses the declared same-root field target through the public hold lifecycle without a release duplicate", () => {
  const f = spatialFixture();
  const before = resolveAdaHoldAction(f.host, f.element);
  f.send("pointerdown");
  expect(f.router).toHaveBeenCalledWith(
    { physicalTarget: f.paint },
    expect.objectContaining({ type: "pointerdown" }),
  );
  vi.advanceTimersByTime(530);
  expect(f.run).toHaveBeenCalledOnce();
  f.send("pointerup");
  f.send("click");
  expect(f.run).toHaveBeenCalledOnce();
  expect(f.surfaceOptions.click.run).not.toHaveBeenCalled();
  f.send("pointerdown");
  f.send("pointerup");
  f.send("click");
  expect(f.run).toHaveBeenCalledTimes(2);
  f.router.mockClear();
  const after = resolveAdaHoldAction(f.host, f.element);
  expect(after?.identity).toBe(before?.identity);
  expect(f.router).not.toHaveBeenCalled();
  f.click(0);
  expect(f.run).toHaveBeenCalledTimes(3);
  f.teardown();
});

it.each(["null", "explicit target"])(
  "preserves outer %s precedence without invoking field routing",
  (kind) => {
    let target: HTMLElement | null = null;
    const f = spatialFixture(() => target);
    if (kind === "explicit target") {
      f.button.parentElement = f.root;
      target = f.element;
    }
    f.send("pointerdown");
    vi.advanceTimersByTime(530);
    f.send("pointerup");
    f.send("click");
    expect(f.router).not.toHaveBeenCalled();
    expect(f.run).toHaveBeenCalledTimes(kind === "explicit target" ? 1 : 0);
    f.teardown();
  },
);

it("treats field null as a veto and undefined as native glyph fallback", () => {
  const f = spatialFixture();
  f.setTarget(null);
  expect(f.route()).toBeNull();
  f.send("pointerdown");
  f.send("pointerup");
  f.send("click");
  expect(f.run).not.toHaveBeenCalled();
  expect(f.surfaceOptions.click.run).not.toHaveBeenCalled();
  f.document.hitTarget = f.label;
  f.setTarget(undefined);
  f.down();
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledOnce();
  f.down();
  vi.advanceTimersByTime(530);
  f.up();
  f.click();
  expect(f.run).toHaveBeenCalledTimes(2);
  f.click(0);
  expect(f.run).toHaveBeenCalledTimes(3);
  f.teardown();
});

it.each([
  "foreign",
  "disposed host",
  "nested root",
  "disposed ancestor",
  "stale host",
  "covered",
  "unready",
  "hidden",
  "inert",
  "hidden document",
])("never invokes a %s field router", (kind) => {
  let ready = true;
  const f = spatialFixture(
    () => undefined,
    () => ready,
  );
  let cleanup = () => {};
  if (kind === "foreign") {
    f.surface.parentElement = new Element(f.document);
  }
  if (kind === "disposed host") {
    f.fieldBinding.dispose();
  }
  if (kind === "nested root") {
    cleanup = registerAdaActionRoot({ permits: () => true }, f.surface as unknown as HTMLElement);
  }
  if (kind === "disposed ancestor") {
    f.stop();
  }
  if (kind === "stale host") {
    f.fieldBinding.update({ ...f.surfaceOptions, current: () => false });
  }
  if (kind === "covered") {
    const dialog = new Element(f.document);
    dialog.parentElement = f.root;
    cleanup = enterPressView(f.host, dialog as unknown as HTMLElement);
  }
  if (kind === "unready") {
    ready = false;
  }
  if (kind === "hidden document") {
    f.document.hidden = true;
  }
  if (kind === "hidden") {
    f.surface.hidden = true;
  }
  if (kind === "inert") {
    f.surface.inert = true;
  }
  f.route();
  f.send("pointerdown");
  vi.advanceTimersByTime(530);
  f.send("pointerup");
  f.send("click");
  expect(f.router).not.toHaveBeenCalled();
  expect(f.run).not.toHaveBeenCalled();
  cleanup();
  f.teardown();
});

it.each([
  "outside surface",
  "unregistered glyph",
  "foreign target root",
  "disposed binding",
  "disabled",
  "hidden",
  "inert",
  "detached",
  "stale",
])("rejects a routed target that is %s without native ancestor fallback", (kind) => {
  const f = spatialFixture();
  let cleanup = () => {};
  if (kind === "outside surface") {
    f.button.parentElement = f.root;
  }
  if (kind === "unregistered glyph") {
    f.setTarget(f.label as unknown as HTMLElement);
  }
  if (kind === "foreign target root") {
    cleanup = registerAdaActionRoot({ permits: () => true }, f.element);
  }
  if (kind === "disposed binding") {
    f.binding.dispose();
  }
  if (kind === "disabled") {
    f.button.disabled = true;
  }
  if (kind === "hidden") {
    f.button.hidden = true;
  }
  if (kind === "inert") {
    f.button.inert = true;
  }
  if (kind === "detached") {
    f.button.connected = false;
  }
  if (kind === "stale") {
    f.binding.update({ ...f.options, current: () => false });
  }
  expect(f.route()).toBeNull();
  f.send("pointerdown");
  vi.advanceTimersByTime(530);
  f.send("pointerup");
  f.send("click");
  expect(f.run).not.toHaveBeenCalled();
  cleanup();
  f.teardown();
});

it.each(["timer", "release"])(
  "revalidates the captured original target and binding at %s",
  (stage) => {
    const f = spatialFixture();
    f.send("pointerdown");
    f.binding.dispose();
    const replacement = vi.fn();
    const rebound = bindAdaAction(
      { ...f.options, click: { ...f.options.click, run: replacement } },
      f.element,
    );
    if (stage === "timer") {
      vi.advanceTimersByTime(530);
    }
    f.send("pointerup");
    f.send("click");
    expect(f.run).not.toHaveBeenCalled();
    expect(replacement).not.toHaveBeenCalled();
    f.send("pointerdown");
    f.send("pointerup");
    f.send("click");
    expect(replacement).toHaveBeenCalledOnce();
    rebound.dispose();
    f.teardown();
  },
);

it.each(["timer", "release"])("does not substitute another logical element before %s", (stage) => {
  const f = spatialFixture();
  const other = new Element(f.document);
  other.parentElement = f.surface;
  const run = vi.fn();
  const otherBinding = bindAdaAction(
    { ...f.options, click: { ...f.options.click, run } },
    other as unknown as HTMLElement,
  );
  f.send("pointerdown");
  f.setTarget(other as unknown as HTMLElement);
  if (stage === "timer") {
    vi.advanceTimersByTime(530);
  }
  f.send("pointerup");
  f.send("click");
  expect(f.run).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
  f.send("pointerdown");
  f.send("pointerup");
  expect(run).toHaveBeenCalledOnce();
  otherBinding.dispose();
  f.teardown();
});

it("revalidates host lifetime after a router disposes its own binding", () => {
  const f = spatialFixture();
  f.router.mockImplementation(() => {
    f.fieldBinding.dispose();
    return f.element;
  });
  expect(f.route()).toBeNull();
  expect(f.run).not.toHaveBeenCalled();
  f.teardown();
});

it("uses current routing and action callbacks while retaining the same target identity", () => {
  const f = spatialFixture();
  f.send("pointerdown");
  const route = vi.fn(() => f.element),
    newer = vi.fn();
  f.fieldBinding.update({ ...f.surfaceOptions, resolvePointerTarget: route });
  f.binding.update({ ...f.options, click: { ...f.options.click, run: newer } });
  vi.advanceTimersByTime(530);
  f.send("pointerup");
  f.send("click");
  expect(newer).toHaveBeenCalledOnce();
  expect(f.run).not.toHaveBeenCalled();
  expect(route).toHaveBeenCalled();
  f.teardown();
});

it("resolves the registered surface itself as the empty-field action without adding a native click owner", () => {
  const f = spatialFixture();
  f.setTarget(f.surface as unknown as HTMLElement);
  f.send("pointerdown");
  f.send("pointerup");
  f.send("click");
  expect(f.surfaceOptions.click.run).toHaveBeenCalledOnce();
  f.send("pointerdown");
  vi.advanceTimersByTime(530);
  f.send("pointerup");
  f.send("click");
  expect(f.surfaceOptions.click.run).toHaveBeenCalledTimes(2);
  expect(f.run).not.toHaveBeenCalled();
  f.teardown();
});

it("does not consult an ancestor surface after the nearest declared host becomes stale", () => {
  const f = spatialFixture();
  const outerRouter = vi.fn(() => f.element);
  const outer = bindAdaAction({ ...f.surfaceOptions, resolvePointerTarget: outerRouter }, f.host);
  f.fieldBinding.update({ ...f.surfaceOptions, current: () => false });
  expect(f.route()).toBeUndefined();
  expect(f.router).not.toHaveBeenCalled();
  expect(outerRouter).not.toHaveBeenCalled();
  outer.dispose();
  f.teardown();
});

it("keeps the existing native click owner when the pointer route accepted no gesture", () => {
  const f = spatialFixture();
  f.document.hitTarget = f.label;
  f.setTarget(null);
  f.down();
  f.up();
  expect(f.run).not.toHaveBeenCalled();
  f.click();
  expect(f.run).toHaveBeenCalledOnce();
  f.teardown();
});
