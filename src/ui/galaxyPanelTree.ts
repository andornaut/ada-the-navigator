import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type GalaxyPanelGroup = "screen" | "panel" | "text" | "footer";
export type GalaxyPanelLeaf = "shot" | "number" | "name" | "flavor" | "development" | "jump";
export type GalaxyPanelSchema = {
  group: { props: GalaxyPanelGroup; slots: "content" };
  leaf: { props: GalaxyPanelLeaf; slots: never };
};
const leaf = (name: GalaxyPanelLeaf): LayoutNode<GalaxyPanelSchema> => ({
  component: "leaf",
  key: name,
  kind: "component",
  props: name,
});
const group = (
  name: GalaxyPanelGroup,
  children: readonly LayoutNode<GalaxyPanelSchema>[],
): LayoutNode<GalaxyPanelSchema> => ({
  component: "group",
  key: name,
  kind: "component",
  props: name,
  slots: { content: children },
});

/** Native route Art stays outside the managed panel/footer slots; selection stays controller-owned. */
export function galaxyPanelTree(): LayoutNode<GalaxyPanelSchema> {
  return group("screen", [
    group("panel", [
      leaf("shot"),
      group("text", [leaf("number"), leaf("name"), leaf("flavor"), leaf("development")]),
    ]),
    group("footer", [leaf("jump")]),
  ]);
}
