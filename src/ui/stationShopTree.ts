import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationLabels, StationRow } from "./station.ts";

export type StationShopSchema = {
  group: {
    props: { readonly indices: readonly number[]; readonly heading: string | null };
    slots: never;
  };
};
export type StationShopRowSchema = {
  row: {
    props: { readonly id: string; readonly state: string; readonly ariaLabel: string };
    slots: "parts";
  };
  well: { props: { readonly glyph: StationRow["glyph"] }; slots: never };
  name: { props: { readonly title: string; readonly level: string }; slots: never };
  trailing: { props: { readonly className: string; readonly text: string }; slots: never };
};
export function stationShopRowTree(
  labels: Pick<StationLabels, "inUse" | "projectFunded" | "owned">,
  row: StationRow,
): Extract<ComponentNode<StationShopRowSchema>, { component: "row" }> {
  const owned = row.state === "owned" || row.state === "selectable" || row.state === "inUse";
  const text = owned
    ? row.state === "inUse"
      ? labels.inUse
      : row.project
        ? labels.projectFunded
        : labels.owned
    : row.price === null
      ? ""
      : String(row.price);
  return {
    component: "row",
    key: row.key,
    kind: "component",
    props: {
      ariaLabel: [row.name, row.level, text].filter(Boolean).join(", "),
      id: row.key,
      state: row.state,
    },
    slots: {
      parts: [
        { component: "well", key: "well", kind: "component", props: { glyph: row.glyph } },
        {
          component: "name",
          key: "name",
          kind: "component",
          props: { level: row.level, title: row.name },
        },
        {
          component: "trailing",
          key: "trailing",
          kind: "component",
          props: { className: owned ? "ada-owned" : "ada-price", text },
        },
      ],
    },
  };
}
export function stationShopTree(
  context: { readonly columns: number; readonly paintHeading: string },
  rows: readonly StationRow[],
): readonly Extract<ComponentNode<StationShopSchema>, { component: "group" }>[] {
  const chunks: Extract<ComponentNode<StationShopSchema>, { component: "group" }>[] = [];
  for (const kind of ["ammo", "items", "paint"] as const) {
    const indices = rows.flatMap((row, index) => (row.group === kind ? [index] : []));
    for (let index = 0; index < indices.length; index += context.columns) {
      chunks.push({
        component: "group",
        key: `${kind}:${index}`,
        kind: "component",
        props: {
          heading: kind === "paint" && index === 0 ? context.paintHeading : null,
          indices: indices.slice(index, index + context.columns),
        },
      });
    }
  }
  return chunks;
}
