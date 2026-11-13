import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { CAST, castFrames, type CastKey, castSheet, STORY_CAST } from "../data/cast.ts";
import { GENERAL_NAMED, type Speaker, SPEAKERS } from "../data/conversations.ts";
import type { Background } from "../data/storybook.ts";
import type { StoryChoice, StoryPage } from "../model/storybook.ts";
import {
  AWAITING_TAB,
  COMPACT_PORTRAITS,
  FAMILY_PORTRAITS,
  familyPortrait,
  portraitFrame,
  SPEAKING_FRAME_MS,
  storySpeakerName,
  TAB_COLOURS,
} from "./dialoguePortraits.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, fromHudEdge, safeEdge, slice, units } from "./layout/css.ts";
import { STORY_PANEL_TOP, STORY_ROOM_PANEL_TOP, STORY_SKIP } from "./layout/playView.ts";
import {
  STORY_BACKGROUND,
  STORY_PANEL,
  storyBackgroundTop,
  type SubjectBand,
} from "./layout/storyPage.ts";
import { SMALL_BUTTON_GAP, SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { createButton, FOCUS_STYLE, TEXT_TOKENS } from "./modal.ts";
import {
  breathKeyframes,
  loadStoryArt,
  overnightSeconds,
  type OvernightStep,
  overnightSteps,
  type StoryArt,
  storyBackgroundKey,
  type StoryOverlay,
  type TransitionStep,
  transitionSteps,
} from "./storyArt.ts";

export interface StoryLabels {
  readonly next: string;
  readonly previous: string;
  readonly skip: string;
}

export interface StoryPageView {
  readonly background: Background;
  /** The chapter's panel title, heading the text on opening, resolution and closing pages. */
  readonly heading?: string;
  readonly speaker?: string;
  readonly text: string;
  readonly choices?: readonly { readonly label: string }[];
  /** Whether Next (or its named action) shows: every page but a choice page. */
  readonly next: boolean;
  readonly action?: string;
  readonly canGoBack: boolean;
  /**
   * Whether Skip shows: only where it passes a page Next or the named action would show, so
   * not on the story run's end, the page before it or the sleep scene.
   */
  readonly canSkip: boolean;
  /** Ada's room page, where the pause button shows, so the panel's top cap sits lower. */
  readonly room?: boolean;
  /**
   * The overnight sleep scene: no panel or Skip, and a tap anywhere moves on. Art's overnight
   * sequence plays over it, or its reduced-motion steps when motion is reduced.
   */
  readonly sleep?: boolean;
  /** The holodisk's insertion aboard, where Art's holodisk moment plays over the background. */
  readonly holodisk?: boolean;
  /** The story run the page belongs to: its pages anchor each background for the whole run. */
  readonly run?: { readonly id: string; readonly pages: readonly StoryPage[] };
}

/** A model page as the storybook shows it, with the choices on show. */
export function storyPageView(
  page: StoryPage,
  choices: readonly StoryChoice[],
  canGoBack: boolean,
  canSkip: boolean,
): StoryPageView {
  return {
    background: page.background,
    canGoBack,
    canSkip: canSkip && !page.choices?.length,
    ...(page.heading ? { heading: page.heading } : {}),
    text: page.text,
    ...(page.speaker ? { speaker: page.speaker } : {}),
    ...(choices.length ? { choices: choices.map(({ label }) => ({ label })) } : {}),
    ...(page.action ? { action: page.action } : {}),
    ...(page.id === "room" ? { room: true } : {}),
    ...(page.sleep ? { sleep: true } : {}),
    ...(page.holodisk ? { holodisk: true } : {}),
    next: !page.choices && choices.length === 0,
  };
}

/** A run page at its tallest: every choice or question it offers, as on its first showing. */
function tallestView(page: StoryPage): StoryPageView {
  return storyPageView(page, page.choices ?? page.questions ?? [], true, true);
}

// The breath's alpha curve as linear keyframes, fine enough to follow the cosine.
const BREATH_SAMPLES = 24;

// The speakers with a portrait sheet: the conversation box's own and the cast's.
export type StoryPortraitId =
  keyof typeof COMPACT_PORTRAITS | keyof typeof FAMILY_PORTRAITS | CastKey;

// The cast keys whose story pages speak (data/cast.ts STORY_CAST).
const STORY_CAST_KEYS = Object.keys(CAST) as CastKey[];

// Each speaker's 32 portrait sheet for the storybook panel (art/conversation.md "Sizes"): the same
// frames as the compact sheet, drawn at 2x in the 68 frame.
export const STORY_PORTRAITS: Readonly<
  Partial<Record<StoryPortraitId, { readonly frames: number; readonly url: string }>>
> = {
  ada: { frames: 2, url: "/art/portraits/ada.png" },
  astra: { frames: 5, url: "/art/portraits/astra.png" },
  general: { frames: 10, url: "/art/portraits/gadget.png" },
  penny: { frames: 3, url: "/art/portraits/penny.png" },
  ...FAMILY_PORTRAITS,
  ...Object.fromEntries(
    STORY_CAST_KEYS.map((key) => [
      key,
      { frames: castFrames(key).frames, url: castSheet(key, false) },
    ]),
  ),
};

/** A story page speaker with a portrait, on its side, with whether the General is named. */
export interface StoryPortrait {
  readonly named: boolean;
  readonly side: "left" | "right";
  readonly speaker: StoryPortraitId;
}

/** The portrait for a page's speaker name; null for narration or a speaker Art has not drawn. */
export function storyPortrait(name: string | undefined): StoryPortrait | null {
  const family = familyPortrait(name);
  if (family) {
    return { named: false, side: "right", speaker: family };
  }
  if (name === GENERAL_NAMED.name) {
    return { named: true, side: SPEAKERS.general.side, speaker: "general" };
  }
  const cast =
    name === undefined
      ? undefined
      : (STORY_CAST[name] ??
        (Object.entries(CAST).find(([, member]) => member.name === name)?.[0] as
          CastKey | undefined));
  if (cast) {
    return { named: false, side: "right", speaker: cast };
  }
  const speaker = (Object.keys(COMPACT_PORTRAITS) as (keyof typeof COMPACT_PORTRAITS)[]).find(
    (id) => SPEAKERS[id].name === name,
  );
  return speaker ? { named: false, side: SPEAKERS[speaker].side, speaker } : null;
}

// The tab fills of speakers who appear only on story pages (art/controls.md).
export const STORY_TAB_COLOURS: Readonly<Record<string, string>> = {
  Dad: "#c4a6ec",
  Mom: "#9fd98a",
};

/** The speaker's name tab fill: their story, cast or conversation tab, or the neutral one. */
export function storyTabColour(name: string): string {
  const family = familyPortrait(name);
  const story = STORY_TAB_COLOURS[family ? FAMILY_PORTRAITS[family].address : name];
  if (story) {
    return story;
  }
  const cast =
    STORY_CAST[name] ??
    (Object.entries(CAST).find(([, member]) => member.name === name)?.[0] as CastKey | undefined);
  if (cast) {
    return CAST[cast].tab;
  }
  if (name === GENERAL_NAMED.name) {
    return TAB_COLOURS.generalNamed ?? AWAITING_TAB;
  }
  const speaker = (Object.keys(SPEAKERS) as Speaker[]).find((id) => SPEAKERS[id].name === name);
  return (speaker && TAB_COLOURS[speaker]) ?? AWAITING_TAB;
}

/**
 * The sheet frame a page's portrait shows elapsed seconds after the page appears: a cast
 * member's one neutral frame, Ada's and Penny's neutral face, or Astra's or the General's
 * speaking loop at 120 ms a frame, held on its first frame under reduced motion.
 */
export function storyPortraitFrame(
  reducedMotion: boolean,
  portrait: StoryPortrait,
  elapsed: number,
): number {
  const { speaker } = portrait;
  if (speaker === "mom" || speaker === "dad") {
    return FAMILY_PORTRAITS[speaker].neutral;
  }
  if (!Object.hasOwn(COMPACT_PORTRAITS, speaker)) {
    return castFrames(speaker as CastKey).neutral;
  }
  return portraitFrame(reducedMotion, {
    ...portrait,
    elapsed,
    mood: "neutral",
    speaker: speaker as keyof typeof COMPACT_PORTRAITS,
  });
}

const { image: PORTRAIT_IMAGE, inset: PORTRAIT_EDGE } = STORY_PANEL.portrait;

// Each sheet sized so one frame fills the 64 portrait; storyPortraitFrame picks the frame.
const STORY_PORTRAIT_RULES = Object.entries(STORY_PORTRAITS)
  .map(
    ([speaker, sheet]) => `
.ada-controls .ada-story-portrait[data-speaker="${speaker}"]{
  background:url('${sheet.url}') 0 0 / ${units(sheet.frames * PORTRAIT_IMAGE)} ${units(
    PORTRAIT_IMAGE,
  )} no-repeat
}`,
  )
  .join("");

export interface StoryOptions {
  readonly labels: StoryLabels;
  readonly onChoose: (index: number) => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onSkip: () => void;
  /** Whether a story transition plays as its reduced-motion steps. */
  readonly reducedMotion: () => boolean;
}

// The available rect: the page inset from each safe edge.
const AVAILABLE_WIDTH = `calc(100% - ${safeEdge("left", SPACING.pageInset)} - ${safeEdge(
  "right",
  SPACING.pageInset,
)})`;
// The panel grows from the available bottom up to its top cap, below the HUD row's lowest press
// area: Skip and Settings, or the pause button on Ada's room page.
const availableHeight = (top: number) =>
  `calc(100% - ${fromHudEdge("top", top)} - ${safeEdge("bottom", SPACING.pageInset)})`;

// The background canvas's width: display size, or the view's width or its height at the canvas's
// aspect, whichever is largest.
const ART_WIDTH = `max(${units(STORY_BACKGROUND.width)}, 100cqw, calc(100cqh * ${
  STORY_BACKGROUND.width
} / ${STORY_BACKGROUND.height}))`;

// The panel's padding, including the card's 2 frame.
const PANEL_PADDING = `calc(${units(STORY_PANEL.padding)} - ${slice(2)})`;
const { choiceColumn, columnGap, rule } = STORY_PANEL;
// The choice column: its share of the inner width less the column gap, within its min and max.
const CHOICE_WIDTH = `clamp(${units(choiceColumn.min)}, calc((100% - ${units(columnGap)}) * ${
  choiceColumn.share
}), ${units(choiceColumn.max)})`;
const { tab } = CONVERSATION_BOX;

export const STORYBOOK_STYLE = `
.ada-controls .ada-story-background{
  position:absolute;
  inset:0;
  overflow:hidden;
  container-type:size;
  pointer-events:auto
}

/* Art's canvas at display size, centred across the view under the insets and scaled up only to
   cover a view past it, nearest neighbour; its top is the story run's anchor for its background
   (art/layout.md "Run anchor"), set as each page shows. The second image is a transition's
   incoming frame, faded in over the first. */
.ada-controls .ada-story-art{
  position:absolute;
  left:50%;
  top:0;
  width:${ART_WIDTH};
  aspect-ratio:${STORY_BACKGROUND.width} / ${STORY_BACKGROUND.height};
  transform:translateX(-50%);
  background:center / 100% 100% no-repeat;
  image-rendering:pixelated
}

/* A composite background's overlay, and the overnight sequence's, placed on the canvas by the
   manifest's at, nearest neighbour. */
.ada-controls .ada-story-overlay{
  position:absolute;
  background:0 0 / 100% 100% no-repeat;
  image-rendering:pixelated;
  pointer-events:none
}

/* The light spread: the text column and the choice column side by side, the panel only as tall as
   its page needs up to its top cap, its width and bottom edge fixed. */
.ada-controls .ada-story-panel{
  position:absolute;
  left:50%;
  bottom:${safeEdge("bottom", SPACING.pageInset)};
  transform:translateX(-50%);
  width:min(${AVAILABLE_WIDTH}, ${units(STORY_PANEL.maxWidth)});
  max-width:none;
  max-height:${availableHeight(STORY_PANEL_TOP)};
  padding:${PANEL_PADDING};
  flex-direction:row;
  align-items:stretch;
  gap:${units(columnGap)};
  pointer-events:auto
}
.ada-controls .ada-story-panel.ada-story-room{
  max-height:${availableHeight(STORY_ROOM_PANEL_TOP)}
}

/* The text column: the heading, the name tab and portrait, then the paragraph; it alone scrolls,
   once the panel reaches its top cap, reserving the scroll track on its right. */
.ada-controls .ada-story-copy{
  flex:1 1 0;
  min-width:0;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-color:#9690b4 #2f2d3d
}
.ada-controls .ada-story-copy.ada-story-scrolls{
  padding-right:${units(SCROLL.gap + SCROLL.track)}
}
.ada-controls .ada-story-copy:focus-visible{${FOCUS_STYLE}
}

/* Floats stay inside, so the column's height includes a portrait taller than its text. */
.ada-controls .ada-story-text{
  display:flow-root
}

/* The chapter heading: left-aligned on the column's first line, unlike a card title. */
.ada-controls .ada-story-panel .ada-story-heading{
  margin:0 0 ${units(SPACING.gap)};
  font:${font(TYPE.heading)};
  text-align:left;
  color:${TEXT_TOKENS.title}
}

/* The speaker's name tab, as the conversation box's, a gap above the paragraph; it sits beside
   the portrait, never under it. */
.ada-controls .ada-story-panel .ada-story-tab{
  display:flow-root;
  width:max-content;
  box-sizing:border-box;
  height:${units(tab.height)};
  margin:0 0 ${units(SPACING.gap)};
  padding:0 ${units(tab.labelInset - tab.edge)};
  border:${units(tab.edge)} solid ${CONVERSATION_BOX.panel.ink};
  border-radius:${units(tab.radius)};
  font:${font(TYPE.label)};
  line-height:${units(tab.height - 2 * tab.edge)};
  white-space:nowrap;
  color:${CONVERSATION_BOX.panel.ink}
}

.ada-controls .ada-story-panel .ada-story-paragraph{
  margin:0;
  font:${font(TYPE.story)};
  color:${TEXT_TOKENS.label}
}

/* The 68 frame: a 2 ink edge round the navy face, the 32 sheet at 2x inside, floated on the
   column's top: at the inner right for every speaker but Ada, at the inner left for Ada; never
   mirrored. The tab and paragraph wrap beside it, a gap away, then take the full measure. */
.ada-controls .ada-story-frame{
  float:right;
  box-sizing:border-box;
  width:${units(STORY_PANEL.portrait.frame)};
  height:${units(STORY_PANEL.portrait.frame)};
  margin:0 0 ${units(SPACING.rowGap)} ${units(SPACING.gap)};
  border:${units(PORTRAIT_EDGE)} solid ${CONVERSATION_BOX.panel.ink};
  background:${CONVERSATION_BOX.portrait.face}
}
.ada-controls .ada-story-text[data-side="left"] .ada-story-frame{
  float:left;
  margin:0 ${units(SPACING.gap)} ${units(SPACING.rowGap)} 0
}

.ada-controls .ada-story-portrait{
  display:block;
  width:${units(PORTRAIT_IMAGE)};
  height:${units(PORTRAIT_IMAGE)};
  image-rendering:pixelated
}
${STORY_PORTRAIT_RULES}

/* The choice column: the choices stacked from its top, a full-row named action, then the page
   controls on its bottom, small buttons SMALL_BUTTON_GAP apart in every direction. A 1 rule in
   the card rim runs the full inner height in the middle of the column gap. */
.ada-controls .ada-story-choice-column{
  flex:0 0 ${CHOICE_WIDTH};
  min-height:0;
  position:relative;
  display:flex;
  flex-direction:column;
  gap:${units(SMALL_BUTTON_GAP)}
}
.ada-controls .ada-story-choice-column::before{
  content:"";
  position:absolute;
  top:0;
  bottom:0;
  left:${units(-(columnGap + rule.width) / 2)};
  width:${units(rule.width)};
  background:${rule.colour}
}

/* The choices stack from the column's top. A page past Gameplay's limits, whose page controls
   would fall below the panel at its top cap, scrolls its choices in their own region, reserving
   the scroll track, with the page controls fixed below. Other pages never scroll them, so the
   press areas past their faces stay unclipped. */
.ada-controls .ada-story-choices{
  display:flex;
  flex-direction:column;
  gap:${units(SMALL_BUTTON_GAP)}
}
.ada-controls .ada-story-choices.ada-story-scrolls{
  flex:0 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-color:#9690b4 #2f2d3d;
  padding-right:${units(SCROLL.gap + SCROLL.track)}
}
.ada-controls .ada-story-choices > .ada-button{
  flex:none;
  width:100%
}

/* Previous at the left and Next at the right, each half the column less the gap. A named action
   too wide for its half sits beside Previous, Previous at its own width and the action taking the
   rest, when the two fit side by side at their own widths; otherwise it fills the column on its
   own row SMALL_BUTTON_GAP below Previous, which keeps its left half (art/layout.md "Named
   action"). */
.ada-controls .ada-story-controls{
  flex:none;
  margin-top:auto;
  display:grid;
  grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas:"previous next";
  gap:${units(SMALL_BUTTON_GAP)}
}
.ada-controls .ada-story-controls.ada-story-no-previous{
  grid-template-columns:minmax(0,1fr);
  grid-template-areas:"next"
}
.ada-controls .ada-story-controls.ada-story-no-next{
  grid-template-columns:minmax(0,1fr);
  grid-template-areas:"previous"
}
.ada-controls .ada-story-controls.ada-story-beside{
  grid-template-columns:max-content minmax(0, 1fr)
}
.ada-controls .ada-story-controls.ada-story-wide{
  grid-template-areas:"previous ." "next next";
}
.ada-controls .ada-story-controls > [data-action="story-previous"]{
  grid-area:previous
}
.ada-controls .ada-story-controls > [data-action="story-next"]{
  grid-area:next;
  white-space:nowrap
}
.ada-controls .ada-story-controls.ada-story-wide > [data-action="story-next"]{
  white-space:normal
}

/* Skip, apart from page navigation, in the HUD row left of the settings button (STORY_SKIP), or
   on the HUD rect's top-right corner while the settings button is hidden. */
.ada-controls .ada-story-skip{
  position:absolute;
  top:${fromHudEdge("top", STORY_SKIP.top)};
  right:${fromHudEdge("right", STORY_SKIP.right.besideSettings)}
}
.ada-controls.ada-no-settings-button .ada-story-skip{
  right:${fromHudEdge("right", STORY_SKIP.right.corner)}
}
`;

/** How a page's Previous and primary share the choice column's bottom. */
export type StoryControlsLayout = "below" | "beside" | "halves";

/**
 * The page controls' layout in a choice column `column` wide, from Previous's and the primary's
 * own widths, in logical px (art/layout.md "Named action"): halves while the primary fits its half,
 * beside Previous while both fit the column with SMALL_BUTTON_GAP between, else below Previous.
 */
export function storyControlsLayout(
  column: number,
  previous: number,
  primary: number,
): StoryControlsLayout {
  if (primary <= (column - SMALL_BUTTON_GAP) / 2 + 0.5) {
    return "halves";
  }
  return previous + SMALL_BUTTON_GAP + primary <= column + 0.5 ? "beside" : "below";
}

/**
 * A storybook page: the full location background with its bottom spread of text and choices,
 * with Skip apart at the top right on every page but the story run's end and the sleep scene.
 * The text column holds the chapter heading, the speaker's tab and portrait, then the paragraph;
 * the choice column holds the choices and the page controls: Previous (left), disabled on the
 * run's first page, and Next (right), absent on a choice page, showing a page's named action in
 * its slot or on its own row when the action is too wide. A question page shows its remaining
 * questions with Continue in Next's place. Each background keeps one placement for the story run,
 * anchored on the run's tallest page on it. Between two pages whose images Art's story
 * transition joins (Ada's room to aboard), the panel hides while its frames play.
 */
export function createStorybook(root: HTMLElement, options: StoryOptions) {
  const { labels } = options;
  const layer = document.createElement("div");
  layer.className = "ada-story";
  layer.hidden = true;
  const background = document.createElement("div");
  background.className = "ada-story-background";
  const [base, incoming] = [0, 1].map(() => {
    const image = document.createElement("div");
    image.className = "ada-story-art";
    background.append(image);
    return image;
  }) as [HTMLDivElement, HTMLDivElement];
  incoming.style.opacity = "0";
  // Overlays draw over the base image, by id: a composite's at full, the overnight's as it plays.
  const overlays = new Map<string, HTMLDivElement>();
  const panel = document.createElement("section");
  panel.className = "ada-card ada-story-panel";
  panel.setAttribute("role", "region");
  // The text column scrolls on its own past the top cap.
  const copy = document.createElement("div");
  copy.className = "ada-story-copy";
  const text = document.createElement("div");
  text.className = "ada-story-text";
  const heading = document.createElement("h2");
  heading.className = "ada-story-heading";
  const portraitFrameNode = document.createElement("div");
  portraitFrameNode.className = "ada-story-frame";
  portraitFrameNode.setAttribute("aria-hidden", "true");
  const face = document.createElement("span");
  face.className = "ada-story-portrait";
  portraitFrameNode.append(face);
  const speaker = document.createElement("p");
  speaker.className = "ada-story-tab";
  const paragraph = document.createElement("p");
  paragraph.className = "ada-story-paragraph";
  text.append(heading, portraitFrameNode, speaker, paragraph);
  copy.append(text);
  const column = document.createElement("div");
  column.className = "ada-story-choice-column";
  const choices = document.createElement("div");
  choices.className = "ada-story-choices";
  const controls = document.createElement("div");
  controls.className = "ada-story-controls";
  const skip = createButton(labels.skip);
  skip.classList.add("ada-compact", "ada-story-skip");
  skip.dataset.action = "story-skip";
  const previous = createButton(labels.previous);
  previous.classList.add("ada-story-button");
  previous.dataset.action = "story-previous";
  const next = createButton(labels.next, "primary");
  next.classList.add("ada-story-button");
  next.dataset.action = "story-next";
  // In focus order: the full-row named action before Previous, else Previous then Next.
  controls.append(previous, next);
  column.append(choices, controls);
  panel.append(copy, column);
  layer.append(background, panel, skip);
  // The page goes first in the controls layer, so the HUD's settings button draws and presses
  // above it. Its style follows the shared card styles it refines (src/ui/stylesheet.ts).
  root.prepend(layer);
  skip.addEventListener("click", () => options.onSkip());
  previous.addEventListener("click", () => options.onPrevious());
  next.addEventListener("click", () => options.onNext());
  // On the sleep scene a tap anywhere moves on; the model ignores one before its skip delay.
  background.addEventListener("click", () => {
    if (rendered?.sleep) {
      options.onNext();
    }
  });
  let art: StoryArt = {
    backgrounds: {},
    bases: {},
    composites: {},
    holodisk: null,
    overnight: null,
    subjects: {},
    transitions: [],
  };
  // What the layer last showed; re-rendering only on a change keeps each button across frames.
  let shown = "";
  let shownKey: Background | null = null;
  let lastPage: StoryPageView | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fade: Animation | undefined;
  let rendered: StoryPageView | null = null;
  let backdropShown: Background | null = null;
  // The story run measured, and its tallest page's panel top on each background, logical px.
  let measuredRun = "";
  let stripTops = new Map<Background, number>();
  // The speaking loop's timer while a looping speaker's page shows.
  let portraitTimer: ReturnType<typeof setInterval> | undefined;
  const stopPortrait = () => {
    clearInterval(portraitTimer);
    portraitTimer = undefined;
  };
  // Runs the page speaker's speaking loop while the page shows.
  const playPortrait = (page: StoryPageView) => {
    stopPortrait();
    const portrait = storyPortrait(page.speaker);
    if (!portrait) {
      return;
    }
    let ticks = 0;
    const draw = () => {
      const index = storyPortraitFrame(
        options.reducedMotion(),
        portrait,
        (ticks * SPEAKING_FRAME_MS) / 1000,
      );
      face.dataset.frame = String(index);
      face.style.backgroundPositionX = units(-index * PORTRAIT_IMAGE);
    };
    draw();
    const compact = Object.hasOwn(COMPACT_PORTRAITS, portrait.speaker)
      ? COMPACT_PORTRAITS[portrait.speaker as keyof typeof COMPACT_PORTRAITS]
      : undefined;
    if (compact && "speaking" in compact) {
      portraitTimer = setInterval(() => {
        ticks += 1;
        draw();
      }, SPEAKING_FRAME_MS);
    }
  };
  // Lays a page's content into the panel: heading, tab and portrait on their side, paragraph,
  // choices and page controls, the named action on its own row when it does not fit its half,
  // and the text column's scroll reserve when it scrolls. Returns the choice buttons.
  const fill = (page: StoryPageView): HTMLButtonElement[] => {
    panel.classList.toggle("ada-story-room", page.room === true);
    heading.hidden = !page.heading;
    heading.textContent = page.heading ?? "";
    speaker.hidden = !page.speaker;
    speaker.textContent = storySpeakerName(page.speaker ?? "");
    speaker.style.background = page.speaker ? storyTabColour(page.speaker) : "";
    paragraph.hidden = page.text === "";
    paragraph.textContent = page.text;
    const portrait = storyPortrait(page.speaker);
    portraitFrameNode.hidden = portrait === null;
    text.dataset.side = portrait?.side ?? "right";
    if (portrait) {
      face.dataset.speaker = portrait.speaker;
      const index = storyPortraitFrame(options.reducedMotion(), portrait, 0);
      face.dataset.frame = String(index);
      face.style.backgroundPositionX = units(-index * PORTRAIT_IMAGE);
    } else {
      delete face.dataset.speaker;
    }
    panel.setAttribute("aria-label", page.heading ?? page.speaker ?? page.text);
    const buttons = (page.choices ?? []).map(({ label }, index) => {
      const button = createButton(label);
      button.classList.add("ada-story-button");
      button.dataset.action = "story-choice";
      button.dataset.choice = String(index);
      button.addEventListener("click", () => options.onChoose(index));
      return button;
    });
    choices.replaceChildren(...buttons);
    choices.hidden = buttons.length === 0;
    previous.hidden = !page.canGoBack;
    controls.hidden = !page.canGoBack && !page.next;
    controls.classList.toggle("ada-story-no-previous", !page.canGoBack);
    controls.classList.toggle("ada-story-no-next", !page.next);
    next.hidden = !page.next;
    next.textContent = page.action ?? labels.next;
    // A named action too wide for its half sits beside Previous when both fit at their own widths,
    // else on the column's full row below it. Each face is measured at its label's width; the
    // press area's pseudo-element overflows the face, so the face's own box is measured.
    controls.classList.remove("ada-story-beside", "ada-story-wide");
    controls.replaceChildren(previous, next);
    let layout: StoryControlsLayout = "halves";
    if (page.canGoBack && page.next && page.action !== undefined) {
      const unit = readViewUnit(controls);
      previous.style.width = "max-content";
      next.style.width = "max-content";
      layout = storyControlsLayout(
        controls.getBoundingClientRect().width / unit,
        previous.getBoundingClientRect().width / unit,
        next.getBoundingClientRect().width / unit,
      );
      previous.style.width = "";
      next.style.width = "";
    }
    controls.classList.toggle("ada-story-beside", layout === "beside");
    controls.classList.toggle("ada-story-wide", layout === "below");
    // Previous first in either layout, so focus order follows the rows.
    // A page past Gameplay's limits scrolls its choices, the page controls fixed below: one whose
    // page controls fall below the choice column at the panel's top cap.
    choices.classList.remove("ada-story-scrolls");
    const overflows =
      controls.getBoundingClientRect().bottom > column.getBoundingClientRect().bottom + 0.5;
    choices.classList.toggle("ada-story-scrolls", overflows);
    // Only the text column scrolls, focusable while it does, past the panel's top cap.
    copy.classList.remove("ada-story-scrolls");
    const scrolls = copy.scrollHeight > copy.clientHeight + 1;
    copy.classList.toggle("ada-story-scrolls", scrolls);
    if (scrolls) {
      copy.tabIndex = 0;
    } else {
      copy.removeAttribute("tabindex");
    }
    return buttons;
  };
  // The logical view and the panel's top in it, as laid out now.
  const viewSize = () => {
    const unit = readViewUnit(panel);
    return {
      height: background.clientHeight / unit,
      unit,
      width: background.clientWidth / unit,
    };
  };
  const panelTop = (unit: number) =>
    (panel.getBoundingClientRect().top - background.getBoundingClientRect().top) / unit;
  // The background a key is placed as: a composite's base, else itself.
  const anchorOf = (key: Background): Background => art.bases[key] ?? key;
  // Measures each page of the story run in the panel, keeping the highest panel top on each
  // background: the run's anchor for it, so the background never moves between its pages.
  const measureRun = (page: StoryPageView) => {
    const run = page.run;
    if (!run || layer.hidden) {
      return;
    }
    measuredRun = run.id;
    const { unit } = viewSize();
    const panelHidden = panel.hidden;
    panel.hidden = false;
    const tops = new Map<Background, number>();
    for (const runPage of run.pages.filter(({ sleep }) => !sleep)) {
      fill(tallestView(runPage));
      const top = panelTop(unit);
      const anchor = anchorOf(runPage.background);
      tops.set(anchor, Math.min(tops.get(anchor) ?? top, top));
    }
    panel.hidden = panelHidden;
    stripTops = tops;
  };
  // The canvas top for a background in the current run: its anchor, or centred without a panel.
  // An alias is placed as its base, so the sleep scene keeps the night's placement.
  const placement = (key: Background, anchored: boolean): string => {
    const { height, width } = viewSize();
    const anchor = anchorOf(key);
    const subject: SubjectBand | null = anchored ? (art.subjects[anchor] ?? null) : null;
    const top = storyBackgroundTop({ height, width }, subject, stripTops.get(anchor) ?? null);
    return units(top);
  };
  const place = (node: HTMLDivElement, key: Background, anchored: boolean) => {
    node.style.top = placement(key, anchored);
  };
  const image = (url: string | undefined) => (url ? `url('${url}')` : "");
  // An overlay element for overlay, placed on the canvas by its box.
  const placeOverlay = (overlay: StoryOverlay, node = document.createElement("div")) => {
    node.className = "ada-story-overlay";
    node.dataset.overlay = overlay.id;
    const { box } = overlay;
    Object.assign(node.style, {
      backgroundImage: image(overlay.url),
      height: `${box.height}%`,
      left: `${box.left}%`,
      top: `${box.top}%`,
      width: `${box.width}%`,
    });
    return node;
  };
  const overlayFor = (overlay: StoryOverlay): HTMLDivElement => {
    let node = overlays.get(overlay.id);
    if (!node) {
      node = placeOverlay(overlay);
      base.append(node);
      overlays.set(overlay.id, node);
    }
    return placeOverlay(overlay, node);
  };
  // An incoming background's overlays, inside the incoming image so they fade in with it.
  const showIncomingOverlays = (shown: readonly StoryOverlay[]) => {
    incoming.replaceChildren(...shown.map((overlay) => placeOverlay(overlay)));
  };
  // Shows these overlays at the given opacity and hides every other.
  const showOverlays = (shown: readonly StoryOverlay[], opacity: number) => {
    const ids = new Set(shown.map(({ id }) => id));
    for (const [id, node] of overlays) {
      node.hidden = !ids.has(id);
    }
    for (const overlay of shown) {
      const node = overlayFor(overlay);
      node.hidden = false;
      node.style.opacity = String(opacity);
    }
  };
  const setBackground = (key: Background, anchored: boolean) => {
    shownKey = key;
    background.dataset.background = key;
    base.style.backgroundImage = image(art.backgrounds[key]);
    place(base, key, anchored);
    showOverlays(art.composites[key] ?? [], 1);
  };
  // The overnight sequence's running animations and step timer.
  let nightTimer: ReturnType<typeof setTimeout> | undefined;
  let nightAnimations: Animation[] = [];
  const stopNight = () => {
    clearTimeout(nightTimer);
    nightTimer = undefined;
    showIncomingOverlays([]);
    for (const animation of nightAnimations) {
      animation.cancel();
    }
    nightAnimations = [];
  };
  // Each step in turn (art/storybook.md "Sequence"): an overlay fades in linearly and holds, a
  // breath runs the overlay's alpha through one cosine, and a background cross-fades the whole
  // picture and ends the overlays. The morning draws at its own page's placement.
  const playNight = (steps: readonly OvernightStep[], index = 0): void => {
    const step = steps[index];
    if (!step) {
      return;
    }
    let ms: number;
    if (step.kind === "overlay") {
      const node = overlayFor(step.overlay);
      node.hidden = false;
      node.style.opacity = "1";
      if (step.fadeMs > 0) {
        nightAnimations.push(
          node.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: step.fadeMs,
            easing: "linear",
          }),
        );
      }
      ms = step.fadeMs + step.holdMs;
    } else if (step.kind === "breath") {
      const node = overlayFor(step.overlay);
      node.hidden = false;
      node.style.opacity = "0";
      nightAnimations.push(
        node.animate(breathKeyframes(BREATH_SAMPLES), { duration: step.ms, easing: "linear" }),
      );
      ms = step.ms;
    } else {
      // Each environment step uses its own anchor, including the initial night hold.
      incoming.style.backgroundImage = image(step.url);
      const key = storyBackgroundKey(art.backgrounds, shownKey, step.url);
      if (key) {
        place(incoming, key, true);
      } else {
        incoming.style.top = base.style.top;
      }
      showIncomingOverlays(step.overlays);
      if (step.fadeMs > 0) {
        nightAnimations.push(
          incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: step.fadeMs,
            easing: "linear",
            fill: "forwards",
          }),
        );
      } else {
        // A zero-duration fade is a cut at the start of the hold.
        base.style.backgroundImage = image(step.url);
        base.style.top = incoming.style.top;
        showOverlays(step.overlays, 1);
        incoming.style.backgroundImage = "";
        showIncomingOverlays([]);
      }
      ms = step.fadeMs + step.holdMs;
    }
    nightTimer = setTimeout(() => {
      if (step.kind === "background") {
        base.style.backgroundImage = image(step.url);
        base.style.top = incoming.style.top;
        showOverlays(step.overlays, 1);
        incoming.style.backgroundImage = "";
        showIncomingOverlays([]);
      }
      for (const animation of nightAnimations.splice(0)) {
        animation.cancel();
      }
      playNight(steps, index + 1);
    }, ms);
  };
  // The sleep page plays Art's overnight sequence from the night: its overlays start clear.
  const startNight = (page: StoryPageView | null) => {
    stopNight();
    const overnight = art.overnight;
    if (!page?.sleep || !overnight) {
      return;
    }
    base.style.backgroundImage = image(overnight.from);
    showOverlays(overnight.overlays, 0);
    playNight(overnightSteps(overnight, options.reducedMotion()));
  };
  // The holodisk page plays Art's holodisk frames over aboard, each fading in over the last; on
  // the next page the frame last shown fades out over exitFadeMs.
  const startHolodisk = (page: StoryPageView | null, exit: StoryOverlay | null) => {
    const holodisk = art.holodisk;
    if (!holodisk) {
      return;
    }
    if (page?.holodisk) {
      for (const overlay of holodisk.overlays) {
        const node = overlayFor(overlay);
        node.hidden = false;
        node.style.opacity = "0";
      }
      playNight(overnightSteps(holodisk, options.reducedMotion()));
      return;
    }
    if (!exit || holodisk.exitFadeMs <= 0) {
      return;
    }
    const node = overlayFor(exit);
    node.hidden = false;
    node.style.opacity = "0";
    nightAnimations.push(
      node.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: holodisk.exitFadeMs,
        easing: "linear",
      }),
    );
    nightTimer = setTimeout(() => {
      node.hidden = true;
      stopNight();
    }, holodisk.exitFadeMs);
  };
  // The holodisk frame on top as the holodisk page leaves, for its exit fade.
  const holodiskFrame = (): StoryOverlay | null =>
    art.holodisk?.overlays.findLast((overlay) => {
      const node = overlays.get(overlay.id);
      return node !== undefined && !node.hidden && node.style.opacity === "1";
    }) ?? null;
  // Ends a running transition step, leaving the base image as it stands.
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    fade?.cancel();
    fade = undefined;
    incoming.style.backgroundImage = "";
  };
  // Each step cross-fades linearly to its image over fadeMs (0 cuts), then holds for holdMs, at
  // the outgoing page's placement; the incoming page then cuts to its own.
  const play = (steps: readonly TransitionStep[], done: () => void, index = 0): void => {
    const step = steps[index];
    if (!step) {
      done();
      return;
    }
    if (step.fadeMs > 0) {
      incoming.style.backgroundImage = image(step.url);
      incoming.style.top = base.style.top;
      fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: step.fadeMs,
        easing: "linear",
        fill: "forwards",
      });
    }
    timer = setTimeout(() => {
      base.style.backgroundImage = image(step.url);
      stop();
      play(steps, done, index + 1);
    }, step.fadeMs + step.holdMs);
  };
  const render = (
    page: StoryPageView | null,
    backdrop: Background | null,
    focusFirst: boolean,
    exit: StoryOverlay | null = null,
  ) => {
    rendered = page;
    backdropShown = backdrop;
    layer.hidden = page === null && backdrop === null;
    skip.hidden = page === null || !page.canSkip;
    if (!page) {
      panel.hidden = true;
      stopPortrait();
      if (backdrop) {
        setBackground(backdrop, false);
      }
      return;
    }
    if (page.run && page.run.id !== measuredRun) {
      measureRun(page);
    }
    panel.hidden = page.sleep === true;
    const buttons = fill(page);
    setBackground(page.background, true);
    startNight(page);
    startHolodisk(page, exit);
    playPortrait(page);
    // Focus starts on the first choice, the default; otherwise on Next or the named action.
    if (focusFirst || buttons.length > 0) {
      focusTarget(buttons[0] ?? next);
    }
  };
  // A new view size or font re-measures the run and re-lays the page, keeping focus.
  const relayout = () => {
    if (!rendered) {
      if (backdropShown) {
        place(base, backdropShown, false);
      }
      return;
    }
    const focused = document.activeElement;
    measuredRun = "";
    measureRun(rendered);
    panel.hidden = rendered.sleep === true;
    const buttons = fill(rendered);
    place(base, rendered.background, true);
    if (focused?.closest(".ada-story-panel")) {
      const choice = focused instanceof HTMLElement ? focused.dataset.choice : undefined;
      focusTarget(choice === undefined ? next : (buttons[Number(choice)] ?? next));
    }
  };
  window.addEventListener(VIEW_SCALE_EVENT, relayout);
  void document.fonts.ready.then(relayout);
  // Shows a page, or only a background (aboard behind the holodisk lines), or nothing. A new
  // state ends any transition still playing and shows at once.
  const show = (page: StoryPageView | null, backdrop: Background | null = null): void => {
    const signature = JSON.stringify([page && { ...page, run: page.run?.id }, backdrop]);
    if (signature === shown) {
      return;
    }
    const focusFirst = shown !== "" && page !== null;
    shown = signature;
    const from = lastPage;
    const exit = from?.holodisk && !page?.holodisk ? holodiskFrame() : null;
    stop();
    stopNight();
    stopPortrait();
    lastPage = page;
    const steps =
      from && page
        ? transitionSteps(
            art.transitions,
            art.backgrounds[from.background],
            art.backgrounds[page.background],
            options.reducedMotion(),
          )
        : null;
    if (!steps) {
      render(page, backdrop, focusFirst, exit);
      return;
    }
    panel.hidden = true;
    skip.hidden = true;
    play(steps, () => render(page, backdrop, focusFirst, exit));
  };
  void loadStoryArt().then((loaded) => {
    art = loaded;
    // Preloads every image, so a page or transition frame draws without a blank.
    for (const url of new Set([
      ...Object.values(art.backgrounds),
      ...Object.values(art.composites).flatMap((shown) => shown.map((overlay) => overlay.url)),
      ...(art.overnight?.overlays.map((overlay) => overlay.url) ?? []),
      ...(art.holodisk?.overlays.map((overlay) => overlay.url) ?? []),
      ...art.transitions.flatMap(({ steps }) => steps.map((step) => step.url)),
    ])) {
      new Image().src = url;
    }
    if (rendered) {
      // The bases arrive with the art: the run is measured again on them.
      relayout();
    }
    if (shownKey && nightTimer === undefined) {
      setBackground(shownKey, rendered !== null);
    }
  });
  return {
    dispose(): void {
      stop();
      stopNight();
      stopPortrait();
      window.removeEventListener(VIEW_SCALE_EVENT, relayout);
      layer.remove();
    },
    show,
    /** How long the sleep page lasts, from Art's overnight sequence, or null until it loads. */
    sleepSeconds(): number | null {
      return art.overnight ? overnightSeconds(art.overnight, options.reducedMotion()) : null;
    },
  };
}
