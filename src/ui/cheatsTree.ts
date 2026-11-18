import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

/** One full-width row of the Cheats modal: an action button or the FPS counter switch. */
export type CheatRowData =
  | { readonly id: string; readonly kind: "action"; readonly label: string }
  | { readonly id: string; readonly kind: "switch"; readonly label: string };

export type CheatsSchema = {
  list: { props: Record<string, never>; slots: "rows" | "footer" };
  footer: { props: { readonly label: string }; slots: never };
  action: { props: { readonly id: string; readonly label: string }; slots: never };
  switch: { props: { readonly id: string; readonly label: string }; slots: never };
};

/** One scrolling column of rows in the caller's order, then Close; presentation facts only. */
export function cheatsTree(
  closeLabel: string,
  rows: readonly CheatRowData[],
): LayoutNode<CheatsSchema> {
  return {
    component: "list",
    key: "cheats",
    kind: "component",
    props: {},
    slots: {
      footer: [
        { component: "footer", key: "dismiss", kind: "component", props: { label: closeLabel } },
      ],
      rows: rows.map<LayoutNode<CheatsSchema>>(({ id, kind, label }) => ({
        component: kind,
        key: id,
        kind: "component",
        props: { id, label },
      })),
    },
  };
}
