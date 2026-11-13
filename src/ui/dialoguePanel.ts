import { CONTENT } from "../data/content.ts";
import { storySpeakerName } from "./dialoguePortraits.ts";
import { font, safeEdge, units } from "./layout/css.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { createButton } from "./modal.ts";
import { STORY_PORTRAITS, storyPortrait, storyPortraitFrame, storyTabColour } from "./storybook.ts";

export const DIALOGUE_PANEL_STYLE = `
.ada-controls .ada-dialogue-frame{
  position:absolute;
  inset:0;
  pointer-events:none
}
.ada-controls .ada-dialogue-frame > .ada-close{
  top:${safeEdge("top", SPACING.pageInset)};
  right:${safeEdge("right", SPACING.pageInset)}
}
.ada-controls .ada-dialogue-panel .ada-dialogue-controls{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr))
}
.ada-controls .ada-dialogue-panel .ada-story-controls > .ada-button{
  width:100%
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

/** Earth and space dialogues share the story panel, speaker frame, name tab and text roles. */
export function createDialoguePanel(options: {
  readonly closeAction: string;
  readonly closeLabel: string;
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
  portrait.append(face);
  const speaker = document.createElement("p");
  speaker.className = "ada-story-tab";
  const words = document.createElement("p");
  words.className = "ada-story-paragraph";
  body.append(title, portrait, speaker, words);
  copy.append(body);
  const column = document.createElement("div");
  column.className = "ada-story-choice-column";
  const choices = document.createElement("div");
  choices.className = "ada-story-choices";
  const controls = document.createElement("div");
  controls.className = "ada-story-controls ada-dialogue-controls";
  column.append(choices, controls);
  card.append(copy, column);
  const close = document.createElement("button");
  close.className = "ada-close";
  close.type = "button";
  close.dataset.action = options.closeAction;
  close.setAttribute("aria-label", options.closeLabel);
  const skip = createButton(CONTENT.labels.skip ?? "");
  skip.classList.add("ada-compact", "ada-story-skip");
  skip.dataset.action = "dialogue-skip";
  skip.hidden = true;
  frame.append(card, skip, close);
  return {
    body,
    card,
    choices,
    close,
    controls,
    dispose: () => frame.remove(),
    fit(): void {
      const scrolls = copy.scrollHeight > copy.clientHeight + 1;
      copy.classList.toggle("ada-story-scrolls", scrolls);
      copy.tabIndex = scrolls ? 0 : -1;
    },
    frame,
    showLine(name: string | undefined, text: string): void {
      const resolved = storyPortrait(name);
      portrait.hidden = resolved === null;
      speaker.hidden = !name;
      speaker.textContent = storySpeakerName(name ?? "");
      speaker.style.background = name ? storyTabColour(name) : "";
      words.textContent = text;
      words.hidden = text === "";
      body.dataset.side = resolved?.side ?? "right";
      if (resolved) {
        const sheet = STORY_PORTRAITS[resolved.speaker];
        if (sheet) {
          face.dataset.speaker = resolved.speaker;
          const image = STORY_PANEL.portrait.image;
          const x = units(-storyPortraitFrame(true, resolved, 0) * image);
          const size = `${units(sheet.frames * image)} ${units(image)}`;
          face.style.background = `url('${sheet.url}') ${x} 0 / ${size} no-repeat`;
        }
      }
    },
    skip,
    title,
  };
}
