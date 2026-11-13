import { castFrames, castSheet, SPEAKER_CAST } from "../data/cast.ts";
import { CONTENT } from "../data/content.ts";
import { CONTROL_WORDS } from "../data/controlWords.ts";
import { type Mood, type Speaker } from "../data/conversations.ts";
import { InteractionConversation, interactionCopy } from "../model/conversations.ts";
import { createDialoguePanel, DIALOGUE_PANEL_STYLE } from "./dialoguePanel.ts";
import { COMPACT_PORTRAITS, portraitFrame, TAB_COLOURS } from "./dialoguePortraits.ts";
export {
  AWAITING_TAB,
  COMPACT_PORTRAITS,
  portraitFrame,
  SPEAKING_FRAME_MS,
  TAB_COLOURS,
} from "./dialoguePortraits.ts";
import { controlHelpText, createControlHelp } from "./controlHelp.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units, VIEW_HOST_ID } from "./layout/css.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, FOCUS_STYLE, isTap } from "./modal.ts";
import { CONVERSATION_SLOT, PANEL_BACKGROUND } from "./notice.ts";
import { refuse } from "./refusal.ts";

// The in-flight conversation box (layout/conversationBox.ts): one line at a time with the
// speaker's name tab and portrait, over the play view and under the HUD controls and cards. The
// panel and the name tab are one press area: a tap or click moves to the next line.

export interface ConversationLineView {
  /** Seconds the line has shown. */
  readonly elapsed: number;
  /** Changes with each line. */
  readonly key: string;
  readonly mood: Mood;
  readonly name: string;
  /** Whether the General's tab reads his name. */
  readonly named: boolean;
  readonly side: "left" | "right";
  readonly speaker: Speaker;
  readonly text: string;
  readonly desktop?: string;
}

const { name: label, padding, panel, portrait, tab, text, textGap } = CONVERSATION_BOX;

// Each speaker's compact portrait sheet (art/conversation.md) and its frames. Astra and the
// General loop their speaking frames while their line shows, the General's unknown set until his
// tab reads his name, then his named set; Ada and Penny have no loop and show the line's mood.
// Idle frames are for a silent speaker on screen; the box and the storybook panel show only the
// one speaking, so neither shows them.
// The cast speakers' compact sheets (data/cast.ts), each its one neutral frame.
const CAST_COMPACT = Object.fromEntries(
  Object.entries(SPEAKER_CAST).map(([speaker, key]) => [
    speaker,
    { frames: castFrames(key).frames, url: castSheet(key, true) },
  ]),
) as Readonly<Record<string, { readonly frames: number; readonly url: string }>>;

// Each speaker's sheet, sized so one frame fills the portrait; portraitFrame picks the frame.
const PORTRAIT_RULES = Object.entries({ ...COMPACT_PORTRAITS, ...CAST_COMPACT })
  .map(
    ([speaker, sheet]) => `
.ada-conversation-portrait[data-speaker="${speaker}"]{
  background:url('${sheet.url}') 0 0 / ${units(sheet.frames * portrait.art)} ${units(
    portrait.art,
  )} no-repeat
}`,
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

export const INTERACTION_STYLE = DIALOGUE_PANEL_STYLE;

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

/* A gap from the frame, and a gap from the far edge: the padding plus the rest of the gap. A
   speaker without a drawn portrait has no frame: its text keeps that gap from both ends. */
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

/* The tab overhangs the panel's top at its left end, just past Ada's left portrait frame or
   tab.inset in for every other speaker; a press on it is a press on the box. */
.ada-conversation-name{
  position:absolute;
  top:${units(-tab.overhang)};
  left:${units(padding + portrait.frame + textGap)};
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
  left:${units(tab.inset)}
}

${TAB_RULES}
${INTERACTION_STYLE}
`;

export interface ConversationBox {
  dispose(): void;
  /** Shows line, or hides the box for null; call it every frame so a speaking loop runs. */
  render(line: ConversationLineView | null, desktop: boolean, reducedMotion: boolean): void;
}

export function createConversationBox(onAdvance: () => void, onSkip?: () => void): ConversationBox;
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
  let press:
    | {
        readonly id: number;
        readonly start: { readonly x: number; readonly y: number };
        readonly secondaryTouch: boolean;
        moved: boolean;
      }
    | undefined;
  let suppressClick = false;
  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || press) {
      return;
    }
    event.stopPropagation();
    suppressClick = false;
    press = {
      id: event.pointerId,
      moved: false,
      secondaryTouch: event.pointerType === "touch" && !event.isPrimary,
      start: { x: event.clientX, y: event.clientY },
    };
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener("pointermove", (event) => {
    if (
      press?.id === event.pointerId &&
      !isTap(readViewUnit(root), press.start, { x: event.clientX, y: event.clientY })
    ) {
      press.moved = true;
    }
  });
  root.addEventListener("pointerup", (event) => {
    if (press?.id !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    const completed = press;
    press = undefined;
    suppressClick = completed.moved || completed.secondaryTouch;
    // Browsers do not synthesize a click for a second finger while a flight stick is held.
    if (completed.secondaryTouch && !completed.moved) {
      onAdvance();
    }
  });
  const cancelPress = (event: PointerEvent): void => {
    if (press?.id === event.pointerId) {
      press = undefined;
      suppressClick = true;
    }
  };
  root.addEventListener("pointercancel", cancelPress);
  root.addEventListener("lostpointercapture", cancelPress);
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail !== 0 && suppressClick) {
      event.preventDefault();
      return;
    }
    onAdvance();
  });
  document.getElementById(VIEW_HOST_ID)?.append(root);
  let shown = "";
  let shownFrame = -1;
  return {
    dispose: () => {
      root.remove();
    },
    render(line, desktop, reducedMotion) {
      const key = line ? `${line.key}:${desktop}:${line.name}` : "";
      if (key !== shown) {
        shown = key;
        root.hidden = line === null;
        if (line) {
          root.dataset.side = line.side;
          root.dataset.speaker = line.speaker;
          root.toggleAttribute("data-named", line.named);
          face.dataset.speaker = line.speaker;
          name.textContent = line.name;
          // Keyboard wording is words alone; touch wording follows each named control with its icon.
          if (desktop) {
            words.textContent = line.desktop ?? controlHelpText(CONTROL_WORDS, line.text);
          } else {
            words.replaceChildren(...createControlHelp(document, CONTROL_WORDS, line.text));
          }
        }
        shownFrame = -1;
      }
      const frame = line ? portraitFrame(reducedMotion, line) : -1;
      if (frame !== shownFrame) {
        shownFrame = frame;
        face.dataset.frame = String(frame);
        face.style.backgroundPositionX = frame > 0 ? units(-frame * portrait.art) : "0px";
      }
    },
  };
}

/** A Use dialogue in the established story panel. The caller owns pausing and every outcome. */
export function createInteractionCard(
  parent: HTMLElement,
  options: {
    choose(id: string): void;
    close(): void;
    skip(): void;
  },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal ada-interaction-modal";
  modal.hidden = true;
  const card = createDialoguePanel({
    closeAction: "conversation-close",
    closeLabel: CONTENT.labels.close ?? "",
    title: "",
  });
  card.card.dataset.dialog = "conversation";
  modal.append(card.frame);
  parent.append(modal);
  const state = new InteractionConversation();
  let signature = "";
  const draw = (): void => {
    const line = state.line;
    card.showLine(line?.speaker, line?.text ?? "");
    card.choices.replaceChildren();
    card.controls.replaceChildren();
    const add = (label: string, callback: () => void, choice = false, primary = false) => {
      const button = createButton(label, primary ? "primary" : "secondary");
      button.classList.add("ada-story-button");
      button.addEventListener("click", () => {
        callback();
        draw();
      });
      (choice ? card.choices : card.controls).append(button);
    };
    for (const [index, topic] of state.topics.entries()) {
      add(topic.label, () => state.topic(index), true);
    }
    if (!state.atOutcome && state.topics.length === 0) {
      add(CONTENT.labels.next ?? "", () => state.advance(), false, true);
    } else if (state.topics.length === 0) {
      for (const choice of state.choices) {
        add(
          choice.label,
          () => {
            if (choice.refused) {
              refuse(card.choices, false);
            } else {
              options.choose(choice.id);
            }
          },
          choice.id !== "continue",
          state.choices.length === 1,
        );
      }
    }
    if (state.hasTopics && state.topics.length === 0) {
      add(CONTENT.labels.askMore ?? "Ask more", () => state.ask());
    }
    card.skip.hidden = state.atChoice;
    card.fit();
    (
      card.choices.querySelector<HTMLButtonElement>("button") ??
      card.controls.querySelector<HTMLButtonElement>("button")
    )?.focus({ preventScroll: true });
  };
  card.skip.addEventListener("click", () => {
    if (state.atChoice) {
      return;
    }
    state.skip();
    const choices = state.choices;
    if (choices.length === 1 && choices[0]?.id === "continue") {
      options.skip();
    }
    draw();
  });
  const close = (): void => {
    state.skip();
    options.close();
    draw();
  };
  card.close.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
    }
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    const buttons = [...modal.querySelectorAll<HTMLButtonElement>("button")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  return {
    back: close,
    dispose() {
      card.dispose();
      modal.remove();
    },
    isOpen: () => !modal.hidden,
    show(galaxy: number, panel: import("../model/types.ts").DialogueState | null) {
      modal.hidden = panel === null;
      if (!panel) {
        state.reset();
        signature = "";
        return;
      }
      const copy = interactionCopy(galaxy, panel);
      state.show(copy, panel);
      const next = JSON.stringify(panel);
      if (signature !== next) {
        signature = next;
        card.title.textContent = "";
        card.frame.setAttribute("aria-label", state.party);
        draw();
      }
    },
  };
}
