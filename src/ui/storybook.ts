import type { Background } from "../data/storybook.ts";
import { font, fromHudEdge, safeEdge, units } from "./layout/css.ts";
import { STORY_PANEL_TOP, STORY_SKIP } from "./layout/playView.ts";
import { STORY_BACKGROUND, STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, TEXT_TOKENS } from "./modal.ts";
import {
  breathKeyframes,
  loadStoryArt,
  overnightSeconds,
  type OvernightStep,
  overnightSteps,
  type StoryArt,
  type StoryOverlay,
  type TransitionStep,
  transitionSteps,
} from "./story-art.ts";

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
  /** Whether Skip shows: every page but the story run's end and the sleep scene. */
  readonly canSkip: boolean;
  /**
   * The overnight sleep scene: no panel or Skip, and a tap anywhere moves on. Art's overnight
   * sequence plays over it, or its reduced-motion steps when motion is reduced.
   */
  readonly sleep?: boolean;
}

// The breath's alpha curve as linear keyframes, fine enough to follow the cosine.
const BREATH_SAMPLES = 24;

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
// The panel grows from the available bottom up to its highest top, below the HUD row.
const AVAILABLE_HEIGHT = `calc(100% - ${fromHudEdge("top", STORY_PANEL_TOP)} - ${safeEdge(
  "bottom",
  SPACING.pageInset,
)})`;

// The background canvas's width: display size, or the view's width or its height at the canvas's
// aspect, whichever is largest.
const ART_WIDTH = `max(${units(STORY_BACKGROUND.width)}, 100cqw, calc(100cqh * ${
  STORY_BACKGROUND.width
} / ${STORY_BACKGROUND.height}))`;

export const STORYBOOK_STYLE = `
.ada-controls .ada-story-background{
  position:absolute;
  inset:0;
  overflow:hidden;
  container-type:size;
  pointer-events:auto
}

/* Art's canvas at display size, centred on the view under the insets and scaled up only to cover
   a view past it, nearest neighbour (art/layout.md "Storybook page"). The second image is a
   transition's incoming frame, faded in over the first. */
.ada-controls .ada-story-art{
  position:absolute;
  left:50%;
  top:50%;
  width:${ART_WIDTH};
  aspect-ratio:${STORY_BACKGROUND.width} / ${STORY_BACKGROUND.height};
  transform:translate(-50%, -50%);
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

/* The scroll group: the text column and the choices scroll as one when the page is taller than the
   panel's room, as a card's do; the page controls stay fixed below. */
.ada-controls .ada-story-scroll{
  flex:0 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  display:flex;
  flex-direction:column;
  gap:${units(STORY_PANEL.gap)};
  scrollbar-color:#9690b4 #2f2d3d
}

.ada-controls .ada-story-text{
  flex:none;
  display:flex;
  flex-direction:column;
  gap:${units(STORY_PANEL.speakerGap)}
}

.ada-controls .ada-story-choices{
  flex:none
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

/**
 * A storybook page: the full location background with its bottom panel of text, choices and
 * page controls, with Skip apart at the top right on every page but the story run's end and the
 * sleep scene. Previous (left) uses the disabled face on the run's first page; Next (right) is
 * absent on a choice page and shows a
 * page's named action in its slot. A question page shows its
 * remaining questions with Continue in Next's slot. Between two pages whose images Art's story
 * transition joins (Ada's room to the cockpit), the panel hides while its frames play.
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
  const scroll = document.createElement("div");
  scroll.className = "ada-story-scroll";
  scroll.append(text, choices);
  panel.append(scroll, controls);
  layer.append(background, panel, skip);
  // The page goes first in the controls layer, so the HUD's settings button draws and presses
  // above it; its style goes last, after the shared card styles it refines.
  root.prepend(layer);
  root.append(style);
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
    composites: {},
    overnight: null,
    transitions: [],
  };
  // What the layer last showed; re-rendering only on a change keeps each button across frames.
  let shown = "";
  let shownKey: Background | null = null;
  let lastPage: StoryPageView | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fade: Animation | undefined;
  let rendered: StoryPageView | null = null;
  const image = (url: string | undefined) => (url ? `url('${url}')` : "");
  // One overlay's element, made on first use and placed by its box.
  const overlayFor = (overlay: StoryOverlay): HTMLDivElement => {
    let node = overlays.get(overlay.id);
    if (!node) {
      node = document.createElement("div");
      node.className = "ada-story-overlay";
      node.dataset.overlay = overlay.id;
      base.append(node);
      overlays.set(overlay.id, node);
    }
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
  const setBackground = (key: Background) => {
    shownKey = key;
    background.dataset.background = key;
    base.style.backgroundImage = image(art.backgrounds[key]);
    showOverlays(art.composites[key] ?? [], 1);
  };
  // The overnight sequence's running animations and step timer.
  let nightTimer: ReturnType<typeof setTimeout> | undefined;
  let nightAnimations: Animation[] = [];
  const stopNight = () => {
    clearTimeout(nightTimer);
    nightTimer = undefined;
    for (const animation of nightAnimations) {
      animation.cancel();
    }
    nightAnimations = [];
  };
  // Each step in turn (art/storybook.md "Sequence"): an overlay fades in linearly and holds, a
  // breath runs the overlay's alpha through one cosine, and a background cross-fades the whole
  // picture and ends the overlays.
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
      incoming.style.backgroundImage = image(step.url);
      if (step.fadeMs > 0) {
        nightAnimations.push(
          incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: step.fadeMs,
            easing: "linear",
            fill: "forwards",
          }),
        );
      }
      ms = step.fadeMs + step.holdMs;
    }
    nightTimer = setTimeout(() => {
      if (step.kind === "background") {
        base.style.backgroundImage = image(step.url);
        showOverlays([], 1);
        incoming.style.backgroundImage = "";
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
  // Ends a running transition step, leaving the base image as it stands.
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    fade?.cancel();
    fade = undefined;
    incoming.style.backgroundImage = "";
  };
  // Each step cross-fades linearly to its image over fadeMs (0 cuts), then holds for holdMs.
  const play = (steps: readonly TransitionStep[], done: () => void, index = 0): void => {
    const step = steps[index];
    if (!step) {
      done();
      return;
    }
    if (step.fadeMs > 0) {
      incoming.style.backgroundImage = image(step.url);
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
  const render = (page: StoryPageView | null, backdrop: Background | null, focusFirst: boolean) => {
    rendered = page;
    layer.hidden = page === null && backdrop === null;
    panel.hidden = page === null || page.sleep === true;
    skip.hidden = page === null || !page.canSkip;
    if (!page) {
      if (backdrop) {
        setBackground(backdrop);
      }
      return;
    }
    setBackground(page.background);
    startNight(page);
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
  // Shows a page, or only a background (the cockpit behind galaxy selection), or nothing. A new
  // state ends any transition still playing and shows at once.
  const show = (page: StoryPageView | null, backdrop: Background | null = null): void => {
    const signature = JSON.stringify([page, backdrop]);
    if (signature === shown) {
      return;
    }
    const focusFirst = shown !== "" && page !== null;
    shown = signature;
    stop();
    stopNight();
    const from = lastPage;
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
      render(page, backdrop, focusFirst);
      return;
    }
    panel.hidden = true;
    skip.hidden = true;
    play(steps, () => render(page, backdrop, focusFirst));
  };
  void loadStoryArt().then((loaded) => {
    art = loaded;
    // Preloads every image, so a page or transition frame draws without a blank.
    for (const url of new Set([
      ...Object.values(art.backgrounds),
      ...Object.values(art.composites).flatMap((shown) => shown.map((overlay) => overlay.url)),
      ...(art.overnight?.overlays.map((overlay) => overlay.url) ?? []),
      ...art.transitions.flatMap(({ steps }) => steps.map((step) => step.url)),
    ])) {
      new Image().src = url;
    }
    if (shownKey && nightTimer === undefined) {
      setBackground(shownKey);
    }
  });
  return {
    dispose(): void {
      stop();
      stopNight();
      style.remove();
      layer.remove();
    },
    show,
    /** How long the sleep page lasts, from Art's overnight sequence, or null until it loads. */
    sleepSeconds(): number | null {
      return art.overnight ? overnightSeconds(art.overnight, options.reducedMotion()) : null;
    },
  };
}
