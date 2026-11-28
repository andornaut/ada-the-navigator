import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { STICK_AREA_MARGIN, STICK_DRAWN_HALF, TOUCH_STICK, USE_DISC } from "../../data/layout.ts";
import type { StickSide } from "../../input/index.ts";
import { type Insets, playView, type Size } from "./playView.ts";
export { TOUCH_STICK, USE_DISC } from "../../data/layout.ts";

// Ring edges sit TOUCH_STICK.side logical px from the outer sides and TOUCH_STICK.bottom
// above the screen's bottom, ignoring safe insets. A ring moves inward only where it would cross
// the game area's STICK_AREA_MARGIN.
export function stickRestCentres(view: Size, insets: Insets): Readonly<Record<StickSide, Point>> {
  void insets;
  const area = playView(view);
  const side = TOUCH_STICK.side;
  const left = Math.max(side, Math.ceil(area.x + STICK_AREA_MARGIN));
  const right = Math.min(
    Math.floor(view.width) - side,
    Math.floor(area.x + area.width - STICK_AREA_MARGIN),
  );
  const y =
    Math.floor(
      Math.min(view.height - TOUCH_STICK.bottom, area.y + area.height - STICK_AREA_MARGIN),
    ) -
    1 -
    STICK_DRAWN_HALF;
  return {
    aim: { x: right - 1 - STICK_DRAWN_HALF, y },
    move: { x: left + STICK_DRAWN_HALF, y },
  };
}

export interface UseDiscLayout {
  /** The aim stick's square touch target has priority where the shapes meet. */
  readonly aimTarget: Rect;
  /** The aim ring's rest centre, which the press circle is cut away from. */
  readonly awayFrom: Point;
  readonly centre: Point;
  /** The 75 frame the disc draws in, its centre pixel on centre. */
  readonly frame: Rect;
}

// A frame's centre pixel sits on the control's logical centre.
function controlFrame(size: number, centre: Point): Rect {
  const half = (size - 1) / 2;
  return { height: size, width: size, x: centre.x - half, y: centre.y - half };
}

/** The Use disc in a logical view. */
export function useDiscLayout(view: Size, insets: Insets): UseDiscLayout {
  const { aim } = stickRestCentres(view, insets);
  const centre = { x: aim.x + USE_DISC.fromAim.x, y: aim.y + USE_DISC.fromAim.y };
  return {
    aimTarget: controlFrame(TOUCH_STICK.frame, aim),
    awayFrom: aim,
    centre,
    frame: controlFrame(USE_DISC.frame, centre),
  };
}

/**
 * Whether a press at point takes Use: inside the press circle and nearer the disc's centre than
 * the aim ring's, with the full aim target reserved for the stick. The conversation box takes
 * its own presses where it overlaps the circle.
 */
export function usePressed(disc: UseDiscLayout, point: Point): boolean {
  if (containsPoint(disc.aimTarget, point.x, point.y)) {
    return false;
  }
  const fromCentre = Math.hypot(point.x - disc.centre.x, point.y - disc.centre.y);
  return (
    fromCentre < USE_DISC.radius &&
    fromCentre < Math.hypot(point.x - disc.awayFrom.x, point.y - disc.awayFrom.y)
  );
}

// Each joystick's DOM pointer target: the ring's frame over its rest centre pixel.
export function stickTargets(view: Size, insets: Insets): Readonly<Record<StickSide, Rect>> {
  const { aim, move } = stickRestCentres(view, insets);
  return {
    aim: controlFrame(TOUCH_STICK.frame, aim),
    move: controlFrame(TOUCH_STICK.frame, move),
  };
}
