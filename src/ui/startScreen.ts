import { font, fromAreaLeft, units } from "./layout/css.ts";
import { START_SCREEN, type StartAction } from "./layout/startScreen.ts";
import { TYPE } from "./layout/tokens.ts";
import { createButton, TEXT_TOKENS } from "./modal.ts";
import { jetPolygons, type TitleScreenArt, titleShip } from "./titleScreen.ts";
import { applyButtonSkin } from "./uiSkin.ts";

// The start screen (art/layout.md "Start screen"): a full-screen HTML view over the canvas, after
// Chibi's, with Ada's ship and its jets above the wordmark and the action row, all in play-view
// px from the game area's left edge. Achievements and Settings stay the HUD row's nav
// discs above it. Nothing animates.

export const START_SCREEN_CLASS = "ada-start";

const { actions, note, ship, wordmark } = START_SCREEN;
const SVG = "http://www.w3.org/2000/svg";

export const START_SCREEN_STYLE = `
/* Over the canvas and under the HUD row's nav discs (.ada-controls), which draw last. */
.${START_SCREEN_CLASS}{
  position:absolute;
  inset:0;
  z-index:4;
  overflow:hidden
}

.${START_SCREEN_CLASS} > *{
  position:absolute
}

.${START_SCREEN_CLASS} .ada-start-field{
  background:0 0 / 100% 100% no-repeat;
  image-rendering:pixelated
}

.${START_SCREEN_CLASS} .ada-start-jets,
.${START_SCREEN_CLASS} .ada-start-ship{
  left:${fromAreaLeft(ship.centre.x - ship.size / 2)};
  top:${units(ship.centre.y - ship.size / 2)};
  width:${units(ship.size)};
  height:${units(ship.size)};
  overflow:visible;
  image-rendering:pixelated
}

.${START_SCREEN_CLASS} .ada-start-title{
  left:${fromAreaLeft(wordmark.left)};
  top:${units(wordmark.top)};
  width:${units(wordmark.width)};
  height:${units(wordmark.height)};
  margin:0;
  font:${font(TYPE.heading)}
}

/* The note (art/layout.md "Start screen"): one body line box a gap below the action row,
   centred on the game area, cream with no panel. */
.${START_SCREEN_CLASS} .ada-start-note{
  left:${fromAreaLeft(note.centre)};
  top:${units(note.top)};
  transform:translateX(-50%);
  margin:0;
  white-space:nowrap;
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.label}
}
.${START_SCREEN_CLASS} .ada-start-title img{
  display:block;
  width:100%;
  height:100%
}

.${START_SCREEN_CLASS} .ada-start-actions{
  left:0;
  top:0
}

.${START_SCREEN_CLASS} .ada-start-actions > button{
  position:absolute;
  top:${units(actions.top)};
  width:${units(actions.width)};
  height:${units(actions.height)};
  box-sizing:border-box
}

${(Object.keys(actions.left) as StartAction[])
  .map(
    (action) => `.${START_SCREEN_CLASS} .ada-start-actions > [data-action=${action}]{
  left:${fromAreaLeft(actions.left[action])}
}`,
  )
  .join("\n\n")}
`;

export interface StartScreenContent {
  /** In tab order: the default (Continue, or Start) first, then Restart. */
  readonly actions: readonly {
    readonly action: StartAction;
    readonly label: string;
    readonly role: "primary" | "secondary";
    readonly run: () => void;
  }[];
  /** The note under the action row, or null for none. */
  readonly note?: string | null;
  /** The selected paint, or null for Classic. */
  readonly paint: string | null;
  readonly title: string;
}

/**
 * Builds the start screen into parent: the field, the jets, the ship frame, the wordmark (named by
 * the title) and the actions, in draw order. Without Art's title art it shows the actions under a
 * plain-text title.
 */
export function createStartScreen(
  parent: HTMLElement,
  art: TitleScreenArt | null,
  content: StartScreenContent,
): { readonly buttons: readonly HTMLButtonElement[]; readonly root: HTMLElement; dispose(): void } {
  const root = document.createElement("section");
  root.className = START_SCREEN_CLASS;
  root.setAttribute("aria-label", content.title);
  const parts: Element[] = [];
  if (art) {
    root.style.background = art.background;
    const field = document.createElement("div");
    field.className = "ada-start-field";
    field.setAttribute("aria-hidden", "true");
    Object.assign(field.style, {
      backgroundImage: `url('${art.field.url}')`,
      height: units(art.field.height),
      left: fromAreaLeft(art.field.at.x),
      top: units(art.field.at.y),
      width: units(art.field.width),
    });
    const jets = document.createElementNS(SVG, "svg");
    jets.classList.add("ada-start-jets");
    jets.setAttribute("aria-hidden", "true");
    jets.setAttribute("viewBox", `0 0 ${ship.size} ${ship.size}`);
    for (const { fill, opacity, points } of jetPolygons(art)) {
      const polygon = document.createElementNS(SVG, "polygon");
      polygon.setAttribute("points", points);
      polygon.setAttribute("fill", fill);
      polygon.setAttribute("fill-opacity", String(opacity));
      jets.append(polygon);
    }
    const frame = document.createElement("img");
    frame.className = "ada-start-ship";
    frame.alt = "";
    frame.setAttribute("aria-hidden", "true");
    frame.src = titleShip(art, content.paint);
    parts.push(field, jets, frame);
  }
  const title = document.createElement("h1");
  title.className = "ada-start-title";
  if (art) {
    const image = document.createElement("img");
    image.src = art.wordmark.url;
    image.alt = content.title;
    title.append(image);
  } else {
    title.textContent = content.title;
  }
  const row = document.createElement("div");
  row.className = "ada-start-actions";
  const buttons = content.actions.map(({ action, label, role, run }) => {
    const button = createButton(label, role);
    button.dataset.action = action;
    button.addEventListener("click", run);
    row.append(button);
    return button;
  });
  root.append(...parts, title, row);
  if (content.note) {
    const note = document.createElement("p");
    note.className = "ada-start-note";
    note.setAttribute("role", "status");
    note.textContent = content.note;
    root.append(note);
  }
  // First in the play area, so its actions are the first Tab stops, before the HUD row's discs.
  parent.prepend(root);
  // Art's button faces, as the controls overlay takes them.
  void applyButtonSkin(root).catch(() => undefined);
  return {
    buttons,
    dispose: () => root.remove(),
    root,
  };
}
