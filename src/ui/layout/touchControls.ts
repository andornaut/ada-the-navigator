import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { StickSide } from "../../input/state.ts";
import { TOUCH_CHROME_FRAME } from "../touch-chrome.ts";
import type { Insets, Size } from "./playView.ts";

// The on-screen joysticks (art/layout.md "HUD and overlays", Sticks), in logical canvas px: 75
// frames, each ring's drawn edge max(side, inset) in from the view's left (move) or right (aim)
// and max(bottom, inset) above its bottom; the knob moves at most knobReach from the ring's
// centre.
export const TOUCH_STICK = {
  bottom: 20,
  frame: TOUCH_CHROME_FRAME,
  knobReach: 12,
  side: 85,
} as const;

// Art draws each ring 1 inside its frame, so a frame's centre pixel is this far from the drawn
// edge on each side.
const DRAWN_HALF = (TOUCH_STICK.frame - 1) / 2 - 1;

// Each joystick's ring centre at rest in a logical view view big with insets.
export function stickRestCentres(view: Size, insets: Insets): Readonly<Record<StickSide, Point>> {
  const y = Math.floor(view.height) - 1 - Math.max(TOUCH_STICK.bottom, insets.bottom) - DRAWN_HALF;
  return {
    aim: {
      x: Math.floor(view.width) - 1 - Math.max(TOUCH_STICK.side, insets.right) - DRAWN_HALF,
      y,
    },
    move: { x: Math.ceil(Math.max(TOUCH_STICK.side, insets.left)) + DRAWN_HALF, y },
  };
}

// Each joystick's DOM pointer target: the ring's frame over its rest centre pixel.
export function stickTargets(view: Size, insets: Insets): Readonly<Record<StickSide, Rect>> {
  const centres = stickRestCentres(view, insets);
  const target = (centre: Point): Rect => ({
    height: TOUCH_STICK.frame,
    width: TOUCH_STICK.frame,
    x: centre.x + 0.5 - TOUCH_STICK.frame / 2,
    y: centre.y + 0.5 - TOUCH_STICK.frame / 2,
  });
  return { aim: target(centres.aim), move: target(centres.move) };
}
