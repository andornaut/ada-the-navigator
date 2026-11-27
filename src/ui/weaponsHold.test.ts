import { afterEach, expect, it, vi } from "vitest";

import { bindAdaAction } from "./actionBinding.ts";
import { bindAdaHoldActions } from "./holdActionsAdapter.ts";
import { rootPressGuard } from "./pressScope.ts";
import { createWeaponSelector, type WeaponLabels } from "./weapons.ts";
let activeDocument: FixtureDocument;
const disposers: (() => void)[] = [];
class Element extends EventTarget {
  constructor(readonly tag = "div") {
    super();
  }

  parentElement: Element | null = null;
  connected = true;
  inert = false;
  get isConnected(): boolean {
    return this.connected && (this.parentElement?.isConnected ?? true);
  }
  get ownerDocument() {
    return activeDocument;
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
      const value = part.trim();
      return value === this.tag || (value === ":disabled" && this.disabled);
    });
  }
  closest(): Element | null {
    return this.hidden || this.inert ? this : (this.parentElement?.closest() ?? null);
  }
  disabled = false;
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly style = { opacity: "", setProperty: vi.fn() };
  textContent = "";
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parentElement = this;
    }
    this.children.push(...nodes);
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((node) => [
      ...(node.matches(selector) ? [node] : []),
      ...node.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): Element | null {
    return this.children.find((node) => node.className === selector.slice(1)) ?? null;
  }
  remove() {
    this.connected = false;
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
    }
    this.parentElement = null;
  }
  replaceChildren(...nodes: Element[]) {
    this.children = nodes;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class FixtureDocument extends EventTarget {
  createElement(tag: string) {
    return new Element(tag);
  }
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
}

const labels: WeaponLabels = {
  ammo: "{weapon}, {count} left",
  group: "Weapons",
  names: {
    heavyMissile: "Heavy Missile",
    laser: "Laser",
    multiLaser: "Multi-Laser",
    phaser: "Phaser",
    rapidMissile: "Rapid Missile",
    scattershot: "Scattershot",
  },
};

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(withOverride = true) {
  vi.useFakeTimers();
  activeDocument = new FixtureDocument();
  vi.stubGlobal("document", activeDocument);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const host = new Element();
  const stop = bindAdaHoldActions(
    rootPressGuard(host as unknown as HTMLElement),
    host as unknown as HTMLElement,
  );
  disposers.push(stop);
  const onHold = vi.fn();
  const onSelect = vi.fn(() => false);
  const selector = createWeaponSelector(host as unknown as HTMLElement, {
    labels,
    ...(withOverride ? { onHold } : {}),
    onSelect,
    reducedMotion: () => false,
  });
  const choices = [{ ammo: null, id: "laser", level: 2, selected: true }] as const;
  const before = JSON.stringify(choices);
  selector.setWeapons(choices);
  selector.setEnabled(true);
  const button = host.children[0]!.children[0]!;
  const event = (type: string, extra = {}) => {
    const result = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: type === "click" ? 1 : 0,
      isPrimary: true,
      pointerId: 3,
      target: button,
      ...extra,
    })) {
      Object.defineProperty(result, key, { value });
    }
    return result;
  };
  const down = (target = button) => {
    activeDocument.dispatchEvent(event("pointerdown", { target }));
    host.dispatchEvent(event("pointerdown", { target }));
    target.dispatchEvent(event("pointerdown", { target }));
  };
  const up = () => activeDocument.dispatchEvent(event("pointerup"));
  const click = (detail = 1) => {
    const result = event("click", { detail });
    host.dispatchEvent(result);
    if (!result.defaultPrevented) {
      button.dispatchEvent(event("click", { detail }));
    }
    return result;
  };
  return {
    before,
    button,
    choices,
    click,
    down,
    event,
    host,
    onHold,
    onSelect,
    selector,
    stop,
    up,
  };
}
it("short tap selects but a published half-second hold opens current details and consumes only its release", () => {
  const f = setup();
  f.down();
  vi.advanceTimersByTime(499);
  expect(f.onHold).not.toHaveBeenCalled();
  f.up();
  expect(f.click().defaultPrevented).toBe(false);
  expect(f.onSelect).toHaveBeenCalledOnce();
  f.onSelect.mockClear();
  f.down();
  f.selector.setWeapons([{ ammo: null, id: "laser", level: 3, selected: true }]);
  vi.advanceTimersByTime(500);
  expect(f.onHold).toHaveBeenCalledExactlyOnceWith(
    { ammo: null, id: "laser", level: 3, selected: true },
    f.button,
  );
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(f.onSelect).not.toHaveBeenCalled();
  expect(f.click(0).defaultPrevented).toBe(false);
  expect(f.onSelect).toHaveBeenCalledExactlyOnceWith("laser");
  expect(JSON.stringify(f.choices)).toBe(f.before);
  f.selector.dispose();
  f.stop();
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels through the shared guard on drag, cancel, leave, disable/re-enable, keyboard, blur and disposal", () => {
  for (const cancel of [
    "drag",
    "pointerleave",
    "pointercancel",
    "disabled",
    "keyboard",
    "blur",
    "dispose",
    "removed",
  ]) {
    const f = setup();
    f.down();
    vi.advanceTimersByTime(300);
    if (cancel === "disabled") {
      f.selector.setEnabled(false);
      f.selector.setEnabled(true);
    } else if (cancel === "removed") {
      f.selector.setWeapons([]);
    } else if (cancel === "dispose") {
      f.selector.dispose();
    } else if (cancel === "keyboard") {
      f.button.dispatchEvent(new Event("keydown"));
    } else if (cancel === "blur") {
      activeDocument.defaultView.dispatchEvent(new Event("blur"));
    } else if (cancel === "drag") {
      activeDocument.dispatchEvent(f.event("pointermove", { clientX: 20 }));
    } else if (cancel === "pointerleave") {
      f.host.dispatchEvent(f.event(cancel));
    } else {
      activeDocument.dispatchEvent(f.event(cancel));
    }
    vi.advanceTimersByTime(500);
    expect(f.onHold, cancel).not.toHaveBeenCalled();
    expect(f.onSelect, cancel).not.toHaveBeenCalled();
    f.selector.dispose();
    f.stop();
  }
});

it("does not interrupt another UI action when an already disabled weapon group is refreshed", () => {
  const f = setup();
  f.selector.setEnabled(false);
  const menu = new Element();
  f.host.append(menu);
  const run = vi.fn();
  const binding = bindAdaAction(
    {
      click: { availability: () => ({ kind: "available" }), run },
      current: () => true,
      slopPx: () => 8,
    },
    menu as unknown as HTMLElement,
  );
  f.down(menu);
  vi.advanceTimersByTime(200);
  f.selector.setEnabled(false);
  vi.advanceTimersByTime(300);
  expect(run).toHaveBeenCalledOnce();
  expect(f.onHold).not.toHaveBeenCalled();
  binding.dispose();
  f.selector.dispose();
  f.stop();
});

it("falls back to ordinary weapon selection exactly once when no Details override is supplied", () => {
  const f = setup(false);
  f.down();
  vi.advanceTimersByTime(500);
  expect(f.onSelect).toHaveBeenCalledExactlyOnceWith("laser");
  expect(f.onHold).not.toHaveBeenCalled();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(f.onSelect).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(f.choices)).toBe(f.before);
  f.selector.dispose();
  f.stop();
});

it("keeps the covered weapon group painted without accepting a held or released action", () => {
  const f = setup();
  f.selector.setShown(true);
  f.selector.setEnabled(false);
  expect(f.host.children[0]!.hidden).toBe(false);
  f.down();
  vi.advanceTimersByTime(600);
  f.up();
  f.click();
  expect(f.onSelect).not.toHaveBeenCalled();
  expect(f.onHold).not.toHaveBeenCalled();
  f.selector.setShown(false);
  expect(f.host.children[0]!.hidden).toBe(true);
  f.selector.setEnabled(true);
  expect(f.host.children[0]!.hidden).toBe(true);
  f.selector.setShown(true);
  f.down();
  f.up();
  f.click();
  expect(f.onSelect).toHaveBeenCalledOnce();
});

it("removes a newly constructed weapon when its action root has been retired", () => {
  const f = setup();
  f.stop();
  expect(() =>
    f.selector.setWeapons([
      ...f.choices,
      { ammo: 10, id: "rapidMissile", level: 1, selected: false },
    ]),
  ).toThrow("Discrete action control has no live action root");
  expect(f.host.children[0]!.children).toEqual([f.button]);
  expect(f.onHold).not.toHaveBeenCalled();
  expect(f.onSelect).not.toHaveBeenCalled();
  f.selector.dispose();
});
