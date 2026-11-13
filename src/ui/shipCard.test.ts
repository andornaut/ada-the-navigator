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
      "Level 1 of 3",
      "Level 2 of 3",
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

  it("puts the shield, engine, tractor beam and paint left, and the weapons right in HUD order", () => {
    const [left, right] = shipSections(LABELS, VIEW).equipment;
    expect(labels(left)).toEqual([LABELS.shield, "Engine", LABELS.tractorBeam, "Paint: Sky blue"]);
    expect(left.map((row) => row.level)).toEqual([
      "Level 1 of 3",
      "Level 2 of 3",
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
    expect(right.map((row) => row.ammo)).toEqual(["", "42 left"]);
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
  setAttribute(): void {}
}

function rendered(sections: ReturnType<typeof shipSections>): ShipElement {
  vi.stubGlobal("document", { createElement: () => new ShipElement() });
  return renderShipSections(
    { cargo: "Cargo", equipment: "Equipment" },
    sections,
  ) as unknown as ShipElement;
}

const rowText = (row: ShipElement) => row.children[1]!.children.map((part) => part.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Ship sections rendering", () => {
  it("renders exactly Equipment left and Cargo right, with systems then weapons in one list", () => {
    const sections = shipSections(LABELS, VIEW);
    const root = rendered(sections);
    expect(root.children.map((section) => section.dataset.section)).toEqual(["equipment", "cargo"]);
    const [equipment, cargo] = root.children;
    expect(equipment!.children[0]!.textContent).toBe("Equipment");
    expect(cargo!.children[0]!.textContent).toBe("Cargo");
    const groups = equipment!.children[1]!.children;
    expect(groups.map((group) => group.children.map(rowText))).toEqual(
      sections.equipment.map((group) =>
        group.map((row) => [row.label, row.level, row.ammo].filter((value) => value !== undefined)),
      ),
    );
    expect(cargo!.children[1]!.children.map(rowText)).toEqual([
      ["Stardust", "1,234,567"],
      ["Ore", "12,500"],
      ["Holodisks: 3 of 6"],
    ]);
  });

  it("preserves long carried text and every owned weapon value without extra outer columns", () => {
    const view = {
      ...VIEW,
      aboard: { kind: "carrying" as const, name: "A very long cargo name that must wrap" },
    };
    const sections = shipSections(LABELS, view);
    const root = rendered(sections);
    expect(root.children).toHaveLength(2);
    const cargoRows = root.children[1]!.children[1]!.children;
    expect(rowText(cargoRows.at(-1)!)).toEqual(["Carrying: A very long cargo name that must wrap"]);
    const weapons = root.children[0]!.children[1]!.children[1]!.children;
    expect(weapons.map(rowText)).toEqual(
      sections.equipment[1].map((row) => [row.label, row.level, row.ammo]),
    );
  });
});

it("omits the weapon subgroup when no weapons are owned", () => {
  const root = rendered(shipSections(LABELS, { ...VIEW, weapons: [] }));
  expect(root.children[0]!.children[1]!.children).toHaveLength(1);
});
