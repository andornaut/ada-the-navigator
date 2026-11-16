import { afterEach, expect, it, vi } from "vitest";

import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { activateNavigation, createNavigationButton } from "./navigationButton.ts";
class Element extends EventTarget {
  dataset: Record<string, string> = {};
  className = "";
  append(child: Element) {
    child.parentElement = this;
  }
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
  createElement() {
    return new Element(this);
  }
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => "1" }),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("holds the actual navigation button once and suppresses release click using the shared dispatcher", () => {
  vi.useFakeTimers();
  const document = new FixtureDocument();
  vi.stubGlobal("document", document);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  vi.stubGlobal("fetch", () => Promise.reject(new Error("No art fetch in fixture")));
  const root = new Element(document);
  let pausable = true;
  const pause = vi.fn();
  const menu = vi.fn();
  const navigation = createNavigationButton(
    root as unknown as HTMLElement,
    { menu: "Menu", pause: "Pause" },
    () => activateNavigation({ mapOpen: false, menu, pausable, pause }, navigation.button),
  );
  const button = navigation.button as unknown as Element;
  button.hidden = false;
  let ready = true;
  let requiredChanged = () => {};
  const attachment = bindAdaActionRoot(
    {
      guard: { gate: { accepts: () => true, capture: () => () => true } },
      requiredReady: () => ready,
      subscribeRequired: (changed) => {
        requiredChanged = changed;
        return () => {};
      },
    },
    root as unknown as HTMLElement,
  );
  const event = (type: string) => {
    const e = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
      isPrimary: true,
      pointerId: 7,
      target: button,
    })) {
      Object.defineProperty(e, key, { value });
    }
    return e;
  };
  const down = () => {
    document.dispatchEvent(event("pointerdown"));
    root.dispatchEvent(event("pointerdown"));
  };
  down();
  vi.advanceTimersByTime(500);
  expect(pause).toHaveBeenCalledOnce();
  document.dispatchEvent(event("pointerup"));
  const click = event("click");
  root.dispatchEvent(click);
  if (!click.defaultPrevented) {
    button.dispatchEvent(click);
  }
  expect(click.defaultPrevented).toBe(true);
  expect(pause).toHaveBeenCalledOnce();
  down();
  pausable = false;
  navigation.setMode("menu");
  vi.advanceTimersByTime(500);
  expect(menu).toHaveBeenCalledOnce();
  expect(pause).toHaveBeenCalledOnce();
  document.dispatchEvent(event("pointerup"));
  ready = false;
  requiredChanged();
  down();
  vi.advanceTimersByTime(500);
  expect(menu).toHaveBeenCalledOnce();
  ready = true;
  requiredChanged();
  button.hidden = true;
  down();
  vi.advanceTimersByTime(500);
  expect(menu).toHaveBeenCalledOnce();
  button.hidden = false;
  const keyboard = new Event("click");
  button.dispatchEvent(keyboard);
  expect(menu).toHaveBeenCalledTimes(2);
  navigation.dispose();
  button.dispatchEvent(new Event("click"));
  expect(menu).toHaveBeenCalledTimes(2);
  attachment.dispose();
});
