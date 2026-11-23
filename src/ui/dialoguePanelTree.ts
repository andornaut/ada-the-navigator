import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type DialoguePanelContainer = "frame" | "card" | "copy" | "body" | "portrait" | "column";
export type DialoguePanelNative =
  "title" | "face" | "speaker" | "words" | "choices" | "controls" | "skip" | "close";
export type DialoguePanelSchema = {
  container: { props: DialoguePanelContainer; slots: "children" };
  native: { props: DialoguePanelNative; slots: never };
};

const native = (id: DialoguePanelNative): ComponentNode<DialoguePanelSchema> => ({
  component: "native",
  key: id,
  kind: "component",
  props: id,
});
const container = (
  id: DialoguePanelContainer,
  children: ComponentNode<DialoguePanelSchema>[],
): ComponentNode<DialoguePanelSchema> => ({
  component: "container",
  key: id,
  kind: "component",
  props: id,
  slots: { children },
});

/** Arrangement only: caller-owned native ports retain text, Art, actions and lifecycle. */
export function dialoguePanelTree(includeSkip: boolean): ComponentNode<DialoguePanelSchema> {
  return container("frame", [
    container("card", [
      container("copy", [
        container("body", [
          native("title"),
          container("portrait", [native("face")]),
          native("speaker"),
          native("words"),
        ]),
      ]),
      container("column", [native("choices"), native("controls")]),
    ]),
    ...(includeSkip ? [native("skip")] : []),
    native("close"),
  ]);
}

export type StoryPanelContainer = Exclude<DialoguePanelContainer, "frame"> | "controls";
export type StoryPanelNative =
  Exclude<DialoguePanelNative, "close" | "controls" | "skip"> | "previous" | "next";
export type StoryPanelSchema = {
  container: { props: StoryPanelContainer; slots: "children" };
  native: { props: StoryPanelNative; slots: never };
};

/** The Storybook's native navigation remains in the caller's existing focus order. */
export function storyPanelTree(): ComponentNode<StoryPanelSchema> {
  const leaf = (id: StoryPanelNative): ComponentNode<StoryPanelSchema> => ({
    component: "native",
    key: id,
    kind: "component",
    props: id,
  });
  const group = (
    id: StoryPanelContainer,
    children: ComponentNode<StoryPanelSchema>[],
  ): ComponentNode<StoryPanelSchema> => ({
    component: "container",
    key: id,
    kind: "component",
    props: id,
    slots: { children },
  });
  return group("card", [
    group("copy", [
      group("body", [
        leaf("title"),
        group("portrait", [leaf("face")]),
        leaf("speaker"),
        leaf("words"),
      ]),
    ]),
    group("column", [leaf("choices"), group("controls", [leaf("previous"), leaf("next")])]),
  ]);
}
