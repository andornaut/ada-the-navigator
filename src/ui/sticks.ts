import { SCREEN } from "../data/screen.ts";
import {
  type ControlState,
  MOVE_STICK_GEOMETRY,
  type StickSide,
  stickVector,
} from "../input/state.ts";
import type { ControlVisibility } from "./device-settings.ts";
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

// The aim knob moves at most this many game pixels from its ring's centre, as Chibi's knob does.
export const AIM_KNOB_REACH = 12;

// Chibi's bottom controls sit CONTROL_BOTTOM above the canvas's bottom, drawn edge to edge; its
// move hint rests as far in from the view's left as its Use button is from the view's right.
const CONTROL_BOTTOM = 20;
const CONTROL_SIDE = 85;
const DRAWN_HALF = (TOUCH_CHROME_FRAME - 1) / 2 - 1;
const REST_Y = SCREEN.height - 1 - CONTROL_BOTTOM - DRAWN_HALF;
const MOVE_REST_X = CONTROL_SIDE + DRAWN_HALF;

// How far the bottom controls move from where they sit in a canvas the game's own size: across
// with the centred view and down to the canvas's bottom.
function bottomShift(canvas: Size): Point {
  return {
    x: Math.floor((Math.floor(canvas.width) - SCREEN.width) / 2),
    y: Math.floor(canvas.height) - SCREEN.height,
  };
}

// Each joystick's ring centre at rest: the move ring where Chibi's move hint rests and the aim
// ring mirrored across the view.
export function stickRestCentres(canvas: Size): Readonly<Record<StickSide, Point>> {
  const shift = bottomShift(canvas);
  return {
    aim: { x: shift.x + SCREEN.width - 1 - MOVE_REST_X, y: shift.y + REST_Y },
    move: { x: shift.x + MOVE_REST_X, y: shift.y + REST_Y },
  };
}

// The top-left of an odd-sized frame whose centre pixel sits on centre.
export function centredAt(centre: Point, frame: number): Point {
  return { x: centre.x - (frame - 1) / 2, y: centre.y - (frame - 1) / 2 };
}

const rounded = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

// The joysticks as drawn: a side is absent while hidden by its setting or while controls do not
// show. A held stick's ring centres on where its drag began; at rest it sits at its rest centre.
// The move knob moves in proportion to the sampled deflection, at most MOVE_KNOB_REACH pixels,
// so it stays inside the markers; the aim knob moves at most
// AIM_KNOB_REACH pixels.
export function stickViews(
  layout: StickLayout,
  state: ControlState,
): Partial<Record<StickSide, StickView>> {
  const views: Partial<Record<StickSide, StickView>> = {};
  if (!layout.visible) {
    return views;
  }
  const rest = stickRestCentres(layout);
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
      const divisor = Math.max(1, Math.hypot(dx, dy) / AIM_KNOB_REACH);
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
