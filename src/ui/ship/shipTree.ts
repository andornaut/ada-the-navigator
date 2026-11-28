import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { SPACING } from "../layout/tokens.ts";
import type { ShipItem, ShipRow, ShipSections } from "./shipCard.ts";

export interface ShipHeadings {
  readonly ammo: string;
  readonly cargo: string;
  readonly equipment: string;
  readonly weapons: string;
}

/** Native inventory components retain their established markup and action bindings. */
export type ShipLayoutSchema = {
  inventoryColumn: {
    props: { readonly id: "cargo" | "equipment" | "weapons"; readonly heading: string };
    slots: "rows";
  };
  inventoryRow: { props: ShipRow; slots: never };
  pageDivider: { props: Record<string, never>; slots: never };
};

export function shipItemKey(item: ShipItem): string {
  return `${item.kind}:${item.id}`;
}

/** Three equal content tracks retain the two intrinsic dividers and inventory order. */
export function shipTree(
  headings: ShipHeadings,
  sections: ShipSections,
): LayoutNode<ShipLayoutSchema> {
  const column = (
    id: "cargo" | "equipment" | "weapons",
    rows: readonly ShipRow[],
  ): LayoutNode<ShipLayoutSchema> => ({
    component: "inventoryColumn",
    key: id,
    kind: "component",
    props: { heading: headings[id], id },
    slots: {
      rows: rows.map((row) => ({
        component: "inventoryRow",
        key: shipItemKey(row.item),
        kind: "component",
        props: row,
      })),
    },
  });
  const divider = (key: string): LayoutNode<ShipLayoutSchema> => ({
    component: "pageDivider",
    key,
    kind: "component",
    props: {},
  });
  return {
    children: [
      column("cargo", sections.cargo),
      divider("cargo-equipment"),
      column("equipment", sections.equipment[0]),
      divider("equipment-weapons"),
      column("weapons", sections.equipment[1]),
    ],
    gap: SPACING.panelPadding,
    key: "ship-inventory",
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
  };
}
