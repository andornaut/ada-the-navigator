import {
  type ControlState,
  MOVE_STICK_GEOMETRY,
  type StickSide,
  stickVector,
} from "../input/state.ts";
import type { ControlVisibility } from "./device-settings.ts";
import type { Insets } from "./layout/playView.ts";
import { stickRestCentres, TOUCH_STICK } from "./layout/touchControls.ts";
import {
  MOVE_KNOB_REACH,
  type Point,
  SPEED_LINE_FRAME,
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromePose,
} from "./touch-chrome.ts";

interface Size {
  readonly height: number;
  readonly width: number;
}

interface StickLayout extends Size {
  // The safe-area insets in logical px.
  readonly insets: Insets;
  readonly visibility: ControlVisibility;
  readonly visible: boolean;
}

// Where one joystick's ring and knob are drawn: each part's top-left, in whole game pixels,
// and the tag it shows.
export interface StickView {
  readonly knob: Point;
  readonly knobPose: TouchChromePose;
  // The speed line, from the ring's centre to the knob's, while the knob is off centre: its
  // frame's top-left and the knob's offset from the ring's centre.
  readonly line?: { readonly at: Point; readonly offset: Point };
  readonly ring: Point;
  readonly ringPose: TouchChromePose;
}

// Drawing order, bottom to top: the speed line lies over the ring and under the knob.
export const STICK_DEPTHS = { knob: 10002, line: 10001, ring: 10000 } as const;

// The move ring lights its left or right marker only while the move direction is within 67.5
// degrees of that side: the unit direction's x is at least sin(22.5 degrees) that way.
export const MARKER_THRESHOLD = Math.sin(Math.PI / 8);

// The top-left of an odd-sized frame whose centre pixel sits on centre.
export function centredAt(centre: Point, frame: number): Point {
  return { x: centre.x - (frame - 1) / 2, y: centre.y - (frame - 1) / 2 };
}

const rounded = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

// The joysticks as drawn: a side is absent while hidden by its setting or while controls do not
// show. A held stick's ring centres on where its drag began; at rest it sits at its rest centre.
// The move knob moves in proportion to the sampled deflection, at most MOVE_KNOB_REACH pixels,
// so it stays inside the markers; the aim knob moves at most
// TOUCH_STICK.knobReach pixels.
export function stickViews(
  layout: StickLayout,
  state: ControlState,
): Partial<Record<StickSide, StickView>> {
  const views: Partial<Record<StickSide, StickView>> = {};
  if (!layout.visible) {
    return views;
  }
  const rest = stickRestCentres(layout, layout.insets);
  for (const side of ["move", "aim"] as const) {
    if (!layout.visibility[side]) {
      continue;
    }
    const stick = state.stick(side);
    const centre = rounded(stick?.origin ?? rest[side]);
    let knob: Point;
    let ringPose: TouchChromePose = "rest";
    if (side === "move") {
      const scale = state.movementScale;
      const sampled = stickVector(MOVE_STICK_GEOMETRY, {
        x: stick ? (stick.position.x - stick.origin.x) * scale.x : 0,
        y: stick ? (stick.position.y - stick.origin.y) * scale.y : 0,
      });
      // The drawn offset is proportional to the sampled deflection and stops inside the markers.
      knob = {
        x: centre.x + Math.round(sampled.x * MOVE_KNOB_REACH),
        y: centre.y + Math.round(sampled.y * MOVE_KNOB_REACH),
      };
      const strength = Math.hypot(sampled.x, sampled.y);
      const across = strength ? sampled.x / strength : 0;
      ringPose =
        across <= -MARKER_THRESHOLD
          ? "held-left"
          : across >= MARKER_THRESHOLD
            ? "held-right"
            : "rest";
    } else {
      const dx = stick ? stick.position.x - stick.origin.x : 0;
      const dy = stick ? stick.position.y - stick.origin.y : 0;
      const divisor = Math.max(1, Math.hypot(dx, dy) / TOUCH_STICK.knobReach);
      knob = { x: centre.x + Math.round(dx / divisor), y: centre.y + Math.round(dy / divisor) };
    }
    const offset = { x: knob.x - centre.x, y: knob.y - centre.y };
    views[side] = {
      knob: centredAt(knob, TOUCH_KNOB_FRAME),
      knobPose: stick ? "held" : "rest",
      ...(offset.x !== 0 || offset.y !== 0
        ? { line: { at: centredAt(centre, SPEED_LINE_FRAME), offset } }
        : {}),
      ring: centredAt(centre, TOUCH_CHROME_FRAME),
      ringPose,
    };
  }
  return views;
}
