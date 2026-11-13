import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { aboardLabel, renderShipSections, shipSections, type ShipView } from "./shipCard.ts";

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
  it("fills canonical upgrade, weapon and chapter totals in parameterized labels", () => {
    const sections = shipSections(
      { ...LABELS, shipHolodisks: "Holodisks: {n} of {total}", shipLevel: "Level {n} of {max}" },
      VIEW,
    );
    expect(sections.equipment[0].slice(0, 3).map((row) => row.level)).toEqual([
      "Level 2 of 3",
      "Level 1 of 3",
      "Level 3 of 3",
    ]);
    expect(sections.equipment[1][0]!.level).toBe("Level 2 of 3");
    expect(sections.cargo[2]!.label).toBe("Holodisks: 3 of 6");
  });

  it("lists Stardust and ore with exact grouped counts, then the holodisks, under Cargo", () => {
    const { cargo } = shipSections(LABELS, VIEW);
    expect(labels(cargo)).toEqual(["Stardust", "Ore", "Holodisks: 3 of 6"]);
    expect(cargo.map((row) => row.count)).toEqual(["1,234,567", "12,500", undefined]);
    expect(cargo.map((row) => row.icon)).toEqual([
      { frames: 1, sprite: "icon-stardust-20" },
      { frames: 1, sprite: "icon-ore-20" },
      { frames: 1, sprite: "icon-holodisk-20" },
    ]);
  });

  it("adds what Ada carries or tows last, with its own icon", () => {
    const carrying = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "carrying", name: "Spare parts" },
    }).cargo.at(-1);
    expect(carrying).toEqual({
      icon: { frames: 1, sprite: "icon-cargo-20" },
      label: "Carrying: Spare parts",
    });
    const towing = shipSections(LABELS, {
      ...VIEW,
      aboard: { kind: "towing", name: "Sleepy Tug" },
    }).cargo.at(-1);
    expect(towing).toEqual({
      icon: { frames: 1, sprite: "icon-tow-20" },
      label: "Towing: Sleepy Tug",
    });
  });

  it("keeps the systems and paint data with Engine first, and weapons in HUD order", () => {
    const [left, right] = shipSections(LABELS, VIEW).equipment;
    expect(labels(left)).toEqual(["Engine", LABELS.shield, LABELS.tractorBeam, "Paint: Sky blue"]);
    expect(left.map((row) => row.level)).toEqual([
      "Level 2 of 3",
      "Level 1 of 3",
      "Level 3 of 3",
      undefined,
    ]);
    expect(left.slice(0, 3).every((row) => "sprite" in row.icon && row.icon.frames === 2)).toBe(
      true,
    );
    expect(right.map((row) => row.level)).toEqual(["Level 2 of 3", "Level 1 of 3"]);
    expect(right.map((row) => "mask" in row.icon)).toEqual([true, true]);
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
class ShipElement {
  children: ShipElement[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style = { background: "", setProperty: vi.fn() };
  textContent = "";
  append(...nodes: ShipElement[]): void {
    this.children.push(...nodes);
  }
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function rendered(sections: ReturnType<typeof shipSections>): ShipElement {
  vi.stubGlobal("document", { createElement: () => new ShipElement() });
  return renderShipSections(
    { ammo: LABELS.ammo!, cargo: "Cargo", equipment: "Equipment", weapons: LABELS.shopWeapons! },
    sections,
  ) as unknown as ShipElement;
}

const rowText = (row: ShipElement) => row.children[1]!.children.map((part) => part.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Ship sections rendering", () => {
  it("names Equipment above Cargo on the left and Weapons on the right", () => {
    const root = rendered(shipSections(LABELS, VIEW));
    expect(root.children).toHaveLength(2);
    const [left, right] = root.children;
    expect(left!.children.map((section) => section.dataset.section)).toEqual([
      "equipment",
      "cargo",
    ]);
    expect(right!.children.map((section) => section.dataset.section)).toEqual(["weapons"]);
    const sections = [...left!.children, ...right!.children];
    expect(
      sections.map((section) =>
        section.dataset.section === "weapons"
          ? section.children[0]!.children[0]!.textContent
          : section.children[0]!.textContent,
      ),
    ).toEqual(["Equipment", "Cargo", "Weapons"]);
    expect(sections.map((section) => section.attributes.get("aria-label"))).toEqual([
      "Equipment",
      "Cargo",
      "Weapons",
    ]);
    expect(left!.children[0]!.children[1]!.children.map((row) => rowText(row)[0])).toEqual([
      "Engine (2)",
      LABELS.shield,
      `${LABELS.tractorBeam} (3)`,
      "Paint: Sky blue",
    ]);
    expect(left!.children[1]!.children[1]!.children.map(rowText)).toEqual([
      ["Stardust", "1,234,567"],
      ["Ore", "12,500"],
      ["Holodisks: 3 of 6"],
    ]);
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
      const equipment = root.children[0]!.children[0]!.children[1]!.children;
      const weapon = root.children[1]!.children[0]!.children[1]!.children[0]!;
      const suffix = level === 1 ? "" : ` (${level})`;
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
    expect(root.children[1]!.children[0]!.children[0]!.children[0]!.textContent).toBe("Weapons");
    expect(root.children[1]!.children[0]!.children[1]!.children).toHaveLength(0);
    const cargo = root.children[0]!.children[1]!.children[1]!;
    expect(rowText(cargo.children.at(-1)!)).toEqual([
      "Carrying: A very long cargo name that must wrap",
    ]);
    const empty = rendered({ ...sections, cargo: [] });
    expect(empty.children[0]!.children[1]!.children[0]!.textContent).toBe("Cargo");
    expect(empty.children[0]!.children[1]!.children[1]!.children).toHaveLength(0);
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

it("shares the Ammo heading track with an accessible-hidden sample of the canonical cap", () => {
  const root = rendered(shipSections(LABELS, VIEW));
  const headings = root.children[1]!.children[0]!.children[0]!;
  expect(headings.children[0]!.textContent).toBe("Weapons");
  const ammo = headings.children[1]!;
  expect(ammo.children[0]!.textContent).toBe("Ammo");
  expect(ammo.children[1]!.textContent).toBe("9,999");
  expect(ammo.children[1]!.attributes.get("aria-hidden")).toBe("true");
});
