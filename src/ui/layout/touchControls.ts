import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { StickSide } from "../../input/state.ts";
import { TOUCH_CHROME_FRAME } from "../touch-chrome.ts";
import { TEXT_BUTTON } from "./controls.ts";
import { hitMargin } from "./hitAreas.ts";
import { CONTROL_EDGE, type Insets, type Size } from "./playView.ts";
import { TYPE } from "./tokens.ts";

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

// The context Use button (art/layout.md "HUD and overlays", Use), shown only while an interaction
// is available: an action-high face with a 2 ink border and radius 8, its label in the
// label role, as wide as the label plus the action inset each side (at least one face high);
// centred across the HUD safe rect, its bottom level with the sticks' drawn bottom,
// max(bottom, inset); its press area hitAround(face) reaches pressMargin past it.
const USE_FACE: Rect = { height: TEXT_BUTTON.height, width: TEXT_BUTTON.height, x: 0, y: 0 };
export const USE_BUTTON = {
  border: 2,
  bottom: TOUCH_STICK.bottom,
  height: USE_FACE.height,
  inset: TEXT_BUTTON.inset,
  margin: CONTROL_EDGE,
  minWidth: USE_FACE.width,
  pressMargin: hitMargin(USE_FACE),
  radius: 8,
  text: TYPE.label,
} as const;

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
