import type { Background } from "../data/storybook.ts";
import { font, fromHudEdge, safeEdge, units } from "./layout/css.ts";
import { HUD_BUTTON, STORY_SKIP } from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, TEXT_TOKENS } from "./modal.ts";

export interface StoryLabels {
  readonly next: string;
  readonly previous: string;
  readonly skip: string;
}

export interface StoryPageView {
  readonly background: Background;
  readonly speaker?: string;
  readonly text: string;
  readonly choices?: readonly { readonly label: string }[];
  /** Whether Next (or its named action) shows: every page but a choice page. */
  readonly next: boolean;
  readonly action?: string;
  readonly canGoBack: boolean;
}

export interface StoryOptions {
  readonly labels: StoryLabels;
  readonly onChoose: (index: number) => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onSkip: () => void;
}

// PLACEHOLDER (Art): flat low-contrast fills until Art's seven Earth backgrounds and the cockpit
// land; each page names its background by key, so the art drops in by key.
export const BACKGROUND_PLACEHOLDERS: Readonly<Record<Background, string>> = {
  adaRoom: "#5b4a6b",
  cockpit: "#26304a",
  frontDoor: "#6b5a4a",
  gardenLot: "#4f6447",
  grandmaGarden: "#5e6b4a",
  park: "#4a6b5e",
  schoolHallway: "#5a5a6b",
  schoolyard: "#6b6450",
};

// The available rect: the page inset from each safe edge.
const AVAILABLE_WIDTH = `calc(100% - ${safeEdge("left", SPACING.pageInset)} - ${safeEdge(
  "right",
  SPACING.pageInset,
)})`;
// The panel grows up to a gap below the HUD row, so it never covers Skip or the settings button.
const AVAILABLE_HEIGHT = `calc(100% - ${fromHudEdge("top", HUD_BUTTON.target + SPACING.gap)} - ${safeEdge(
  "bottom",
  SPACING.pageInset,
)})`;

export const STORYBOOK_STYLE = `
.ada-controls .ada-story-background{
  position:absolute;
  inset:0;
  pointer-events:auto
}

.ada-controls .ada-story-panel{
  position:absolute;
  left:50%;
  bottom:${safeEdge("bottom", SPACING.pageInset)};
  transform:translateX(-50%);
  width:min(${AVAILABLE_WIDTH}, ${units(STORY_PANEL.maxWidth)});
  max-height:${AVAILABLE_HEIGHT};
  padding:${units(STORY_PANEL.padding)};
  gap:${units(STORY_PANEL.gap)};
  pointer-events:auto
}

.ada-controls .ada-story-text{
  flex:0 1 auto;
  min-height:0;
  overflow-y:auto;
  display:flex;
  flex-direction:column;
  gap:${units(STORY_PANEL.speakerGap)}
}

.ada-controls .ada-story-panel .ada-story-speaker{
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.title}
}

.ada-controls .ada-story-panel .ada-story-paragraph{
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.label}
}

/* Previous at the inner left, Next or the named action at the inner right; the two share one
   width, set from the wider label as each page renders. */
.ada-controls .ada-story-controls{
  flex:none;
  display:flex;
  justify-content:space-between;
  gap:${units(STORY_PANEL.gap)}
}

/* PROVISIONAL (Art): Skip, apart from page navigation, at the top right left of the settings
   button (STORY_SKIP). */
.ada-controls .ada-story-skip{
  position:absolute;
  top:${fromHudEdge("top", STORY_SKIP.top)};
  right:${fromHudEdge("right", STORY_SKIP.right)}
}
`;

/**
 * A storybook page: the full location background with its bottom panel of text, choices and
 * page controls, with Skip apart at the top right on every page. Previous (left) uses the
 * disabled face on a scene's first page; Next (right) is absent on a choice page and shows a
 * page's named action in its slot. A question page shows its
 * remaining questions with Continue in Next's slot.
 */
export function createStorybook(root: HTMLElement, options: StoryOptions) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = STORYBOOK_STYLE;
  const layer = document.createElement("div");
  layer.className = "ada-story";
  layer.hidden = true;
  const background = document.createElement("div");
  background.className = "ada-story-background";
  const panel = document.createElement("section");
  panel.className = "ada-card ada-story-panel";
  panel.setAttribute("role", "region");
  const text = document.createElement("div");
  text.className = "ada-story-text";
  const speaker = document.createElement("p");
  speaker.className = "ada-story-speaker";
  const paragraph = document.createElement("p");
  paragraph.className = "ada-story-paragraph";
  text.append(speaker, paragraph);
  const choices = document.createElement("div");
  choices.className = "ada-actions ada-stack ada-story-choices";
  const controls = document.createElement("div");
  controls.className = "ada-story-controls";
  const skip = createButton(labels.skip);
  skip.classList.add("ada-compact", "ada-story-skip");
  skip.dataset.action = "story-skip";
  const previous = createButton(labels.previous);
  previous.dataset.action = "story-previous";
  const next = createButton(labels.next, "primary");
  next.dataset.action = "story-next";
  const pageButtons = { next, previous };
  controls.append(...STORY_PANEL.pageControls.map((id) => pageButtons[id]));
  panel.append(text, choices, controls);
  layer.append(background, panel, skip);
  // First in the controls layer, so the HUD's settings button draws and presses above the page.
  root.prepend(style, layer);
  skip.addEventListener("click", () => options.onSkip());
  previous.addEventListener("click", () => options.onPrevious());
  next.addEventListener("click", () => options.onNext());
  // What the layer last showed; re-rendering only on a change keeps each button across frames.
  let shown = "";
  const setBackground = (key: Background) => {
    background.dataset.background = key;
    background.style.background = BACKGROUND_PLACEHOLDERS[key];
  };
  // Shows a page, or only a background (the cockpit behind galaxy selection), or nothing.
  const show = (page: StoryPageView | null, backdrop: Background | null = null): void => {
    const signature = JSON.stringify([page, backdrop]);
    if (signature === shown) {
      return;
    }
    const focusFirst = shown !== "" && page !== null;
    shown = signature;
    layer.hidden = page === null && backdrop === null;
    panel.hidden = page === null;
    skip.hidden = page === null;
    if (!page) {
      if (backdrop) {
        setBackground(backdrop);
      }
      return;
    }
    setBackground(page.background);
    speaker.hidden = !page.speaker;
    speaker.textContent = page.speaker ?? "";
    paragraph.hidden = page.text === "";
    paragraph.textContent = page.text;
    text.hidden = !page.speaker && page.text === "";
    panel.setAttribute("aria-label", page.speaker ?? page.text);
    const buttons = (page.choices ?? []).map(({ label }, index) => {
      const button = createButton(label);
      button.dataset.action = "story-choice";
      button.dataset.choice = String(index);
      button.addEventListener("click", () => options.onChoose(index));
      return button;
    });
    choices.replaceChildren(...buttons);
    choices.hidden = buttons.length === 0;
    previous.disabled = !page.canGoBack;
    next.hidden = !page.next;
    next.textContent = page.action ?? labels.next;
    // Previous and Next share the wider one's width, in logical px.
    const pageControls = [previous, next];
    for (const button of pageControls) {
      button.style.width = "";
    }
    const unit = readViewUnit(panel);
    // offsetWidth rounds to whole CSS px, so the next px up keeps the widest label on one line.
    const widest =
      Math.max(
        ...pageControls.filter((button) => !button.hidden).map((button) => button.offsetWidth),
      ) + 1;
    for (const button of pageControls) {
      button.style.width = units(widest / unit);
    }
    // Focus starts on the first choice, the default; otherwise on Next.
    if (focusFirst || buttons.length > 0) {
      (buttons[0] ?? next).focus();
    }
  };
  return {
    dispose(): void {
      style.remove();
      layer.remove();
    },
    show,
  };
}
