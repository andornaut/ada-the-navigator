import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units, VIEW_HOST_ID } from "./layout/css.ts";
import { FOCUS_STYLE } from "./modal.ts";
import { CONVERSATION_SLOT, PANEL_BACKGROUND } from "./notice.ts";

// The in-flight conversation box (layout/conversationBox.ts): one line at a time with the
// speaker's name tab and portrait, over the play view and under the HUD controls and cards. A tap
// or click moves to the next line. Portraits are placeholders, one per speaker, until Art's land.

export interface ConversationLineView {
  /** Changes with each line. */
  readonly key: string;
  readonly name: string;
  readonly side: "left" | "right";
  readonly speaker: string;
  readonly text: string;
  readonly desktop?: string;
}

const { inset, panel, portrait, rowGap, tabInset } = CONVERSATION_BOX;

export const CONVERSATION_STYLE = `
.ada-conversation{${CONVERSATION_SLOT};
  z-index:5;
  height:${units(CONVERSATION_BOX.height)};
  gap:${units(inset)};
  margin:0;
  border:0;
  min-height:0;
  border-radius:0;
  text-align:left;
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation
}

/* The page's base button style changes its background on hover; the panel keeps its own. */
.ada-conversation:hover{
  background:${PANEL_BACKGROUND}
}

.ada-conversation[hidden]{
  display:none
}

.ada-conversation[data-side="right"]{
  flex-direction:row-reverse
}

.ada-conversation:focus-visible{${FOCUS_STYLE}
}

.ada-conversation-portrait{
  flex:none;
  width:${units(portrait)};
  height:${units(portrait)};
  display:flex;
  align-items:center;
  justify-content:center;
  font:${font(CONVERSATION_BOX.name)};
  color:${panel.ink};
  background:#8b9bb4
}

.ada-conversation-portrait[data-speaker="ada"]{
  background:#3a9fd8
}

.ada-conversation-portrait[data-speaker="astra"]{
  background:#ead4aa
}

.ada-conversation-portrait[data-speaker="penny"]{
  background:#c28569
}

.ada-conversation-portrait[data-speaker="general"]{
  background:#5a6988
}

.ada-conversation-text{
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:${units(rowGap)}
}

.ada-conversation-name{
  align-self:flex-start;
  padding:0 ${units(tabInset)};
  font:${font(CONVERSATION_BOX.name)};
  color:${panel.ink};
  background:#ead4aa
}

.ada-conversation-line{
  margin:0;
  font:${font(CONVERSATION_BOX.text)};
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:100%
}
`;

export interface ConversationBox {
  dispose(): void;
  render(line: ConversationLineView | null, desktop: boolean): void;
}

export function createConversationBox(onAdvance: () => void): ConversationBox {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "ada-conversation";
  root.dataset.action = "conversation";
  root.hidden = true;
  root.setAttribute("aria-live", "polite");
  const face = document.createElement("span");
  face.className = "ada-conversation-portrait";
  face.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "ada-conversation-text";
  const name = document.createElement("span");
  name.className = "ada-conversation-name";
  const words = document.createElement("span");
  words.className = "ada-conversation-line";
  text.append(name, words);
  root.append(face, text);
  root.addEventListener("click", onAdvance);
  const style = document.createElement("style");
  style.textContent = CONVERSATION_STYLE;
  document.head.append(style);
  document.getElementById(VIEW_HOST_ID)?.append(root);
  let shown = "";
  return {
    dispose: () => {
      root.remove();
      style.remove();
    },
    render(line, desktop) {
      const key = line ? `${line.key}:${desktop}:${line.name}` : "";
      if (key === shown) {
        return;
      }
      shown = key;
      root.hidden = line === null;
      if (!line) {
        return;
      }
      root.dataset.side = line.side;
      root.dataset.speaker = line.speaker;
      face.dataset.speaker = line.speaker;
      face.textContent = line.name.slice(0, 1);
      name.textContent = line.name;
      words.textContent = desktop && line.desktop !== undefined ? line.desktop : line.text;
    },
  };
}
