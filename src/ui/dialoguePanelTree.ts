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
export function dialoguePanelTree(): ComponentNode<DialoguePanelSchema> {
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
    native("skip"),
    native("close"),
  ]);
}
