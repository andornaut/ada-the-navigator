import type { Point, Rect } from "@andornaut/game-kit/rect";

import { STICK_AREA_MARGIN, STICK_DRAWN_HALF, TOUCH_STICK, USE_DISC } from "../../data/layout.ts";
import type { StickSide } from "../../input/state.ts";
import { type Insets, playView, type Size } from "./playView.ts";
export { TOUCH_STICK, USE_DISC } from "../../data/layout.ts";

// Ring edges sit 90 logical pixels from the outer sides and 60 from the bottom, ignoring safe insets.
// Clamp only where the drawn ring would cross the game area's eight-pixel margin.
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
