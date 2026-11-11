import { safeEdge, units } from "./layout/css.ts";
import { SAFE_MARGIN } from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING } from "./layout/tokens.ts";
import { createActions, createButton, createCard } from "./modal.ts";

// The start screen's card: the shared card (ui-settings-card face, the heading role, the card
// tokens) as a page card centred in the page safe rect, without a dim. Groups: the portraits, the
// start actions as an action stack, then the deferred-galaxy note.

// The portrait sheets, each frame one portrait square; the first frame shows.
const PORTRAITS = {
  ada: { frames: 2, url: "/art/portraits/ada.png" },
  dog: { frames: 3, url: "/art/portraits/dog.png" },
} as const;
const PORTRAIT = STORY_PANEL.portrait.image;

export const START_CLASS = "ada-start";

export const START_STYLE = `
/* The story panel holds the start card: it covers the play area, passes presses through to the
   HUD, and centres the card in the page safe rect. */
.story-panel.${START_CLASS}{
  inset:0;
  transform:none;
  width:auto;
  max-height:none;
  overflow:visible;
  display:flex;
  align-items:center;
  justify-content:center;
  box-sizing:border-box;
  padding:${safeEdge("top", SAFE_MARGIN.page)} ${safeEdge("right", SAFE_MARGIN.page)} ${safeEdge(
    "bottom",
    SAFE_MARGIN.page,
  )} ${safeEdge("left", SAFE_MARGIN.page)};
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  pointer-events:none
}

.story-panel.${START_CLASS} .ada-card-frame{
  pointer-events:auto
}

.story-panel.${START_CLASS} .ada-card p{
  line-height:inherit;
  white-space:normal
}

.story-panel.${START_CLASS} .ada-portraits{
  display:flex;
  gap:${units(SPACING.gap)}
}

.story-panel.${START_CLASS} .ada-portrait{
  width:${units(PORTRAIT)};
  height:${units(PORTRAIT)};
  background:url('${PORTRAITS.ada.url}') 0 0 / ${units(PORTRAITS.ada.frames * PORTRAIT)} ${units(
    PORTRAIT,
  )} no-repeat;
  image-rendering:pixelated
}

.story-panel.${START_CLASS} .ada-portrait[data-portrait=dog]{
  background-image:url('${PORTRAITS.dog.url}');
  background-size:${units(PORTRAITS.dog.frames * PORTRAIT)} ${units(PORTRAIT)}
}
`;

export interface StartCardContent {
  readonly actions: readonly { readonly label: string; readonly run: () => void }[];
  readonly note: string;
  readonly title: string;
}

// Builds the start card into panel and fits it; dispose stops refitting it.
export function createStartCard(
  panel: HTMLElement,
  content: StartCardContent,
): { readonly buttons: readonly HTMLButtonElement[]; dispose(): void } {
  panel.classList.add(START_CLASS);
  const parts = createCard({ page: true, title: content.title });
  const portraits = document.createElement("div");
  portraits.className = "ada-portraits";
  portraits.dataset.inkTop = "0";
  portraits.setAttribute("aria-hidden", "true");
  for (const key of Object.keys(PORTRAITS)) {
    const portrait = document.createElement("span");
    portrait.className = "ada-portrait";
    portrait.dataset.portrait = key;
    portraits.append(portrait);
  }
  const buttons = content.actions.map(({ label, run }) => {
    const button = createButton(label);
    button.addEventListener("click", run);
    return button;
  });
  const actions = createActions(buttons.map((button) => ({ button, role: "secondary" as const })));
  actions.classList.add("ada-stack");
  const note = document.createElement("p");
  note.className = "ada-card-note ada-prose";
  note.textContent = content.note;
  parts.body.append(portraits, actions, note);
  panel.append(parts.frame);
  parts.fit();
  return {
    buttons,
    dispose(): void {
      parts.dispose();
      parts.frame.remove();
      panel.classList.remove(START_CLASS);
    },
  };
}
