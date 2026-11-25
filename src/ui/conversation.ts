import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { REFUSAL_ATTRIBUTES } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import { castPortrait, type CastPortraitSheet, SPEAKER_CAST } from "../data/cast.ts";
import { CONTENT } from "../data/content.ts";
import { CONTROL_WORDS } from "../data/controlWords.ts";
import type { Mood, Speaker } from "../data/conversations.ts";
import { EMERGENCY_RETURN } from "../data/emergencyReturn.ts";
import { NOTICE_TIMING } from "../data/noticeTiming.ts";
import { InteractionConversation, interactionCopy } from "../model/conversations.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { createDialoguePanel, DIALOGUE_PANEL_STYLE } from "./dialoguePanel.ts";
import {
  COMPACT_PORTRAITS,
  portraitBackground,
  portraitFrame,
  selectPortraitCrop,
  TAB_COLOURS,
} from "./dialoguePortraits.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
export {
  AWAITING_TAB,
  COMPACT_PORTRAITS,
  portraitFrame,
  SPEAKING_FRAME_MS,
  TAB_COLOURS,
} from "./dialoguePortraits.ts";
import { controlHelpText, createControlHelp } from "./controlHelp.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, fromHudEdge, units, VIEW_HOST_ID } from "./layout/css.ts";
import { hudButtonTarget, STORY_SKIP } from "./layout/playView.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";
import { CONVERSATION_SLOT, FLIGHT_PANEL_BACKGROUND } from "./notice.ts";
import { refuse } from "./refusal.ts";
import { createStandardTextAction } from "./standardTextAction.ts";

// The in-flight conversation box (layout/conversationBox.ts): one line at a time with the
// speaker's name tab and portrait, over the play view and under the HUD controls and cards. The
// panel and the name tab are one press area: a tap or click moves to the next line.

export interface ConversationLineView {
  readonly discoveryFadeEnd?: number;
  /** Seconds the line has shown. */
  readonly elapsed: number;
  /** Changes with each line. */
  readonly key: string;
  readonly mood: Mood;
  readonly name: string;
  /** Whether Archie's tab reads his name. */
  readonly named: boolean;
  readonly side: "left" | "right";
  readonly speaker: Speaker;
  readonly text: string;
  readonly desktop?: string;
}

const { name: label, padding, panel, portrait, tab, text, textGap } = CONVERSATION_BOX;

// Each speaker's compact portrait sheet (art/conversation.md) and its frames. Astra and
// Archie loop their speaking frames while their line shows, Archie's unknown set until his
// tab reads his name, then his named set; Ada and Penny have no loop and show the line's mood.
// Idle frames are for a silent speaker on screen; the box and the storybook panel show only the
// one speaking, so neither shows them.
// The cast speakers' compact sheets (data/cast.ts), each its one neutral frame.
const CAST_COMPACT = Object.fromEntries(
  Object.entries(SPEAKER_CAST).map(([speaker, key]) => [speaker, castPortrait(key, true)]),
) as Readonly<Record<string, CastPortraitSheet>>;

// Each speaker's sheet, sized so one frame fills the portrait; portraitFrame picks the frame.
const PORTRAIT_RULES = Object.entries({ ...COMPACT_PORTRAITS, ...CAST_COMPACT })
  .map(
    ([speaker, sheet]) => `
.ada-conversation-portrait[data-speaker="${speaker}"]{
  background:${portraitBackground(sheet, portrait.art)}
}`,
  )
  .join("");

const TAB_RULES = Object.entries(TAB_COLOURS)
  .map(([speaker, colour]) =>
    speaker === "archieNamed"
      ? `
.ada-conversation[data-speaker="archie"][data-named] .ada-conversation-name{
  background:${colour}
}`
      : `
.ada-conversation[data-speaker="${speaker}"] .ada-conversation-name{
  background:${colour}
}`,
  )
  .join("");

/**
 * The Interaction card's HUD row (art/layout.md "Storybook page"): the close X takes the story
 * page's Settings slot, its press area the Settings target and its face centred in it on the HUD
 * row's centre line, and Skip keeps its place beside Settings. Rects are relative to the HUD
 * rect's top-right corner, x growing rightward; skipRight is Skip's offset in from its right.
 */
export function interactionHudRow(): {
  readonly close: Rect;
  readonly closeFace: Rect;
  readonly skipRight: number;
} {
  const close = hudButtonTarget(0);
  const { height, width } = CARD_CLOSE.art;
  return {
    close,
    closeFace: {
      height,
      width,
      x: close.x + (close.width - width) / 2,
      y: close.y + (close.height - height) / 2,
    },
    skipRight: STORY_SKIP.right.besideSettings,
  };
}

const INTERACTION_ROW = interactionHudRow();

// Only the full-screen interaction positions its controls against the HUD.
export const INTERACTION_STYLE = `${DIALOGUE_PANEL_STYLE}
.ada-controls .ada-interaction-modal > .ada-dialogue-frame > .ada-close{
  top:${fromHudEdge("top", INTERACTION_ROW.close.y)};
  right:${fromHudEdge("right", -(INTERACTION_ROW.close.x + INTERACTION_ROW.close.width))};
  width:${units(INTERACTION_ROW.close.width)};
  height:${units(INTERACTION_ROW.close.height)}
}
.ada-controls .ada-interaction-modal > .ada-dialogue-frame:has(> .ada-close:not([hidden])) > .ada-story-skip{
  right:${fromHudEdge("right", INTERACTION_ROW.skipRight)}
}
`;

export const CONVERSATION_STYLE = `
.ada-conversation{${CONVERSATION_SLOT};
  background:${FLIGHT_PANEL_BACKGROUND};
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

.ada-conversation[data-emergency]{
  z-index:${EMERGENCY_RETURN.layers.dialogue}
}

.ada-conversation[hidden]{
  display:none
}

.ada-conversation[data-side="right"]{
  flex-direction:row-reverse
}

.ada-conversation:focus-visible{
  outline:none;
  box-shadow:none;
  background:${TEXT_TOKENS.label};
  color:${TEXT_TOKENS.buttonLabel}
}
@media (forced-colors:active){
  .ada-conversation:focus-visible{
    forced-color-adjust:none;
    background:Highlight;
    color:HighlightText
  }
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

/** A tap on the box (its name tab included) calls onDismiss, which ends the whole conversation. */
export function createConversationBox(onDismiss: () => void): ConversationBox {
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
  let disposed = false;
  let lineKey: string | null = null;
  const register = () => {
    const generation = lineKey;
    return bindAdaAction(
      {
        beforeClick: (event) => event.stopPropagation(),
        click: {
          availability: () =>
            lineKey !== null && !root.closest("[hidden], [inert]")
              ? { kind: "available" }
              : { kind: "omitted" },
          run: onDismiss,
        },
        current: () => !disposed && lineKey === generation && root.isConnected,
        slopPx: () => SCROLL.dragThreshold * readViewUnit(root),
      },
      root,
    );
  };
  let action = register();
  try {
    document.getElementById(VIEW_HOST_ID)?.append(root);
  } catch (error) {
    action.dispose();
    root.remove();
    throw error;
  }
  let shown = "";
  let shownFrame = -1;
  return {
    dispose: () => {
      disposed = true;
      selectPortraitCrop(face, undefined);
      action.dispose();
      root.remove();
    },
    render(line, desktop, reducedMotion) {
      if (disposed) {
        return;
      }
      const nextLine = line?.key ?? null;
      if (nextLine !== lineKey) {
        action.dispose();
        lineKey = nextLine;
        action = register();
      }
      const key = line ? `${line.key}:${desktop}:${line.name}` : "";
      if (key !== shown) {
        shown = key;
        root.hidden = line === null;
        root.toggleAttribute("data-emergency", line?.key === EMERGENCY_RETURN.key);
        if (line) {
          root.dataset.side = line.side;
          root.dataset.speaker = line.speaker;
          root.toggleAttribute("data-named", line.named);
          face.dataset.speaker = line.speaker;
          selectPortraitCrop(face, CAST_COMPACT[line.speaker]);
          name.textContent = line.name;
          // Keyboard wording is words alone; touch wording follows each named control with its icon.
          if (desktop && !line.text.includes("{useIcon}")) {
            words.textContent = line.desktop ?? controlHelpText(CONTROL_WORDS, line.text);
          } else {
            words.replaceChildren(...createControlHelp(document, CONTROL_WORDS, line.text));
          }
        } else {
          selectPortraitCrop(face, undefined);
        }
        shownFrame = -1;
      }
      let opacity = "";
      if (line?.discoveryFadeEnd !== undefined) {
        const fade = (reducedMotion ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.fadeMs) / 1000;
        const remaining = line.discoveryFadeEnd - line.elapsed;
        opacity = String(Math.min(1, Math.max(0, remaining / fade)));
      }
      if (root.style.opacity !== opacity) {
        root.style.opacity = opacity;
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
    reducedMotion(): boolean;
    skip(): void;
  },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal ada-interaction-modal";
  modal.hidden = true;
  let disposed = false;
  const state = new InteractionConversation();
  const skipAction = createStandardTextAction(parent, CONTENT.labels.skip ?? "", {
    availability: (button) => (button?.disabled ? { kind: "disabled" } : { kind: "available" }),
    current: () => !disposed && !state.atChoice,
    run: () => {
      if (state.atChoice) {
        return;
      }
      state.skip();
      const choices = state.choices;
      if (choices.length === 1 && choices[0]?.id === "continue") {
        options.skip();
      }
      draw();
    },
  });
  const skip = skipAction.element;
  skip.classList.add("ada-compact", "ada-story-skip");
  skip.dataset.action = "dialogue-skip";
  skip.hidden = true;
  const closeAction = createStandardCloseAction(
    parent,
    "conversation-close",
    CONTENT.labels.close ?? "",
    {
      current: (button) => !disposed && button.isConnected,
      run: () => close(),
      slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
      slopThreshold: SCROLL.dragThreshold,
    },
  );
  let card: ReturnType<typeof createDialoguePanel>;
  try {
    card = createDialoguePanel({
      close: closeAction.element,
      skip,
      title: "",
    });
  } catch (error) {
    skipAction.dispose();
    closeAction.dispose();
    throw error;
  }
  card.card.dataset.dialog = "conversation";
  modal.append(card.frame);
  let actions: { dispose(): void }[] = [];
  let leaveView: (() => void) | undefined;
  let returnFocus: HTMLElement | null = null;
  let signature = "";
  let checkedAttached = false;
  const hide = () => {
    modal.hidden = true;
    leaveView?.();
    leaveView = undefined;
    returnFocus = null;
    state.reset();
    signature = "";
  };
  const disposePageActions = () => {
    for (const action of actions) {
      action.dispose();
    }
    actions = [];
  };
  const rejectPage = () => {
    hide();
    disposePageActions();
    card.choices.replaceChildren();
    card.controls.replaceChildren();
  };
  const isPrimary = (button: Element) => button.className.split(" ").includes("ada-primary");
  // The controls row's primary button, if it has one.
  const controlsPrimary = (): HTMLButtonElement | null =>
    ([...card.controls.children] as HTMLButtonElement[]).find(isPrimary) ?? null;
  // Focus starts on the first choice, else the controls' primary, else their first.
  const defaultFocus = (): HTMLButtonElement | null =>
    card.choices.querySelector<HTMLButtonElement>("button") ??
    controlsPrimary() ??
    card.controls.querySelector<HTMLButtonElement>("button");
  const draw = (reveal = false): void => {
    const nextActions: typeof actions = [];
    const choices: HTMLButtonElement[] = [];
    const controls: HTMLButtonElement[] = [];
    // Refused outcomes keep the current page and the original button while the cue plays.
    const add = (label: string, callback: (() => void) | null, choice = false, primary = false) => {
      let stopRefusal: (() => void) | undefined;
      const action = createStandardTextAction(parent, label, {
        availability: (button) => (button?.disabled ? { kind: "disabled" } : { kind: "available" }),
        current: () => !disposed && action.element.isConnected,
        run: () => {
          if (!callback) {
            if (
              !button.hasAttribute(REFUSAL_ATTRIBUTES.red) &&
              !button.hasAttribute(REFUSAL_ATTRIBUTES.shake)
            ) {
              stopRefusal = refuse(button, options.reducedMotion());
            }
            return;
          }
          callback();
          draw();
        },
      });
      const { element: button } = action;
      button.classList.add("ada-story-button");
      button.classList.toggle("ada-primary", primary);
      setButtonRole(primary ? "primary" : "secondary", button);
      button.hidden = true;
      nextActions.push({
        dispose() {
          action.dispose();
          stopRefusal?.();
        },
      });
      assertAdaActionMetadata(button);
      // The controls share a row with the primary rightmost: a secondary goes before it.
      const row = choice ? choices : controls;
      const before = choice || primary ? -1 : row.findIndex(isPrimary);
      row.splice(before === -1 ? row.length : before, 0, button);
    };
    try {
      for (const [index, topic] of state.topics.entries()) {
        add(topic.label, () => state.topic(index), true);
      }
      if (!state.atOutcome) {
        add(
          CONTENT.labels.continue ?? "",
          () => {
            const action = state.advance();
            if (action) {
              options.choose(action);
            }
          },
          false,
          true,
        );
      } else {
        for (const choice of state.choices) {
          add(
            choice.label,
            choice.refused ? null : () => options.choose(choice.id),
            choice.id !== "continue",
            state.choices.length === 1,
          );
        }
      }
      if (state.hasTopics && !state.choosingTopic && !state.atChoice) {
        add(CONTENT.labels.askMore ?? "Ask more", () => state.ask());
      }
      disposePageActions();
      card.choices.replaceChildren(...choices);
      card.controls.replaceChildren(...controls);
      if (modal.isConnected) {
        for (const button of [...choices, ...controls]) {
          assertAdaActionBindings(button);
        }
      } else {
        checkedAttached = false;
      }
    } catch (error) {
      for (const action of nextActions) {
        action.dispose();
      }
      rejectPage();
      throw error;
    }
    actions = nextActions;
    for (const button of [...choices, ...controls]) {
      button.hidden = false;
    }
    const line = state.line;
    card.showLine(line?.speaker, line?.text ?? "");
    skip.hidden = state.atChoice;
    if (reveal) {
      modal.hidden = false;
    }
    card.fit();
    defaultFocus()?.focus({ preventScroll: true });
  };
  const close = (): void => {
    state.skip();
    options.close();
    draw();
  };
  try {
    assertAdaActionMetadata(modal);
    parent.append(modal);
    if (modal.isConnected) {
      assertAdaActionBindings(modal);
      checkedAttached = true;
    }
  } catch (error) {
    skipAction.dispose();
    closeAction.dispose();
    card.dispose();
    modal.remove();
    throw error;
  }
  const layer = createModalLayer(modal);
  return {
    back: close,
    dispose() {
      disposed = true;
      skipAction.dispose();
      closeAction.dispose();
      disposePageActions();
      returnFocus = null;
      layer.dispose();
      leaveView = undefined;
      card.dispose();
      modal.remove();
    },
    isOpen: () => !modal.hidden,
    show(
      context: import("../model/conversations.ts").InteractionContext,
      panel: import("../model/types.ts").DialogueState | null,
    ) {
      if (disposed) {
        return;
      }
      if (panel && !leaveView) {
        returnFocus =
          document.activeElement instanceof (document.defaultView?.HTMLElement ?? HTMLElement)
            ? document.activeElement
            : null;
      }
      if (!panel) {
        hide();
        return;
      }
      if (!checkedAttached && modal.isConnected) {
        try {
          assertAdaActionBindings(modal);
          checkedAttached = true;
        } catch (error) {
          rejectPage();
          throw error;
        }
      }
      const copy = interactionCopy(context, panel);
      state.show(copy, panel);
      const next = JSON.stringify(panel);
      if (signature !== next) {
        signature = next;
        card.title.textContent = "";
        card.frame.setAttribute("aria-label", state.party);
        draw(true);
      } else {
        modal.hidden = false;
      }
      if (!card.frame.isConnected) {
        return;
      }
      leaveView ??= layer.open(
        {
          backdrop: modal,
          close,
          focus: defaultFocus() ?? card.close,
          isolation: "dialog",
          restore: () => returnFocus,
        },
        card.frame,
      );
    },
  };
}
