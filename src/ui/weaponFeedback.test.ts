import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureActionRoot } from "./actions/actionRootFixture.ts";
import { createWeaponSelector, type WeaponLabels } from "./weapons.ts";

class Element extends EventTarget {
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }

  get ownerDocument() {
    return document;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  parentElement: Element | null = null;
  isConnected = true;
  className = "";
  readonly classList = {
    add: (name: string) => {
      this.className = [...new Set([...this.className.split(/\s+/u).filter(Boolean), name])].join(
        " ",
      );
    },
    contains: (name: string) => this.className.split(/\s+/u).includes(name),
    remove: (name: string) => {
      this.className = this.className
        .split(/\s+/u)
        .filter((part) => part !== name)
        .join(" ");
    },
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  private readonly properties = new Map<string, string>();
  readonly style = {
    getPropertyValue: (name: string) => this.properties.get(name) ?? "",
    opacity: "",
    removeProperty: (name: string) => this.properties.delete(name),
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  };
  textContent = "";
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parentElement = this;
    }
    this.children.push(...nodes);
  }
  matches(selector: string) {
    return selector.split(",").some((part) => part.trim() === this.tag);
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((node) => [
      ...(node.matches(selector) ? [node] : []),
      ...node.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): Element | null {
    return this.children.find((node) => node.classList.contains(selector.slice(1))) ?? null;
  }
  remove() {}
  replaceChildren(...nodes: Element[]) {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, value: boolean) {
    if (value) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
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
  it.each([
    [false, 600, 750],
    [true, 750, 825],
  ])(
    "shows the actual gain, pauses and fades with reduced motion %s",
    (reduced, hold, halfFade) => {
      vi.stubGlobal("document", { createElement: (tag: string) => new Element(tag) });
      const host = fixtureActionRoot(new Element());
      const selector = createWeaponSelector(host as unknown as HTMLElement, {
        labels,
        onSelect: () => false,
        reducedMotion: () => reduced,
      });
      selector.setWeapons([
        { ammo: 99, id: "phaser", level: 1, selected: false },
        { ammo: 10, id: "rapidMissile", level: 1, selected: true },
      ]);
      selector.setEnabled(true);
      const buttons = host.children[0]!.children[0]!.children;
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
      selector.updateFeedback(10000 + hold, true);
      expect(gain.style.opacity).toBe("1");
      selector.updateFeedback(10000 + halfFade, true);
      expect(gain.style.opacity).toBe("0.5");
      selector.updateFeedback(10900, true);
      expect(gain.hidden).toBe(true);
      selector.showAmmoGain("rapidMissile", 4);
      selector.updateFeedback(10900, true);
      expect(other.textContent).toBe("+4");
      selector.clearFeedback();
      expect(other.hidden).toBe(true);
      expect(other.textContent).toBe("");
      selector.dispose();
    },
  );
});
