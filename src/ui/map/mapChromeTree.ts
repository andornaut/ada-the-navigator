import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { MapTool } from "./layout/index.ts";

export type MapChromeGroup = "header" | "headerRow" | "tools" | "navigation";
export type MapChromeLeaf =
  | MapTool
  | "galaxy"
  | "nameDivider"
  | "progressDivider"
  | "percent"
  | "pips"
  | "surveyInfo"
  | "quests"
  | "galaxies"
  | "close";
export type MapChromeSchema = {
  group: { props: MapChromeGroup; slots: "content" };
  leaf: { props: MapChromeLeaf; slots: never };
};
const leaf = (name: MapChromeLeaf): LayoutNode<MapChromeSchema> => ({
  component: "leaf",
  key: name,
  kind: "component",
  props: name,
});
const group = (
  name: MapChromeGroup,
  children: readonly LayoutNode<MapChromeSchema>[],
): LayoutNode<MapChromeSchema> => ({
  component: "group",
  key: name,
  kind: "component",
  props: name,
  slots: { content: children },
});

/** Three native chrome roots; canvas, place chips and controller-owned content are not managed slots. */
export function mapChromeTrees(tools: readonly MapTool[]): readonly LayoutNode<MapChromeSchema>[] {
  return [
    group("header", [
      group("headerRow", [
        leaf("galaxy"),
        leaf("nameDivider"),
        leaf("percent"),
        leaf("progressDivider"),
        leaf("pips"),
      ]),
      leaf("surveyInfo"),
    ]),
    group("tools", tools.map(leaf)),
    group("navigation", [leaf("quests"), leaf("galaxies"), leaf("close")]),
  ];
}
