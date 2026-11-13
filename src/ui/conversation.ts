import { CAST, CAST_FRAMES, castSheet, SPEAKER_CAST } from "../data/cast.ts";
import { CONTROL_WORDS } from "../data/controlWords.ts";
import { type Mood, type Speaker } from "../data/conversations.ts";
import { InteractionConversation, interactionCopy } from "../model/conversations.ts";
import { controlHelpText, createControlHelp } from "./controlHelp.ts";
import { TEXT_BUTTON } from "./layout/controls.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units, VIEW_HOST_ID } from "./layout/css.ts";
import { SPACING } from "./layout/tokens.ts";
import { createButton, createCard, FOCUS_STYLE } from "./modal.ts";
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
export const COMPACT_PORTRAITS = {
  ada: { frames: 2, moods: { happy: 0, neutral: 1 }, url: "/art/portraits/ada-compact.png" },
  astra: { frames: 5, speaking: [1, 2, 3, 4], url: "/art/portraits/astra-compact.png" },
  general: {
    frames: 10,
    speaking: { named: [6, 7, 8, 9], unknown: [1, 2, 3, 4] },
    url: "/art/portraits/gadget-compact.png",
  },
  penny: {
    frames: 3,
    moods: { happy: 0, neutral: 1, upset: 2 },
    url: "/art/portraits/penny-compact.png",
  },
} as const;

// The cast speakers' compact sheets (data/cast.ts), each its one neutral frame.
const CAST_COMPACT = Object.fromEntries(
  Object.entries(SPEAKER_CAST).map(([speaker, key]) => [
    speaker,
    { frames: CAST_FRAMES.frames, url: castSheet(key, true) },
  ]),
) as Readonly<Record<string, { readonly frames: number; readonly url: string }>>;

/** The tab fill of a story speaker with no tab of their own, the unnamed General's. */
export const AWAITING_TAB = "#b8b3c9";

/** Each speaking frame's time. */
export const SPEAKING_FRAME_MS = 120;

/**
 * The sheet frame the box shows for line: Ada's or Penny's mood (neutral where the sheet has no
 * such mood), or Astra's or the General's speaking loop timed from the line's start, held on its
 * first frame under reduced motion.
 */
export function portraitFrame(
  reducedMotion: boolean,
  line: Pick<ConversationLineView, "elapsed" | "mood" | "named" | "speaker">,
): number {
  const loop = (frames: readonly number[]): number =>
    frames[
      reducedMotion
        ? 0
        : Math.floor((line.elapsed * 1000) / SPEAKING_FRAME_MS + 1e-9) % frames.length
    ]!;
  if (line.speaker === "ada" || line.speaker === "penny") {
    const moods: Readonly<Partial<Record<Mood, number>>> = COMPACT_PORTRAITS[line.speaker].moods;
    return moods[line.mood] ?? moods.neutral!;
  }
  if (SPEAKER_CAST[line.speaker]) {
    return CAST_FRAMES.neutral;
  }
  if (line.speaker === "astra") {
    return loop(COMPACT_PORTRAITS.astra.speaking);
  }
  return loop(COMPACT_PORTRAITS.general.speaking[line.named ? "named" : "unknown"]);
}

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

// Each speaker's name tab fill (art/controls.md "Conversation box").
export const TAB_COLOURS = {
  ada: "#70ace8",
  astra: "#8fe0f2",
  general: "#b8b3c9",
  generalNamed: "#d68b72",
  penny: "#feae34",
  ...Object.fromEntries(
    Object.entries(SPEAKER_CAST).map(([speaker, key]) => [speaker, CAST[key].tab]),
  ),
} as Readonly<Record<string, string>>;

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

export const INTERACTION_STYLE = `
.ada-interaction-speaker{display:flex;align-items:center;gap:${units(SPACING.gap)}}
.ada-interaction-portrait{
 display:inline-block;flex:none;width:${units(portrait.art)};height:${units(portrait.art)};background-repeat:no-repeat;
 image-rendering:pixelated}
.ada-interaction-party{align-self:stretch}
`;

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
.ada-conversation-skip-area{${CONVERSATION_SLOT};background:transparent;pointer-events:none;z-index:6}
.ada-conversation-skip-area[hidden]{display:none}
.ada-conversation-skip-area button{position:absolute;right:0;
 top:${units(CONVERSATION_BOX.height + SPACING.gap)};pointer-events:auto;
 min-height:${units(TEXT_BUTTON.height)};font:${font(label)}}
`;

export interface ConversationBox {
  dispose(): void;
  /** Shows line, or hides the box for null; call it every frame so a speaking loop runs. */
  render(line: ConversationLineView | null, desktop: boolean, reducedMotion: boolean): void;
}

export function createConversationBox(onAdvance: () => void, onSkip?: () => void): ConversationBox {
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
  document.getElementById(VIEW_HOST_ID)?.append(root);
  const skipArea = document.createElement("div");
  skipArea.className = "ada-conversation-skip-area";
  skipArea.hidden = true;
  const skip = createButton("Skip dialogue");
  skip.dataset.action = "conversation-skip";
  skip.addEventListener("click", () => onSkip?.());
  skipArea.append(skip);
  document.getElementById(VIEW_HOST_ID)?.append(skipArea);
  let shown = "";
  let shownFrame = -1;
  return {
    dispose: () => {
      root.remove();
      skipArea.remove();
    },
    render(line, desktop, reducedMotion) {
      const key = line ? `${line.key}:${desktop}:${line.name}` : "";
      if (key !== shown) {
        shown = key;
        root.hidden = line === null;
        skipArea.hidden = line === null || !onSkip;
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

/** Fullscreen Use card. The caller owns pausing and every outcome. */
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
  const card = createCard({
    closeAction: "conversation-close",
    closeLabel: "Close",
    full: true,
    title: "",
  });
  card.card.dataset.dialog = "conversation";
  const party = document.createElement("div");
  const speaker = document.createElement("div");
  party.className = "ada-interaction-party";
  speaker.className = "ada-interaction-party";
  const words = document.createElement("p");
  words.className = "ada-prose";
  const actions = document.createElement("div");
  actions.className = "ada-actions ada-wrap ada-interaction-actions";
  card.body.append(party, speaker, words, actions);
  modal.append(card.frame);
  parent.append(modal);
  const state = new InteractionConversation();
  let signature = "";
  const makePortrait = (name: string): HTMLElement => {
    const node = document.createElement("span");
    node.className = "ada-interaction-portrait";
    node.setAttribute("aria-hidden", "true");
    const cast = Object.entries(CAST).find(([, member]) => member.name === name);
    const core = Object.entries(COMPACT_PORTRAITS).find(
      ([key]) =>
        key ===
        (name === "General Gadget" || name === "Unknown voice" ? "general" : name.toLowerCase()),
    );
    const url = cast ? castSheet(cast[0] as keyof typeof CAST, true) : core?.[1].url;
    const frames = cast ? 1 : core?.[1].frames;
    if (url && frames) {
      node.style.backgroundImage = `url('${url}')`;
      node.style.backgroundSize = `${units(frames * portrait.art)} ${units(portrait.art)}`;
      if (core) {
        const frame = portraitFrame(true, {
          elapsed: 0,
          mood: "neutral",
          named: name === "General Gadget",
          speaker: core[0] as Speaker,
        });
        node.style.backgroundPositionX = units(-frame * portrait.art);
      }
    }
    return node;
  };
  const named = (name: string): HTMLElement => {
    const node = document.createElement("div");
    node.className = "ada-interaction-speaker";
    node.append(makePortrait(name), document.createTextNode(name));
    return node;
  };
  const draw = (): void => {
    const line = state.line;
    party.replaceChildren(named(state.party));
    speaker.replaceChildren(...(line?.speaker ? [named(line.speaker)] : []));
    speaker.hidden = !line?.speaker;
    words.textContent = line?.text ?? "";
    words.hidden = !words.textContent;
    actions.replaceChildren();
    const add = (label: string, callback: () => void) => {
      const button = createButton(label);
      button.addEventListener("click", () => {
        callback();
        draw();
      });
      actions.append(button);
    };
    for (const [index, topic] of state.topics.entries()) {
      add(topic.label, () => state.topic(index));
    }
    if (!state.atOutcome || state.topics.length > 0) {
      add("Continue", () => state.advance());
    } else {
      for (const choice of state.choices) {
        add(choice.label, () => {
          if (choice.refused) {
            refuse(actions, false);
          } else {
            options.choose(choice.id);
          }
        });
      }
    }
    if (state.hasTopics && state.topics.length === 0) {
      add("Ask more", () => state.ask());
    }
    add("Skip dialogue", () => {
      state.skip();
      const choices = state.choices;
      if (choices.length === 1 && choices[0]?.id === "continue") {
        options.skip();
      }
    });
    add("Close", () => {
      state.skip();
      options.close();
    });
    card.fit();
    actions.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };
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
        card.title.textContent = state.party;
        card.frame.setAttribute("aria-label", state.party);
        draw();
      }
    },
  };
}
