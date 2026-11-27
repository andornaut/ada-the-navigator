import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import * as actionBinding from "./actionBinding.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import {
  aboardLabel,
  disposeShipSections,
  renderShipSections,
  shipItemKey,
  shipSections,
  type ShipView,
} from "./shipCard.ts";

const LABELS = CONTENT.labels;

const VIEW: ShipView = {
  aboard: null,
  engine: 2,
  holodisks: 3,
  ore: 12_500,
  paint: "Sky blue",
  shield: 1,
  stardust: 1_234_567,
  tractor: 3,
  weapons: [
    { ammo: null, id: "laser", level: 2 },
    { ammo: 42, id: "rapidMissile", level: 1 },
  ],
};

const labels = (rows: readonly { readonly label: string }[]) => rows.map(({ label }) => label);

describe("Ship card", () => {
  it("uses the canonical empty cargo copy in both existing status templates", () => {
    expect(aboardLabel(LABELS, { kind: "carrying", name: LABELS.shipNothing! })).toBe(
      "Carrying: Nothing",
    );
    expect(aboardLabel(LABELS, { kind: "towing", name: LABELS.shipNothing! })).toBe(
      "Towing: Nothing",
    );
  });

  it("fills canonical upgrade, weapon and chapter totals in parameterized labels", () => {
    const sections = shipSections(
      { ...LABELS, shipHolodiskCount: "{n} of {total}", shipLevel: "Level {n} of {max}" },
      VIEW,
    );
    expect(sections.equipment[0].slice(0, 3).map((row) => row.level)).toEqual([
      "Level 2 of 3",
      "Level 1 of 3",
      "Level 3 of 3",
    ]);
    expect(sections.equipment[1][0]!.level).toBe("Level 2 of 3");
    expect(sections.cargo[2]).toMatchObject({ count: "3 of 6", label: "Holodisks" });
  });

  it("lists Stardust and ore with exact grouped counts, then the holodisks, under Cargo", () => {
    const { cargo } = shipSections(LABELS, VIEW);
    expect(labels(cargo)).toEqual(["Stardust", "Ore", "Holodisks", "Carrying", "Towing"]);
    expect(cargo.map((row) => row.count)).toEqual([
      "1,234,567",
      "12,500",
      "3 of 6",
      "Nothing",
      "Nothing",
    ]);
    expect(cargo.map((row) => row.icon)).toEqual([
      { frames: 1, sprite: "icon-stardust-20" },
      { frames: 1, sprite: "icon-ore-20" },
      { frames: 1, sprite: "icon-holodisk-20" },
      { frames: 1, sprite: "icon-cargo-20" },
      { frames: 1, sprite: "icon-tow-20" },
    ]);
  });

  it("adds what Ada carries or tows last, with its own icon", () => {
    const carrying = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "carrying", name: "Spare parts" },
    }).cargo.at(-2);
    expect(carrying).toEqual({
      count: "Spare parts",
      icon: { frames: 1, sprite: "icon-cargo-20" },
      item: { id: "aboard", kind: "cargo" },
      label: "Carrying",
    });
    const towing = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "towing", name: "Sleepy Tug" },
    }).cargo.at(-1);
    expect(towing).toEqual({
      count: "Sleepy Tug",
      icon: { frames: 1, sprite: "icon-tow-20" },
      item: { id: "aboard", kind: "cargo" },
      label: "Towing",
    });
  });

  it("retains the supplied cargo quest identity independently of its visible name", () => {
    const row = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "carrying", name: "A different visible label" },
      aboardQuestId: "live-held-job",
    }).cargo.at(-2)!;
    expect(row.questId).toBe("live-held-job");
    expect(row).toMatchObject({ count: "A different visible label", label: "Carrying" });
    expect(shipSections(LABELS, VIEW).cargo.every((row) => !row.questId)).toBe(true);
  });

  it("lists simultaneous distinct cargo identities and towing with exact live quest links", () => {
    const view = {
      ...VIEW,
      aboard: { kind: "towing" as const, name: "Legacy tow" },
      carrying: [
        { id: "story-item:1:map", name: "Supplies", questId: "story:1:held" },
        { id: "job:1:delivery", name: "Supplies", questId: "job:1:delivery" },
        { id: "story-item:1:map", name: "Duplicate", questId: "not-used" },
      ],
      towing: { id: "job:1:rescue", name: "Sleepy Tug", questId: "job:1:rescue" },
    };
    const before = structuredClone(view);
    const rows = shipSections(LABELS, view).cargo.slice(3);
    expect(rows.map(({ count, label }) => [label, count])).toEqual([
      ["Carrying", "Supplies"],
      ["Carrying", "Supplies"],
      ["Towing", "Sleepy Tug"],
    ]);
    expect(rows.map(({ item }) => shipItemKey(item))).toEqual([
      "cargo:carrying:story-item:1:map",
      "cargo:carrying:job:1:delivery",
      "cargo:towing:job:1:rescue",
    ]);
    expect(rows.map(({ questId }) => questId)).toEqual([
      "story:1:held",
      "job:1:delivery",
      "job:1:rescue",
    ]);
    expect(view).toEqual(before);
  });

  it("uses independent empty facts rather than the HUD fallback priority", () => {
    const rows = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "carrying", name: "HUD only" },
      carrying: [],
      towing: null,
    }).cargo.slice(3);
    expect(rows.map(({ count, label }) => [label, count])).toEqual([
      ["Carrying", "Nothing"],
      ["Towing", "Nothing"],
    ]);
    expect(rows.map(({ item }) => shipItemKey(item))).toEqual([
      "cargo:carrying:empty",
      "cargo:towing:empty",
    ]);
    expect(rows.every((row) => row.interactive === false && row.questId === undefined)).toBe(true);
  });

  it("keeps the systems and paint data with Engine first, and weapons in HUD order", () => {
    const [left, right] = shipSections(LABELS, VIEW).equipment;
    expect(labels(left)).toEqual(["Engine", LABELS.shield, LABELS.tractorBeam, "Sky blue paint"]);
    expect(left.map((row) => row.level)).toEqual([
      "Level 2 of 3",
      "Level 1 of 3",
      "Level 3 of 3",
      undefined,
    ]);
    expect(left.map(({ icon }) => icon)).toEqual([
      { vector: uiIconUrl("icon-shop-engine-tuning") },
      { vector: uiIconUrl("icon-shop-shield") },
      { vector: uiIconUrl("icon-shop-tractor-beam") },
      { vector: uiIconUrl("icon-shop-ship-paint") },
    ]);
    expect(right.map((row) => row.level)).toEqual(["Level 2 of 3", "Level 1 of 3"]);
    expect(right.map((row) => "mask" in row.icon)).toEqual([true, true]);
  });

  it("uses the selected paint swatch and falls back to the equipment icon", () => {
    const swatch = "/material/obsidian.svg";
    const view = { ...VIEW, paint: "Obsidian", paintSwatch: swatch };
    const paint = shipSections(LABELS, view).equipment[0].at(-1);
    expect(paint).toEqual({
      actionLabel: "(Click to change)",
      icon: { vector: swatch },
      item: { id: "paint", kind: "equipment" },
      label: "Obsidian paint",
    });
    expect(shipSections(LABELS, VIEW).equipment[0].at(-1)?.icon).toEqual({
      vector: uiIconUrl("icon-shop-ship-paint"),
    });
  });

  it("gives every weapon an ammunition cell, empty for the one without ammunition", () => {
    const [, right] = shipSections(LABELS, VIEW).equipment;
    expect(right.map((row) => row.ammo)).toEqual(["", "42"]);
  });

  it("reads the aboard line the same for the card and the pill", () => {
    expect(aboardLabel(LABELS, { kind: "carrying", name: "Holo-map" })).toBe("Carrying: Holo-map");
    expect(aboardLabel(LABELS, { kind: "towing", name: "Sleepy Tug" })).toBe("Towing: Sleepy Tug");
  });
});

// Only the element members used by the Ship renderer; geometry is checked in browser captures.
class ShipElement extends EventTarget {
  parentElement: ShipElement | null = null;
  attached = false;
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.attached;
  }
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }
  matches(selector: string): boolean {
    return selector === ":disabled"
      ? Boolean((this as unknown as HTMLButtonElement).disabled)
      : this.tag === "button" ||
          this.attributes.has("data-action") ||
          this.attributes.get("role") === "button";
  }
  querySelectorAll(selector: string): ShipElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  get ownerDocument() {
    return document;
  }
  closest(): ShipElement | null {
    return this.parentElement?.closest() ?? null;
  }
  contains(target: unknown): boolean {
    return (
      target === this ||
      (target instanceof ShipElement &&
        Boolean(target.parentElement) &&
        this.contains(target.parentElement))
    );
  }
  readonly classList = { add: vi.fn(), remove: vi.fn() };
  get parentNode() {
    return this.parentElement;
  }
  get firstElementChild(): ShipElement | null {
    return this.children[0] ?? null;
  }
  get nextSibling(): ShipElement | null {
    const siblings = this.parentElement?.children;
    return siblings?.[siblings.indexOf(this) + 1] ?? null;
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  insertBefore(node: ShipElement, before: ShipElement | null) {
    node.remove();
    node.parentElement = this;
    const index = before ? this.children.indexOf(before) : this.children.length;
    this.children.splice(index, 0, node);
    return node;
  }
  replaceChildren(...nodes: ShipElement[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  toggleAttribute(name: string, enabled: boolean): void {
    if (enabled) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
  children: ShipElement[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style = {
    background: "",
    getPropertyValue: () => "",
    removeProperty: vi.fn(),
    setProperty: vi.fn(),
  };
  textContent = "";
  append(...nodes: ShipElement[]): void {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function rendered(sections: ReturnType<typeof shipSections>): ShipElement {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new ShipElement(tag),
    createElementNS: () => new ShipElement(),
    defaultView: { HTMLElement: ShipElement, Node: ShipElement },
  });
  return renderShipSections(
    { ammo: LABELS.ammo!, cargo: "Cargo", equipment: "Equipment", weapons: LABELS.shopWeapons! },
    sections,
  ) as unknown as ShipElement;
}

const rowText = (row: ShipElement) => row.children[1]!.children.map((part) => part.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Ship sections rendering", () => {
  it("places Cargo, Equipment and Weapons in three columns with shared dividers", () => {
    const root = rendered(shipSections(LABELS, VIEW));
    expect(root.children).toHaveLength(5);
    const sections = root.children.filter((node) => node.dataset.section);
    expect(sections.map((node) => node.dataset.section)).toEqual(["cargo", "equipment", "weapons"]);
    expect(sections.map((node) => node.children[0]!.textContent)).toEqual([
      "Cargo",
      "Equipment",
      "Weapons",
    ]);
    expect(root.children.filter((node) => !node.dataset.section)).toHaveLength(2);
    expect(sections[1]!.children[1]!.children.map((row) => rowText(row)[0])).toEqual([
      "Engine [2]",
      LABELS.shield,
      `${LABELS.tractorBeam} [3]`,
      "Sky blue paint",
    ]);
    expect(sections[0]!.children[1]!.children.map(rowText)).toEqual([
      ["Stardust", "1,234,567"],
      ["Ore", "12,500"],
      ["Holodisks", "3 of 6"],
      ["Carrying", "Nothing"],
      ["Towing", "Nothing"],
    ]);
  });

  it("renders the swatch and the complete hint in the same accessible paint button", () => {
    const swatch = "/material/obsidian.svg";
    const root = rendered(
      shipSections(LABELS, { ...VIEW, paint: "Obsidian", paintSwatch: swatch }),
    );
    const rows = root.children[2]!.children[1]!.children;
    const paint = rows.at(-1)!;
    expect(rows.filter(({ dataset }) => dataset.item === "equipment:paint")).toEqual([paint]);
    expect(paint.attributes.get("aria-label")).toBe("Obsidian paint (Click to change)");
    expect(rowText(paint)).toEqual(["Obsidian paint"]);
    expect(paint.children[1]!.children[0]!.children[0]!.textContent).toBe("(Click to change)");
    expect(paint.children[0]!.style.background).toContain(swatch);
    expect(paint.children[0]!.attributes.get("aria-hidden")).toBe("true");
  });

  it.each([1, 2, 3])(
    "shows compact level %s names, full accessible levels and separate ammunition",
    (level) => {
      const root = rendered(
        shipSections(LABELS, {
          ...VIEW,
          engine: level,
          shield: level,
          tractor: level,
          weapons: [{ ammo: 42, id: "rapidMissile", level }],
        }),
      );
      const equipment = root.children[2]!.children[1]!.children;
      const weapon = root.children[4]!.children[1]!.children[0]!;
      const suffix = level === 1 ? "" : ` [${level}]`;
      expect(equipment.slice(0, 3).map((row) => rowText(row)[0])).toEqual([
        `Engine${suffix}`,
        `${LABELS.shield}${suffix}`,
        `${LABELS.tractorBeam}${suffix}`,
      ]);
      expect(rowText(weapon)).toEqual([`Rapid Missile${suffix}`, "42"]);
      for (const row of [...equipment.slice(0, 3), weapon]) {
        expect(row.attributes.get("aria-label")).toContain(`Level ${level} of 3`);
        expect(row.dataset.level).toBe(String(level));
        expect(rowText(row).join(" ")).not.toMatch(/Level|LVL|of 3/);
      }
    },
  );

  it("retains long cargo and named empty lists without adding copy or removing headings", () => {
    const sections = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "carrying", name: "A very long cargo name that must wrap" },
      weapons: [],
    });
    const root = rendered(sections);
    expect(root.children[4]!.children[0]!.textContent).toBe("Weapons");
    expect(root.children[4]!.children[1]!.children).toHaveLength(0);
    const cargo = root.children[0]!.children[1]!;
    expect(rowText(cargo.children.at(-2)!)).toEqual([
      "Carrying",
      "A very long cargo name that must wrap",
    ]);
    const empty = rendered({ ...sections, cargo: [] });
    expect(empty.children[0]!.children[0]!.textContent).toBe("Cargo");
    expect(empty.children[0]!.children[1]!.children).toHaveLength(0);
  });
});

it.each([0, 1, 9999])(
  "shows a finite weapon's %s ammunition as a grouped number without a suffix",
  (ammo) => {
    const section = shipSections(LABELS, {
      ...VIEW,
      weapons: [{ ammo, id: "rapidMissile", level: 1 }],
    });
    expect(section.equipment[1][0]!.ammo).toBe(new Intl.NumberFormat("en-US").format(ammo));
  },
);

it("keeps ammo inside each weapon row without separate oversized ammo rows", () => {
  const root = rendered(shipSections(LABELS, VIEW));
  const weapons = root.children[4]!;
  expect(weapons.children[0]!.textContent).toBe("Weapons");
  expect(weapons.children[1]!.children).toHaveLength(VIEW.weapons.length);
  expect(rowText(weapons.children[1]!.children[1]!)).toEqual(["Rapid Missile", "42"]);
});

it("keeps canonical detail identities when display labels collide or change", () => {
  const rows = shipSections({ ...LABELS, engine: "Same", ore: "Same", stardust: "Same" }, VIEW);
  expect(rows.cargo.slice(0, 2).map(({ item }) => shipItemKey(item))).toEqual([
    "resource:stardust",
    "resource:ore",
  ]);
  expect(rows.equipment[0].map(({ item }) => shipItemKey(item))).toEqual([
    "equipment:engine",
    "equipment:shield",
    "equipment:tractor",
    "equipment:paint",
  ]);
  expect(rows.equipment[1].map(({ item }) => shipItemKey(item))).toEqual(
    VIEW.weapons.map(({ id }) => `weapon:${id}`),
  );
  expect(rows.cargo.every(({ tier }) => tier === undefined)).toBe(true);
  expect(rows.equipment[0].at(-1)?.tier).toBeUndefined();
});

it("routes clickable inventory identities without reading labels", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new ShipElement(tag),
    createElementNS: () => new ShipElement(),
    defaultView: { HTMLElement: ShipElement, Node: ShipElement },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const onItem = vi.fn();
  const sections = shipSections(LABELS, VIEW);
  const root = renderShipSections(
    { ammo: "Ammo", cargo: "Cargo", equipment: "Equipment", weapons: "Weapons" },
    sections,
    onItem,
  ) as unknown as ShipElement;
  root.remove();
  root.attached = true;
  fixtureActionRoot(root);
  const row = root.children[4]!.children[1]!.children[0]!;
  expect(row.children).toHaveLength(2);
  expect(row.attributes.get("aria-label")).toContain("Laser");
  const click = () => row.dispatchEvent(new Event("click", { cancelable: true }));
  click();
  expect(onItem).toHaveBeenCalledExactlyOnceWith(sections.equipment[1][0], row);
  expect(onItem.mock.calls[0]?.[0]).toBe(sections.equipment[1][0]);
  const paint = root.children[2]!.children[1]!.children.at(-1)!;
  const hold = resolveAdaHoldAction(root as unknown as HTMLElement, paint);
  expect(hold?.available()).toBe(true);
  hold!.activate();
  expect(onItem).toHaveBeenLastCalledWith(
    expect.objectContaining({ item: { id: "paint", kind: "equipment" } }),
    paint,
  );
  disposeShipSections(root as unknown as HTMLElement);
  click();
  expect(hold?.available()).toBe(false);
  hold!.activate();
  expect(onItem).toHaveBeenCalledTimes(2);
});

it("keeps both empty status rows inert for click and registered hold activation", () => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new ShipElement(tag),
    createElementNS: () => new ShipElement(),
    defaultView: { HTMLElement: ShipElement, Node: ShipElement },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const onItem = vi.fn();
  const root = renderShipSections(
    { ammo: "Ammo", cargo: "Cargo", equipment: "Equipment", weapons: "Weapons" },
    shipSections(LABELS, { ...VIEW, carrying: [], towing: null }),
    onItem,
  ) as unknown as ShipElement;
  root.remove();
  root.attached = true;
  fixtureActionRoot(root);
  const rows = root.children[0]!.children[1]!.children.slice(3);
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect((row as unknown as HTMLButtonElement).disabled).toBe(true);
    expect((row as unknown as HTMLButtonElement).tabIndex).toBe(-1);
    row.dispatchEvent(new Event("click"));
    resolveAdaHoldAction(root as unknown as HTMLElement, row)?.activate();
  }
  expect(onItem).not.toHaveBeenCalled();
  disposeShipSections(root as unknown as HTMLElement);
});

it("audits completed detached Ship rows and rejects a missing semantic binding", () => {
  rendered(shipSections(LABELS, VIEW));
  const bind = vi.spyOn(actionBinding, "bindAdaAction").mockImplementationOnce(() => ({
    activate: () => false,
    dispose() {},
    update() {},
  }));
  expect(() => rendered(shipSections(LABELS, VIEW))).toThrow("no registered action binding");
  expect(bind).toHaveBeenCalled();
});

it("audits detached empty Ship status rows without invoking runtime policy", () => {
  const original = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw Error("construction evaluated runtime policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
    original(
      { ...options, click: { ...options.click, availability: policy }, current: policy },
      element,
    ),
  );
  const root = rendered(shipSections(LABELS, { ...VIEW, carrying: [], towing: null }));
  expect(root.isConnected).toBe(false);
  expect(policy).not.toHaveBeenCalled();
  disposeShipSections(root as unknown as HTMLElement);
});
