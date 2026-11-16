import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { SPACING } from "./layout/tokens.ts";
import type { ShipRow, ShipSections } from "./shipCard.ts";
import { shipItemKey, shipTree } from "./shipTree.ts";

const headings = { ammo: "Ammo", cargo: "Cargo", equipment: "Equipment", weapons: "Weapons" };
const row: ShipRow = {
  count: "0",
  icon: { frames: 1, sprite: "icon-ore-20" },
  item: { id: "ore", kind: "resource" },
  label: "Ore",
};
const sections: ShipSections = { cargo: [row], equipment: [[], []] };

describe("production Ship configuration", () => {
  it("uses three equal content tracks with the established shared gap and intrinsic divider order", () => {
    const tree = shipTree(headings, sections);
    validateLayoutTree({ inventoryColumn: ["rows"], inventoryRow: [], pageDivider: [] }, tree);
    expect(tree).toMatchObject({
      gap: SPACING.panelPadding,
      kind: "columns",
      padding: 0,
      sizing: {
        mode: "tracks",
        tracks: [
          { kind: "fraction" },
          { kind: "intrinsic" },
          { kind: "fraction" },
          { kind: "intrinsic" },
          { kind: "fraction" },
        ],
      },
    });
    if (tree.kind === "component") {
      throw new Error("Expected inventory columns");
    }
    expect(tree.children.map(({ key }) => key)).toEqual([
      "cargo",
      "cargo-equipment",
      "equipment",
      "equipment-weapons",
      "weapons",
    ]);
  });

  it("retains the exact inventory data and canonical identity rather than parsing display names", () => {
    const tree = shipTree(headings, sections);
    if (tree.kind === "component") {
      throw new Error("Expected inventory columns");
    }
    const column = tree.children[0]!;
    if (column.kind !== "component" || column.component !== "inventoryColumn") {
      throw new Error("Expected Cargo component");
    }
    const item = column.slots!.rows![0]!;
    expect(item).toEqual({
      component: "inventoryRow",
      key: "resource:ore",
      kind: "component",
      props: row,
    });
    if (item.kind !== "component" || item.component !== "inventoryRow") {
      throw new Error("Expected row");
    }
    expect(item.props).toBe(row);
    expect(shipItemKey({ id: "ore", kind: "resource" })).toBe("resource:ore");
  });
});
