import { afterEach, expect, it, vi } from "vitest";

import * as actionBinding from "./actionBinding.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { activateNavigation, createNavigationButton } from "./navigationButton.ts";
import { createPauseButton } from "./pauseButton.ts";
import { enterPressView } from "./pressScope.ts";
class Element extends EventTarget {
  dataset: Record<string, string> = {};
  className = "";
  readonly children: Element[] = [];
  append(child: Element) {
    child.parentElement = this;
    this.children.push(child);
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  parentElement: Element | null = null;
  hidden = false;
  inert = false;
  disabled = false;
  connected = false;
  readonly attributes = new Map<string, string>();
  readonly ownerDocument: FixtureDocument;
  readonly tag: string;
  constructor(ownerDocument: FixtureDocument, tag = "div") {
    super();
    this.ownerDocument = ownerDocument;
    this.tag = tag;
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.connected;
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
    return selector.split(",").some((part) => {
      const key = part.trim();
      return (
        key === this.tag ||
        (key === ":disabled" && this.disabled) ||
        (key === "[data-action]" && this.dataset.action !== undefined)
      );
    });
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
  createElement(tag: string) {
    return new Element(this, tag);
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
  root.connected = true;
  let pausable = true;
  const pause = vi.fn();
  const menu = vi.fn();
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
  const navigation = createNavigationButton(
    root as unknown as HTMLElement,
    { menu: "Menu", pause: "Pause" },
    () => activateNavigation({ mapOpen: false, menu, pausable, pause }, navigation.button),
  );
  const button = navigation.button as unknown as Element;
  button.hidden = false;
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
  const dialog = new Element(document);
  root.append(dialog);
  const leave = enterPressView(root as unknown as HTMLElement, dialog as unknown as HTMLElement);
  down();
  vi.advanceTimersByTime(500);
  expect(menu).toHaveBeenCalledOnce();
  leave();
  const keyboard = new Event("click");
  button.dispatchEvent(keyboard);
  expect(menu).toHaveBeenCalledTimes(2);
  const remove = vi.spyOn(button, "removeEventListener");
  navigation.dispose();
  for (const type of ["click", "pointerdown", "pointerup", "pointercancel", "pointerleave"]) {
    expect(remove).toHaveBeenCalledWith(type, expect.any(Function));
  }
  expect(vi.getTimerCount()).toBe(0);
  button.dispatchEvent(new Event("click"));
  expect(menu).toHaveBeenCalledTimes(2);
  attachment.dispose();
});

it("audits Pause binding metadata before mounting into a detached parent", () => {
  const document = new FixtureDocument();
  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("No art fetch in fixture")));
  const parent = new Element(document);
  const root = parent as unknown as HTMLElement;
  const bind = actionBinding.bindAdaAction;
  const omitBinding = vi
    .spyOn(actionBinding, "bindAdaAction")
    .mockImplementationOnce((options, element) => {
      const binding = bind(options, element);
      binding.dispose();
      return binding;
    });
  try {
    expect(() => createPauseButton(root, "Pause", () => {})).toThrow(
      "no registered action binding",
    );
    expect(parent.children).toHaveLength(0);
  } finally {
    omitBinding.mockRestore();
  }
});

it("rolls back a connected Pause button when the live root audit fails", () => {
  const document = new FixtureDocument();
  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("No art fetch in fixture")));
  const parent = new Element(document);
  parent.connected = true;
  const append = vi.spyOn(parent, "append");
  expect(() => createPauseButton(parent as unknown as HTMLElement, "Pause", () => {})).toThrow(
    "no live action root",
  );
  const button = append.mock.calls[0]![0];
  expect(parent.children).toEqual([]);
  expect(button.parentElement).toBeNull();
  expect(() => actionBinding.assertAdaActionMetadata(button as unknown as HTMLElement)).toThrow(
    "no registered action binding",
  );
});
