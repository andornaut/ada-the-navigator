import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { MapTool } from "./layout/mapScreen.ts";

export type MapChromeGroup =
  "header" | "headerRow" | "column" | "tools" | "navigation" | "questsModal" | "pager";
export type MapChromeLeaf =
  | MapTool
  | "galaxy"
  | "divider"
  | "percent"
  | "pips"
  | "surveyInfo"
  | "quests"
  | "galaxies"
  | "close"
  | "lines"
  | "previous"
  | "pageCount"
  | "next";
export type MapChromeSchema = {
  group: { props: MapChromeGroup; slots: "content" };
  leaf: { props: MapChromeLeaf; slots: never };
  card: { props: Record<string, never>; slots: "body" };
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

/** Four native chrome roots; canvas, place chips and controller-owned content are not managed slots. */
export function mapChromeTrees(tools: readonly MapTool[]): readonly LayoutNode<MapChromeSchema>[] {
  return [
    group("header", [
      group("headerRow", [
        leaf("galaxy"),
        leaf("divider"),
        group("column", [leaf("percent"), leaf("pips")]),
      ]),
      leaf("surveyInfo"),
    ]),
    group("tools", tools.map(leaf)),
    group("navigation", [leaf("quests"), leaf("galaxies"), leaf("close")]),
    group("questsModal", [
      {
        component: "card",
        key: "card",
        kind: "component",
        props: {},
        slots: {
          body: [
            leaf("lines"),
            group("pager", [leaf("previous"), leaf("pageCount"), leaf("next")]),
          ],
        },
      },
    ]),
  ];
}
