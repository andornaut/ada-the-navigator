import { GENERAL_NAMED } from "../data/conversations.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units, VIEW_HOST_ID } from "./layout/css.ts";
import { FOCUS_STYLE } from "./modal.ts";
import { CONVERSATION_SLOT, PANEL_BACKGROUND } from "./notice.ts";

// The in-flight conversation box (layout/conversationBox.ts): one line at a time with the
// speaker's name tab and portrait, over the play view and under the HUD controls and cards. The
// panel and the name tab are one press area: a tap or click moves to the next line.

export interface ConversationLineView {
  /** Changes with each line. */
  readonly key: string;
  readonly name: string;
  readonly side: "left" | "right";
  readonly speaker: string;
  readonly text: string;
  readonly desktop?: string;
}

const { name: label, padding, panel, portrait, tab, text, textGap } = CONVERSATION_BOX;

// Each speaker's compact portrait sheet (art/conversation.md), its frame count and the frame the
// box shows: a mood or the first frame of the speaking loop. The General's sheet holds an unknown
// set of frames, then a named set once his tab reads his name.
export const COMPACT_PORTRAITS = {
  ada: { frame: 1, frames: 2, url: "/art/portraits/ada-compact.png" },
  astra: { frame: 1, frames: 5, url: "/art/portraits/astra-compact.png" },
  general: { frame: 1, frames: 10, named: 6, url: "/art/portraits/gadget-compact.png" },
  penny: { frame: 1, frames: 3, url: "/art/portraits/penny-compact.png" },
} as const;

// Each speaker's name tab fill (art/controls.md "Conversation box").
export const TAB_COLOURS = {
  ada: "#70ace8",
  astra: "#ffc9a8",
  general: "#b8b3c9",
  generalNamed: "#d68b72",
  penny: "#feae34",
} as const;

function portraitRule(selector: string, url: string, frames: number, frame: number): string {
  const size = portrait.art;
  return `
${selector}{
  background:url('${url}') ${units(-frame * size)} 0 / ${units(frames * size)} ${units(size)} no-repeat
}`;
}

const PORTRAIT_RULES = Object.entries(COMPACT_PORTRAITS)
  .map(([speaker, sheet]) =>
    portraitRule(
      `.ada-conversation-portrait[data-speaker="${speaker}"]`,
      sheet.url,
      sheet.frames,
      sheet.frame,
    ),
  )
  .join("");

const TAB_RULES = Object.entries(TAB_COLOURS)
  .map(([speaker, colour]) =>
    speaker === "generalNamed"
      ? `
.ada-conversation[data-speaker="general"][data-named] .ada-conversation-name{
  background:${colour}
}`
      : `
.ada-conversation[data-speaker="${speaker}"] .ada-conversation-name{
  background:${colour}
}`,
  )
  .join("");

export const CONVERSATION_STYLE = `
.ada-conversation{${CONVERSATION_SLOT};
  z-index:5;
  padding:${units(padding)};
  gap:${units(textGap)};
  margin:0;
  border:0;
  min-height:0;
  border-radius:0;
  overflow:visible;
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

.ada-conversation-frame{
  flex:none;
  box-sizing:border-box;
  width:${units(portrait.frame)};
  height:${units(portrait.frame)};
  display:flex;
  align-items:center;
  justify-content:center;
  border:${units(portrait.edge)} solid ${panel.ink};
  background:${portrait.face}
}

.ada-conversation-portrait{
  width:${units(portrait.art)};
  height:${units(portrait.art)};
  image-rendering:pixelated
}
${PORTRAIT_RULES}
${portraitRule(
  '.ada-conversation[data-named] .ada-conversation-portrait[data-speaker="general"]',
  COMPACT_PORTRAITS.general.url,
  COMPACT_PORTRAITS.general.frames,
  COMPACT_PORTRAITS.general.named,
)}

/* A gap from the frame, and a gap from the far edge: the padding plus the rest of the gap. */
.ada-conversation-text{
  flex:1;
  min-width:0;
  align-self:stretch;
  display:flex;
  flex-direction:column;
  justify-content:center;
  margin-right:${units(textGap - padding)}
}

.ada-conversation[data-side="right"] .ada-conversation-text{
  margin-right:0;
  margin-left:${units(textGap - padding)}
}

.ada-conversation-line{
  margin:0;
  font:${font(text)};
  white-space:normal;
  overflow-wrap:break-word;
  overflow:hidden;
  max-height:${units(CONVERSATION_BOX.lines * text.lineHeight)};
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:${CONVERSATION_BOX.lines}
}

/* The tab overhangs the panel's top at the end opposite the portrait; a press on it is a press on
   the box. */
.ada-conversation-name{
  position:absolute;
  top:${units(-tab.overhang)};
  right:${units(tab.inset)};
  box-sizing:border-box;
  height:${units(tab.height)};
  padding:0 ${units(tab.labelInset - tab.edge)};
  border:${units(tab.edge)} solid ${panel.ink};
  border-radius:${units(tab.radius)};
  font:${font(label)};
  line-height:${units(tab.height - 2 * tab.edge)};
  white-space:nowrap;
  color:${panel.ink}
}

.ada-conversation[data-side="right"] .ada-conversation-name{
  right:auto;
  left:${units(tab.inset)}
}
${TAB_RULES}
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
  const frame = document.createElement("span");
  frame.className = "ada-conversation-frame";
  frame.setAttribute("aria-hidden", "true");
  const face = document.createElement("span");
  face.className = "ada-conversation-portrait";
  frame.append(face);
  const column = document.createElement("span");
  column.className = "ada-conversation-text";
  const words = document.createElement("span");
  words.className = "ada-conversation-line";
  column.append(words);
  const name = document.createElement("span");
  name.className = "ada-conversation-name";
  root.append(frame, column, name);
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
      root.toggleAttribute("data-named", line.name === GENERAL_NAMED.name);
      face.dataset.speaker = line.speaker;
      name.textContent = line.name;
      words.textContent = desktop && line.desktop !== undefined ? line.desktop : line.text;
    },
  };
}
