import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import {
  type DialoguePanelContainer,
  type DialoguePanelNative,
  type DialoguePanelSchema,
  dialoguePanelTree,
} from "./dialoguePanelTree.ts";
import { portraitBackground, selectPortraitCrop, storySpeakerName } from "./dialoguePortraits.ts";
import { VIEW_SCALE_EVENT } from "./layout/dom.ts";
import { BUTTON_GAP, font, SPACING, STORY_PANEL, TYPE, units } from "./layout/index.ts";
import {
  STORY_PORTRAITS,
  storyPortrait,
  storyPortraitFrame,
  storyTabColour,
} from "./story/index.ts";

export const DIALOGUE_PANEL_STYLE = `
.ada-controls .ada-dialogue-frame{
  position:absolute;
  inset:0;
  pointer-events:none
}
.ada-controls .ada-dialogue-panel .ada-story-choice-column{
  min-width:0
}
.ada-controls .ada-dialogue-frame .ada-dialogue-panel .ada-story-text > .ada-story-frame{
  margin-bottom:0
}
.ada-controls .ada-station-frame .ada-story-choices{
  gap:${units(SPACING.gap)}
}
.ada-controls .ada-dialogue-panel .ada-dialogue-controls{
  display:flex;
  flex:none;
  justify-content:center;
  column-gap:${units(BUTTON_GAP)};
  margin-top:auto
}
.ada-controls .ada-dialogue-panel .ada-dialogue-controls > .ada-button{
  min-width:0
}
.ada-controls .ada-dialogue-panel .ada-dialogue-controls[hidden],
.ada-controls .ada-dialogue-panel .ada-story-choices[hidden]{
  display:none
}
.ada-controls .ada-dialogue-panel .ada-story-choices{
  flex:0 1 auto;
  min-height:0;
  overflow-y:auto
}
.ada-controls .ada-dialogue-panel .ada-balance{
  font:${font(TYPE.label)}
}
`;

export type DialogueSpeaker =
  | string
  | {
      readonly displayName: string;
      readonly portraitName: string;
    };

/** Earth and space dialogues share the story panel, speaker frame, name tab and text roles. */
export function createDialoguePanel(options: {
  readonly close: HTMLButtonElement;
  readonly skip?: HTMLButtonElement;
  readonly title: string;
}) {
  const frame = document.createElement("div");
  frame.className = "ada-dialogue-frame";
  frame.setAttribute("role", "dialog");
  frame.setAttribute("aria-modal", "true");
  frame.setAttribute("aria-label", options.title);
  const card = document.createElement("section");
  card.className = "ada-card ada-story-panel ada-dialogue-panel";
  const copy = document.createElement("div");
  copy.className = "ada-story-copy";
  const body = document.createElement("div");
  body.className = "ada-story-text";
  const title = document.createElement("h2");
  title.className = "ada-story-heading";
  title.hidden = true;
  const portrait = document.createElement("div");
  portrait.className = "ada-story-frame";
  portrait.setAttribute("aria-hidden", "true");
  const face = document.createElement("span");
  face.className = "ada-story-portrait";
  const speaker = document.createElement("p");
  speaker.className = "ada-story-tab";
  const words = document.createElement("p");
  words.className = "ada-story-paragraph";
  const column = document.createElement("div");
  column.className = "ada-story-choice-column";
  const choices = document.createElement("div");
  choices.className = "ada-story-choices";
  const controls = document.createElement("div");
  controls.className = "ada-dialogue-controls";
  const { close } = options;
  const containers: Readonly<Record<DialoguePanelContainer, HTMLElement>> = {
    body,
    card,
    column,
    copy,
    frame,
    portrait,
  };
  const nativeNodes: Readonly<Record<Exclude<DialoguePanelNative, "skip">, HTMLElement>> = {
    choices,
    close,
    controls,
    face,
    speaker,
    title,
    words,
  };
  const arrangement = mountLayout<DialoguePanelSchema>(
    {
      components: {
        container: {
          create: (id) => ({
            dispose() {},
            element: containers[id],
            slots: { children: containers[id] },
            update() {},
          }),
          slots: ["children"],
        },
        native: {
          create: (id) => {
            const element = id === "skip" ? options.skip : nativeNodes[id];
            if (!element) {
              throw new Error("Missing dialogue Skip button");
            }
            return { dispose() {}, element, slots: {}, update() {} };
          },
          slots: [],
        },
      },
      host: document.createElement("div"),
    },
    dialoguePanelTree(options.skip !== undefined),
  );
  let disposed = false;
  const fit = (): void => {
    if (disposed || !frame.isConnected) {
      return;
    }
    controls.hidden = !Array.from(controls.children).some(
      (child) => !(child as HTMLElement).hidden,
    );
    choices.hidden = !Array.from(choices.children).some((child) => !(child as HTMLElement).hidden);
    const scrolls = copy.scrollHeight > copy.clientHeight + 1;
    copy.classList.toggle("ada-story-scrolls", scrolls);
    copy.tabIndex = scrolls ? 0 : -1;
  };
  const view = frame.ownerDocument.defaultView;
  view?.addEventListener(VIEW_SCALE_EVENT, fit);
  void frame.ownerDocument.fonts?.ready.then(fit);
  return {
    body,
    card,
    choices,
    close,
    controls,
    dispose(): void {
      disposed = true;
      selectPortraitCrop(face, undefined);
      view?.removeEventListener(VIEW_SCALE_EVENT, fit);
      arrangement.dispose();
    },
    fit,
    frame,
    showLine(name: DialogueSpeaker | undefined, text: string): void {
      const displayName =
        typeof name === "object" ? name.displayName : storySpeakerName(name ?? "");
      const portraitName = typeof name === "object" ? name.portraitName : name;
      const resolved = storyPortrait(portraitName);
      portrait.hidden = resolved === null;
      speaker.hidden = !displayName;
      speaker.textContent = displayName;
      speaker.style.background = portraitName ? storyTabColour(portraitName) : "";
      words.textContent = text;
      words.hidden = text === "";
      body.dataset.side = resolved?.side ?? "right";
      const sheet = resolved ? STORY_PORTRAITS[resolved.speaker] : undefined;
      selectPortraitCrop(face, sheet);
      if (resolved) {
        if (sheet) {
          face.dataset.speaker = resolved.speaker;
          face.style.background = portraitBackground(
            sheet,
            STORY_PANEL.portrait.image,
            storyPortraitFrame(true, resolved, 0),
          );
        }
      }
    },
    title,
  };
}
