import { afterEach, expect, it, vi } from "vitest";

import { createWeaponSelector, type WeaponLabels } from "./weapons.ts";
class Element extends EventTarget {
  disabled = false;
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly style = { opacity: "", setProperty: vi.fn() };
  textContent = "";
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
  querySelector(selector: string): Element | null {
    return this.children.find((node) => node.className === selector.slice(1)) ?? null;
  }
  remove() {}
  replaceChildren(...nodes: Element[]) {
    this.children = nodes;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("document", { createElement: () => new Element() });
  const host = new Element();
  const onHold = vi.fn();
  const onSelect = vi.fn(() => false);
  const selector = createWeaponSelector(host as unknown as HTMLElement, {
    labels,
    onHold,
    onSelect,
    reducedMotion: () => false,
  });
  selector.setWeapons([{ ammo: null, id: "laser", level: 2, selected: true }]);
  selector.setEnabled(true);
  const button = host.children[0]!.children[0]!;
  const down = () => {
    const event = new Event("pointerdown", { cancelable: true });
    Object.defineProperty(event, "button", { value: 0 });
    button.dispatchEvent(event);
  };
  return { button, down, onHold, onSelect, selector };
}
it("short tap selects but a half-second hold opens current details without selecting", () => {
  const { button, down, onHold, onSelect, selector } = setup();
  down();
  vi.advanceTimersByTime(499);
  expect(onHold).not.toHaveBeenCalled();
  button.dispatchEvent(new Event("pointerup"));
  button.dispatchEvent(new Event("click"));
  expect(onSelect).toHaveBeenCalledOnce();
  onSelect.mockClear();
  down();
  selector.setWeapons([{ ammo: null, id: "laser", level: 3, selected: true }]);
  vi.advanceTimersByTime(500);
  expect(onHold).toHaveBeenCalledWith(
    { ammo: null, id: "laser", level: 3, selected: true },
    button,
  );
  button.dispatchEvent(new Event("pointerup"));
  button.dispatchEvent(new Event("click"));
  expect(onSelect).not.toHaveBeenCalled();
  selector.dispose();
});
it("cancels pending holds on drag, pointer cancellation, disabled HUD and disposal", () => {
  for (const cancel of ["pointerleave", "pointercancel", "disabled", "dispose"]) {
    const { button, down, onHold, selector } = setup();
    down();
    vi.advanceTimersByTime(300);
    if (cancel === "disabled") {
      selector.setEnabled(false);
    } else if (cancel === "dispose") {
      selector.dispose();
    } else {
      button.dispatchEvent(new Event(cancel));
    }
    vi.advanceTimersByTime(500);
    expect(onHold).not.toHaveBeenCalled();
    selector.dispose();
  }
});
