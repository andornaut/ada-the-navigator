import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { TEXT_BUTTON } from "./controls.ts";
import { playView, type Size } from "./playView.ts";
import { SPACING, TYPE } from "./tokens.ts";

// The start screen (art/layout.md "Start screen"), after Chibi's START_SCREEN: Ada's ship above
// the two-line wordmark, the action row under it, then the note. Every part is in play-view px,
// from the game area's top-left (playView(view)), so it stays centred on the game area at every
// aspect and is untouched by insets. The field is placed by title-screen.json; the nav discs keep
// the HUD row (hudButtonTarget).

const CENTRE = SCREEN.width / 2;
const BUTTON_WIDTH = 192;
const WORDMARK = { height: 102, width: 270 } as const;
const WORDMARK_TOP = 148;
// The action row sits 14 below the wordmark, as Chibi's row sits 15 under its logo.
const ACTIONS_TOP = WORDMARK_TOP + WORDMARK.height + 14;

export const START_SCREEN = {
  actions: {
    height: TEXT_BUTTON.height,
    // Restart left and Continue right of the centre, a gap apart; Start alone on the centre.
    left: {
      continue: CENTRE + SPACING.gap / 2,
      restart: CENTRE - BUTTON_WIDTH - SPACING.gap / 2,
      start: CENTRE - BUTTON_WIDTH / 2,
    },
    top: ACTIONS_TOP,
    width: BUTTON_WIDTH,
  },
  // One body line box, a gap below the action row, centred on the game area.
  note: {
    centre: CENTRE,
    height: TYPE.body.lineHeight,
    top: ACTIONS_TOP + TEXT_BUTTON.height + SPACING.gap,
  },
  // The selected paint's ship-26, its 96 frame drawn 280 square on this centre; its speed jets
  // draw behind it at the same scale.
  ship: { centre: { x: 378, y: 84 }, frame: 96, size: 280 },
  wordmark: { ...WORDMARK, left: CENTRE - WORDMARK.width / 2, top: WORDMARK_TOP },
} as const;

export type StartAction = keyof typeof START_SCREEN.actions.left;

/** Each part's rect in logical px of the view, for its game area. */
export function startScreenRects(view: Size): {
  readonly actions: Readonly<Record<StartAction, Rect>>;
  readonly note: Rect & { readonly centre: number };
  readonly ship: Rect;
  readonly wordmark: Rect;
} {
  const x0 = playView(view).x;
  const { actions, note, ship, wordmark } = START_SCREEN;
  const button = (left: number): Rect => ({
    height: actions.height,
    width: actions.width,
    x: x0 + left,
    y: actions.top,
  });
  return {
    actions: {
      continue: button(actions.left.continue),
      restart: button(actions.left.restart),
      start: button(actions.left.start),
    },
    note: {
      centre: x0 + note.centre,
      height: note.height,
      width: 0,
      x: x0 + note.centre,
      y: note.top,
    },
    ship: {
      height: ship.size,
      width: ship.size,
      x: x0 + ship.centre.x - ship.size / 2,
      y: ship.centre.y - ship.size / 2,
    },
    wordmark: {
      height: wordmark.height,
      width: wordmark.width,
      x: x0 + wordmark.left,
      y: wordmark.top,
    },
  };
}
