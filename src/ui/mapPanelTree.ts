import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type MapPanelGroup = "panel" | "row" | "place" | "text" | "reason";
export type MapPanelLeaf =
  "chip" | "name" | "detail0" | "detail1" | "travel" | "danger" | "towing" | "carrying" | "empty";
export type MapPanelSchema = {
  group: { props: MapPanelGroup; slots: "content" };
  leaf: { props: MapPanelLeaf; slots: never };
};

const leaf = (name: MapPanelLeaf): LayoutNode<MapPanelSchema> => ({
  component: "leaf",
  key: name,
  kind: "component",
  props: name,
});
const group = (
  name: MapPanelGroup,
  children: readonly LayoutNode<MapPanelSchema>[],
): LayoutNode<MapPanelSchema> => ({
  component: "group",
  key: name,
  kind: "component",
  props: name,
  slots: { content: children },
});

/** Only native panel composition: current selection, content and travel policy stay controller-owned. */
export function mapPanelTree(): LayoutNode<MapPanelSchema> {
  return group("panel", [
    group("row", [
      group("place", [
        leaf("chip"),
        group("text", [leaf("name"), leaf("detail0"), leaf("detail1")]),
      ]),
      leaf("travel"),
    ]),
    // With no places the empty note comes first and the danger line follows it (art/map.md).
    leaf("empty"),
    group("reason", [leaf("danger"), leaf("towing"), leaf("carrying")]),
  ]);
}
