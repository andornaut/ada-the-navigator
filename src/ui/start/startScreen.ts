import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { assertAdaActionBindings } from "../actionBinding.ts";
import {
  BUTTON_GAP,
  font,
  fromAreaLeft,
  fromAreaTop,
  START_SCREEN,
  type StartAction,
  TYPE,
  units,
} from "../layout/index.ts";
import { TEXT_TOKENS } from "../modal.ts";
import { createStandardTextAction } from "../standardTextAction.ts";
import { applyButtonSkin } from "../uiSkin.ts";
import { type StartScreenSchema, startScreenTree } from "./startScreenTree.ts";
import type { TitleScreenArt } from "./titleScreen.ts";
import { TITLE_SHIP_STYLE, titleShipView } from "./titleShipView.ts";

// The start screen (art/layout.md "Start screen"): a full-screen HTML view over the canvas, after
// Chibi's, with Ada's ship and its jets above the wordmark and the action row, all in play-view
// px from the game area's left edge. Achievements and Settings stay the HUD row's nav
// discs above it. Nothing animates.

export const START_SCREEN_CLASS = "ada-start";

const { actions, note, wordmark } = START_SCREEN;

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

${TITLE_SHIP_STYLE}

.${START_SCREEN_CLASS} .ada-start-title{
  left:${fromAreaLeft(wordmark.left)};
  top:${fromAreaTop(wordmark.top)};
  width:${units(wordmark.width)};
  height:${units(wordmark.height)};
  margin:0;
  font:${font(TYPE.heading)}
}

/* The note (art/layout.md "Start screen"): one body line box a gap below the action row,
   centred on the game area, cream with no panel. */
.${START_SCREEN_CLASS} .ada-start-note{
  left:${fromAreaLeft(note.centre)};
  top:${fromAreaTop(note.top)};
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

/* The title row hugs its action labels at the game area's absolute centre. */
.${START_SCREEN_CLASS} > .ui-layout-row{
  --ui-unit:var(--ada-unit,1);
  left:${fromAreaLeft(note.centre)};
  top:${fromAreaTop(actions.top)};
  transform:translateX(-50%);
  grid-auto-columns:max-content;
  align-items:stretch;
  min-width:0;
  max-width:${units(2 * actions.width + BUTTON_GAP)}
}

.${START_SCREEN_CLASS} > .ui-layout-row > button{
  width:max-content;
  max-width:${units(actions.width)}
}
`;

export interface StartScreenContent {
  /** In tab order, left to right: Restart, then the primary default (Continue, or Start). */
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
  let disposed = false;
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
      top: fromAreaTop(art.field.at.y),
      width: units(art.field.width),
    });
    parts.push(field, ...titleShipView(art, content.paint));
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
  const callbacks = new Map(content.actions.map(({ action, run }) => [action, run]));
  const buttons: HTMLButtonElement[] = [];
  root.append(...parts, title);
  const layout = mountLayout<StartScreenSchema>(
    {
      components: {
        action: {
          create(initial) {
            const action = createStandardTextAction(parent, initial.label, {
              availability: (button) =>
                button?.disabled
                  ? { kind: "disabled" }
                  : button?.hidden
                    ? { kind: "omitted" }
                    : { kind: "available" },
              current: () => !disposed,
              run: () => callbacks.get(initial.action)!(),
              // Keep the Kit focus fill above the existing nine-slice face.
              separateFace: true,
            });
            const button = action.element;
            button.dataset.action = initial.action;
            button.classList.toggle("ada-primary", initial.role === "primary");
            setButtonRole(initial.role, button);
            buttons.push(button);
            return {
              dispose: action.dispose,
              element: button,
              slots: {},
              update() {},
            };
          },
          slots: [],
        },
        note: {
          create(text) {
            const element = document.createElement("p");
            element.className = "ada-start-note";
            element.setAttribute("role", "status");
            element.textContent = text;
            return { dispose() {}, element, slots: {}, update() {} };
          },
          slots: [],
        },
        start: {
          create: () => ({ dispose() {}, element: root, slots: { content: root }, update() {} }),
          slots: ["content"],
        },
      },
      host: parent,
    },
    startScreenTree(content),
  );
  // First in the play area, so its actions are the first Tab stops, before the HUD row's discs.
  parent.prepend(root);
  assertAdaActionBindings(root);
  // Art's button faces, as the controls overlay takes them.
  void applyButtonSkin(root).catch(() => undefined);
  return {
    buttons,
    dispose: () => {
      disposed = true;
      layout.dispose();
    },
    root,
  };
}
