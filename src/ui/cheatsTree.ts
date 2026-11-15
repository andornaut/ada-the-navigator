import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export interface CheatItemData {
  readonly description: string;
  readonly id: string;
  readonly label: string;
}
export interface CheatGroupData {
  readonly actions: readonly CheatItemData[];
  readonly label: string;
  readonly persistence: string;
  readonly scope: "save" | "run";
}
export type CheatsSchema = {
  groups: { props: Record<string, never>; slots: "groups" };
  footer: { props: { readonly label: string }; slots: never };
  group: { props: Pick<CheatGroupData, "label" | "persistence">; slots: "items" };
  item: { props: CheatItemData; slots: never };
};

/** Caller-selected groups contain presentation facts, never session or execution callbacks. */
export function cheatsTree(
  closeLabel: string,
  groups: readonly CheatGroupData[],
): LayoutNode<CheatsSchema> {
  return {
    component: "groups",
    key: "cheats",
    kind: "component",
    props: {},
    slots: {
      groups: [
        ...groups.map<LayoutNode<CheatsSchema>>((group) => ({
          component: "group",
          key: group.scope,
          kind: "component",
          props: { label: group.label, persistence: group.persistence },
          slots: {
            items: group.actions.map((action) => ({
              component: "item",
              key: action.id,
              kind: "component",
              props: action,
            })),
          },
        })),
        { component: "footer", key: "dismiss", kind: "component", props: { label: closeLabel } },
      ],
    },
  };
}
