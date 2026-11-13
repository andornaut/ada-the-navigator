import { afterEach, describe, expect, it, vi } from "vitest";

import { createWeaponSelector, type WeaponLabels } from "./weapons.ts";

class Element {
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly style = { opacity: "", setProperty: vi.fn() };
  textContent = "";
  addEventListener() {}
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
afterEach(() => vi.unstubAllGlobals());

describe("weapon refill presentation", () => {
  it("shows +actual added beside only the matching weapon, coalesces, pauses and clears", () => {
    vi.stubGlobal("document", { createElement: () => new Element() });
    const host = new Element();
    const selector = createWeaponSelector(host as unknown as HTMLElement, {
      labels,
      onSelect: () => false,
      reducedMotion: () => false,
    });
    selector.setWeapons([
      { ammo: 99, id: "phaser", level: 1, selected: false },
      { ammo: 10, id: "rapidMissile", level: 1, selected: true },
    ]);
    selector.setEnabled(true);
    const buttons = host.children[0]!.children;
    const gain = buttons[0]!.querySelector(".ada-ammo-gain")!;
    const other = buttons[1]!.querySelector(".ada-ammo-gain")!;
    selector.showAmmoGain("phaser", 1);
    selector.showAmmoGain("phaser", 2);
    selector.updateFeedback(0, true);
    expect(gain.hidden).toBe(false);
    expect(gain.textContent).toBe("+3");
    expect(gain.attributes.get("aria-label")).toBe("Phaser +3");
    expect(other.hidden).toBe(true);
    expect(buttons[0]!.querySelector(".ada-ammo")!.textContent).toBe("99");
    expect(buttons[0]!.attributes.get("aria-pressed")).toBe("false");
    selector.updateFeedback(100, false);
    expect(gain.hidden).toBe(true);
    selector.updateFeedback(10000, false);
    selector.updateFeedback(10000, true);
    expect(gain.hidden).toBe(false);
    expect(gain.textContent).toBe("+3");
    selector.updateFeedback(11200, true);
    expect(gain.hidden).toBe(true);
    selector.showAmmoGain("rapidMissile", 4);
    selector.updateFeedback(11200, true);
    expect(other.textContent).toBe("+4");
    selector.clearFeedback();
    expect(other.hidden).toBe(true);
    expect(other.textContent).toBe("");
    selector.dispose();
  });
});
