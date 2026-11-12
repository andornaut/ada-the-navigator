import type { Rect } from "@andornaut/game-kit/rect";

import { START_SCREEN } from "../../data/layout.ts";
import { playView, type Size } from "./playView.ts";
export { START_SCREEN } from "../../data/layout.ts";

// The start screen (art/layout.md "Start screen"), after Chibi's START_SCREEN: Ada's ship above
// the two-line wordmark, the action row under it, then the note. Every part is in play-view px,
// from the game area's top-left (playView(view)), so it stays centred on the game area at every
// aspect and is untouched by insets. The field is placed by title-screen.json; the nav discs keep
// the HUD row (hudButtonTarget).

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
