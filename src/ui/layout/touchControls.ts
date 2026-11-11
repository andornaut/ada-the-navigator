import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { StickSide } from "../../input/state.ts";
import { TOUCH_CHROME_FRAME } from "../touch-chrome.ts";
import { TEXT_BUTTON } from "./controls.ts";
import { hitMargin } from "./hitAreas.ts";
import { CONTROL_EDGE, type Insets, mirroredSide, playView, type Size } from "./playView.ts";
import { TYPE } from "./tokens.ts";

// The on-screen joysticks (art/layout.md "HUD and overlays", Sticks), in logical canvas px: 75
// frames, each ring's drawn edge side in from the game area's left (move) or right (aim)
// edge and bottom above its bottom, each clamped by the safe insets; the drawn knob
// moves at most knobReach from the ring's centre. Move input reaches full speed moveReach from
// the stick's origin, past a moveDeadZone.
export const TOUCH_STICK = {
  bottom: 30,
  frame: TOUCH_CHROME_FRAME,
  knobReach: 12,
  moveDeadZone: 2.4,
  moveReach: 40,
  side: 40,
} as const;

// Art draws each ring 1 inside its frame, so a frame's centre pixel is this far from the drawn
// edge on each side.
const DRAWN_HALF = (TOUCH_STICK.frame - 1) / 2 - 1;

// Each joystick's ring centre at rest in a logical view view big with insets, on whole pixels, so
// the drawn ring and its DOM target share one centre. The rings mirror: each drawn edge sits
// TOUCH_STICK.side in from the game area's edge on its side, using the left gap and the larger
// side inset on both sides (mirroredSide), measured from the view's whole-pixel width; and bottom
// above the game area's bottom, clamped by the bottom safe inset.
export function stickRestCentres(view: Size, insets: Insets): Readonly<Record<StickSide, Point>> {
  const area = playView(view);
  const bottom = Math.min(area.y + area.height, view.height - insets.bottom);
  const y = Math.floor(bottom) - 1 - TOUCH_STICK.bottom - DRAWN_HALF;
  const side = mirroredSide(insets, TOUCH_STICK.side, view);
  return {
    aim: { x: Math.floor(view.width) - 1 - side - DRAWN_HALF, y },
    move: { x: side + DRAWN_HALF, y },
  };
}

// The context Use button (art/layout.md "HUD and overlays", Use), shown only while an interaction
// is available: an action-high face with a 2 ink border and radius 8, its label in the
// label role, as wide as the label plus the action inset each side (at least one face high);
// centred across the game area's control rect, its bottom level with the sticks' drawn bottom,
// bottom above the game area's bottom clamped by the bottom safe inset; its press area
// hitAround(face) reaches pressMargin past it.
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
