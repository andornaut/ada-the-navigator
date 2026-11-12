import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { StickSide } from "../../input/state.ts";
import { TOUCH_CHROME_FRAME } from "../touch-chrome.ts";
import {
  CONTROLS_BOTTOM,
  controlsBottom,
  type Insets,
  mirroredSideInset,
  playView,
  type Size,
  STICK_AREA_MARGIN,
} from "./playView.ts";

// The on-screen joysticks (art/layout.md "HUD and overlays", Sticks), in logical canvas px: 75
// frames, each ring's drawn edge side (60) in from the screen's left (move) or right (aim) edge
// and bottom (40, level with the shield pill) above its bottom, inside the safe insets, then
// clamped STICK_AREA_MARGIN inside the game area; the drawn knob moves at most knobReach from the
// ring's centre. Move input reaches full speed moveReach from the touch-down point, past a
// moveDeadZone.
export const TOUCH_STICK = {
  bottom: CONTROLS_BOTTOM,
  frame: TOUCH_CHROME_FRAME,
  knobReach: 12,
  moveDeadZone: 2.4,
  moveReach: 40,
  side: 60,
} as const;

// Art draws each ring 1 inside its frame, so a frame's centre pixel is this far from the drawn
// edge on each side.
const DRAWN_HALF = (TOUCH_STICK.frame - 1) / 2 - 1;

// Each joystick's ring centre at rest in a logical view view big with insets, on whole pixels, so
// the drawn ring and its DOM target share one centre. The rings mirror as in Chibi: with side the
// larger side inset plus TOUCH_STICK.side, the move ring's drawn left edge sits at side and the
// aim ring's right at the view's whole-pixel width less side; both bottoms sit TOUCH_STICK.bottom
// above the view's bottom inside the bottom inset (controlsBottom). Each edge is then clamped so
// the whole stick draws inside the game area with STICK_AREA_MARGIN to spare.
export function stickRestCentres(view: Size, insets: Insets): Readonly<Record<StickSide, Point>> {
  const area = playView(view);
  const side = Math.ceil(mirroredSideInset(insets) + TOUCH_STICK.side);
  const left = Math.max(side, Math.ceil(area.x + STICK_AREA_MARGIN));
  const right = Math.min(
    Math.floor(view.width) - side,
    Math.floor(area.x + area.width - STICK_AREA_MARGIN),
  );
  const y = Math.floor(controlsBottom(insets, view)) - 1 - DRAWN_HALF;
  return {
    aim: { x: right - 1 - DRAWN_HALF, y },
    move: { x: left + DRAWN_HALF, y },
  };
}

// The Use disc (art/layout.md "HUD and overlays", Use), Chibi's touch Use button: a 75 frame
// whose centre pixel is the aim ring's rest centre plus fromAim, as Chibi places Use from Jump.
// Its press area is a circle of radius TOUCH_CIRCLE_RADIUS (63) plus the 37 hint radius about the
// centre, cut on the line midway to the aim ring's centre, so the aim stick keeps its reach.
export const USE_DISC = {
  frame: TOUCH_CHROME_FRAME,
  fromAim: { x: -77, y: -100 },
  radius: 63 + 37,
} as const;

export interface UseDiscLayout {
  /** The aim ring's rest centre, which the press circle is cut away from. */
  readonly awayFrom: Point;
  readonly centre: Point;
  /** The 75 frame the disc draws in, its centre pixel on centre. */
  readonly frame: Rect;
}

/** The Use disc in a logical view view big with insets. */
export function useDiscLayout(view: Size, insets: Insets): UseDiscLayout {
  const { aim } = stickRestCentres(view, insets);
  const centre = { x: aim.x + USE_DISC.fromAim.x, y: aim.y + USE_DISC.fromAim.y };
  const half = (USE_DISC.frame - 1) / 2;
  return {
    awayFrom: aim,
    centre,
    frame: {
      height: USE_DISC.frame,
      width: USE_DISC.frame,
      x: centre.x - half,
      y: centre.y - half,
    },
  };
}

/**
 * Whether a press at point takes Use: inside the press circle and nearer the disc's centre than
 * the aim ring's. The conversation box, a page element over the canvas, takes its own presses
 * where it overlaps the circle, as the controls take presses only on the canvas.
 */
export function usePressed(disc: UseDiscLayout, point: Point): boolean {
  const fromCentre = Math.hypot(point.x - disc.centre.x, point.y - disc.centre.y);
  return (
    fromCentre < USE_DISC.radius &&
    fromCentre < Math.hypot(point.x - disc.awayFrom.x, point.y - disc.awayFrom.y)
  );
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
