import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { SPACING } from "../layout/index.ts";

/** One actionable row supplied by the game. */
export type CheatRowData = { readonly id: string; readonly label: string };

export type CheatsSchema = {
  layout: { props: Record<string, never>; slots: "columns" | "footer" };
  column: { props: Record<string, never>; slots: "rows" };
  footer: { props: { readonly label: string }; slots: never };
  action: { props: { readonly id: string; readonly label: string }; slots: never };
};

const progressionIds = ["unlockAllEquipment", "unlockAllGalaxies", "unlockAllWeapons"] as const;
const grantIds = ["addStardust", "addOre"] as const;

/** Columns follow DOM order. The resource pair shares a row inside the second column. */
export function cheatsTree(
  backLabel: string,
  rows: readonly CheatRowData[],
): LayoutNode<CheatsSchema> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const row = (id: string): LayoutNode<CheatsSchema>[] => {
    const data = byId.get(id);
    return data
      ? [{ component: "action", key: id, kind: "component", props: { id, label: data.label } }]
      : [];
  };
  const buttons = grantIds.flatMap(row);
  // A lone grant still occupies the leading half of the row.
  if (buttons.length === 1) {
    buttons.push({ children: [], gap: 0, key: "empty", kind: "stack", padding: 0 });
  }
  return {
    component: "layout",
    key: "cheats",
    kind: "component",
    props: {},
    slots: {
      columns: [
        {
          component: "column",
          key: "progression",
          kind: "component",
          props: {},
          slots: { rows: progressionIds.flatMap(row) },
        },
        {
          component: "column",
          key: "tools",
          kind: "component",
          props: {},
          slots: {
            rows: [
              ...(buttons.length
                ? [
                    {
                      children: buttons,
                      gap: SPACING.columnGap,
                      key: "grants",
                      kind: "columns",
                      padding: 0,
                      sizing: { mode: "equal" },
                    } as const,
                  ]
                : []),
              ...row("maxWeaponLevels"),
              ...row("selectiveReset"),
            ],
          },
        },
      ],
      footer: [
        { component: "footer", key: "dismiss", kind: "component", props: { label: backLabel } },
      ],
    },
  };
}
