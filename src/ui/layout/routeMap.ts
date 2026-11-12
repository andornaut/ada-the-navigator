import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";

import { GALAXY_COUNT, type RoutePosition } from "../../data/galaxies.ts";
import { SCREEN } from "../../data/screen.ts";
import { SHIP_HEADINGS, SHIP_NOSE } from "../../model/nose.ts";
import { CARD_CLOSE } from "./cardFrame.ts";
import { FRAME_LINE, TEXT_BUTTON } from "./controls.ts";
import { hudRect, type Insets, playView, SAFE_MARGIN, safeRect, type Size } from "./playView.ts";
import { BUTTON_GAP, SPACING } from "./tokens.ts";

// Galaxy selection's route map (art/layout.md "Galaxy selector", art/route-sky.md), after Chibi's
// zone map: six markers on two rows of three over the route sky, a panel for the chosen galaxy,
// and Earth and Jump below it. The chart is in play-view px from the game area's top-left; the
// panel and actions anchor to the available rect's bottom, so a taller view opens the gap.

export interface Point {
  readonly x: number;
  readonly y: number;
}

const CREAM = "#EAD4AA";
const INK = "#181425";
const GREY = "#B8B3C9";

export const ROUTE_MAP = {
  // Route positions 1 to 3 along the top, 4 to 6 back along the bottom: Chibi's 228 column
  // spacing centred, rows 72 apart.
  centres: [
    { x: 132, y: 53 },
    { x: 360, y: 53 },
    { x: 588, y: 53 },
    { x: 588, y: 125 },
    { x: 360, y: 125 },
    { x: 132, y: 125 },
  ],
  colors: { cream: CREAM, grey: GREY, ink: INK },
  // Each name on an ink pill: 20 high, the label plus 12 wide, its top 19 below the centre.
  label: { alpha: 0.85, height: 20, padding: 6, radius: 4, top: 19 },
  // The 36 frame: a radius 12 disc with a 1.5 ink edge over an ink backing disc, radius 15 at
  // 0.85; the cream selected ring at radius 17 (band 16 to 18).
  marker: {
    backing: { alpha: 0.85, radius: 15 },
    disc: 12,
    edge: 1.5,
    frame: 36,
    ring: { color: CREAM, radius: 17, width: 2 },
  },
  // Chibi's bentCurve per leg, stamped every 0.5, stopping 15 from each centre; its look is its
  // destination's.
  path: {
    bend: 0.08,
    locked: { color: GREY, kind: "dashes", off: 4, on: 6, width: 2 },
    open: { color: CREAM, kind: "solid", width: 4 },
    step: 0.5,
    trim: 15,
  },
  // A 48 press area and the 44 focus ring centred on each marker.
  press: 48,
  // The available rect's inset rules: 1 px, the inner 3 inside the outer.
  rules: { inner: "#4A4660", inset: 3, outer: "#6B6685", width: FRAME_LINE },
  // The ship frame drawn 32 on (centre x, centre y - 25).
  ship: { lift: 25, size: 32 },
} as const;

// The route sky (top-centre on the play view's top-centre) and ground (bottom on the view's
// bottom), at 2 image px per logical px; the figures on the ground at their canvas points.
export const ROUTE_SKY = {
  ground: { height: 120, width: 960 },
  sky: { height: 540, width: 960 },
  // Past the sky, the view shows its top colour.
  top: "#1F1A38",
} as const;

/** The sky and ground's left edge in play-view px: centred on the play view. */
export const ROUTE_SKY_LEFT = (SCREEN.width - ROUTE_SKY.sky.width) / 2;

const CAPTURE = { frame: FRAME_LINE, height: 90, width: 180 } as const;
const PANEL_PADDING = SPACING.gap;
const CAPTURE_GAP = 12;

export const ROUTE_PANEL = {
  capture: { ...CAPTURE, frameColor: INK },
  // The supporting colour for "Galaxy {number}", locked text and the development line.
  colors: { development: GREY, flavor: CREAM, name: "#FFFFFF", number: GREY },
  height: 112,
  // SPACING.gap with the 2 px frame inside it (art/layout.md "Exceptions").
  padding: PANEL_PADDING,
  rowGap: SPACING.rowGap,
  text: {
    left: PANEL_PADDING + CAPTURE.width + 2 * CAPTURE.frame + CAPTURE_GAP,
    width: 404,
  },
  width: 614,
} as const;

const ACTION_WIDTH = 192;
const CENTRE = SCREEN.width / 2;

export const ROUTE_ACTIONS = {
  // Earth secondary left, Jump primary right, BUTTON_GAP apart about the play view's centre.
  earth: CENTRE - BUTTON_GAP / 2 - ACTION_WIDTH,
  height: TEXT_BUTTON.height,
  jump: CENTRE + BUTTON_GAP / 2,
  width: ACTION_WIDTH,
} as const;

export const ROUTE_MOVE = {
  // The unlock's arrival: the selected ring fades in, the panel crossfades.
  arrival: { panel: 160, ring: 120 },
  // A reduced-motion unlock: the ship fades out, the markers switch, the ship fades in.
  reduced: { fade: 150 },
  // A selection move: 360 px/s along the legs, clamped, easeInOutSine on arc length.
  selection: { max: 0.9, min: 0.3, speed: 360 },
  // The unlock: the markers crossfade and their legs draw over 300 ms, a ring pulses in the
  // farthest new marker's hue over 400 ms, then the ship flies to it at 180 px/s, clamped so
  // the whole unlock takes at most 2.4 s (gameplay/rules.md).
  unlock: {
    depart: 0.4,
    fade: 0.3,
    max: 2.4,
    min: 0.8,
    pulse: { alpha: 0.8, from: 13, to: 26, width: 2 },
    speed: 180,
  },
} as const;

/** The view's route map rects, in logical px from the view's top-left. */
export interface RouteMapRects {
  readonly available: Rect;
  readonly capture: Rect;
  readonly close: { readonly face: Rect; readonly target: Rect };
  readonly earth: Rect;
  readonly jump: Rect;
  /** Each route position's 48 press area, in route order. */
  readonly markers: readonly Rect[];
  readonly panel: Rect;
  readonly text: Rect;
}

/** Each route position's marker centre in the view. */
export function markerCentre(view: Size, position: RoutePosition): Point {
  const centre = ROUTE_MAP.centres[position - 1]!;
  return { x: playView(view).x + centre.x, y: centre.y };
}

/** Every route map rect at view with insets. */
export function routeMapRects(insets: Insets, view: Size): RouteMapRects {
  const x0 = playView(view).x;
  const available = safeRect(insets, SAFE_MARGIN.page, view);
  const actionsTop = available.y + available.height - ROUTE_ACTIONS.height;
  const panelTop = actionsTop - SPACING.gap - ROUTE_PANEL.height;
  const panelLeft = x0 + (SCREEN.width - ROUTE_PANEL.width) / 2;
  const inner = { x: panelLeft + ROUTE_PANEL.padding, y: panelTop + ROUTE_PANEL.padding };
  const hud = hudRect(insets, view);
  const face: Rect = {
    height: CARD_CLOSE.art.height,
    width: CARD_CLOSE.art.width,
    x: hud.x + hud.width - CARD_CLOSE.art.width,
    y: hud.y,
  };
  const action = (left: number): Rect => ({
    height: ROUTE_ACTIONS.height,
    width: ROUTE_ACTIONS.width,
    x: x0 + left,
    y: actionsTop,
  });
  return {
    available,
    capture: {
      height: ROUTE_PANEL.capture.height + 2 * ROUTE_PANEL.capture.frame,
      width: ROUTE_PANEL.capture.width + 2 * ROUTE_PANEL.capture.frame,
      ...inner,
    },
    close: { face, target: hitAround(HIT_RULE, face) },
    earth: action(ROUTE_ACTIONS.earth),
    jump: action(ROUTE_ACTIONS.jump),
    markers: ROUTE_MAP.centres.map(({ x, y }) => ({
      height: ROUTE_MAP.press,
      width: ROUTE_MAP.press,
      x: x0 + x - ROUTE_MAP.press / 2,
      y: y - ROUTE_MAP.press / 2,
    })),
    panel: { height: ROUTE_PANEL.height, width: ROUTE_PANEL.width, x: panelLeft, y: panelTop },
    text: {
      height: ROUTE_PANEL.height - 2 * ROUTE_PANEL.padding,
      width: ROUTE_PANEL.text.width,
      x: panelLeft + ROUTE_PANEL.text.left,
      y: inner.y,
    },
  };
}

// Chibi's map paths (chibis-way-home src/ui/map/mapPath.ts): each leg a quadratic Bezier from one
// centre to the next, inked by squares stamped along it.

/** A leg: a quadratic Bezier from one centre to the next. */
export interface Curve {
  readonly control: Point;
  readonly from: Point;
  readonly to: Point;
}

/** How a leg is inked: squares `width` wide, solid or dashed (on and off in px along it). */
export type PathStroke =
  | { readonly kind: "dashes"; readonly off: number; readonly on: number; readonly width: number }
  | { readonly kind: "solid"; readonly width: number };

const SAMPLES = 1024;

/**
 * The curve between two centres, its control point the chord's midpoint pushed sideways by bend
 * times the chord's length: left of travel on an even leg, right on an odd one.
 */
export function bentCurve(bend: number, from: Point, to: Point, index: number): Curve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    control: {
      x: (from.x + to.x) / 2 + side * bend * dy,
      y: (from.y + to.y) / 2 - side * bend * dx,
    },
    from,
    to,
  };
}

function pointAt({ control, from, to }: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** A curve sampled evenly in t, with the arc length up to each sample. */
interface Arc {
  readonly lengths: readonly number[];
  readonly points: readonly Point[];
}

function arcOf(curve: Curve): Arc {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => pointAt(curve, i / SAMPLES));
  let length = 0;
  const lengths = points.map((point, i) => {
    const before = points[i - 1];
    length += before ? Math.hypot(point.x - before.x, point.y - before.y) : 0;
    return length;
  });
  return { lengths, points };
}

/** The point s px along an arc, and the arc's direction there. */
function along({ lengths, points }: Arc, s: number): { point: Point; tangent: Point } {
  let low = 1;
  let high = SAMPLES;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((lengths[mid] ?? 0) < s) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const a = points[low - 1]!;
  const b = points[low] ?? a;
  const start = lengths[low - 1] ?? 0;
  const span = (lengths[low] ?? start) - start;
  const k = span === 0 ? 0 : Math.min(1, Math.max(0, (s - start) / span));
  return {
    point: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
    tangent: { x: b.x - a.x, y: b.y - a.y },
  };
}

/** The first arc length at which the curve is at least `far` from centre, from one end. */
function trimAt(arc: Arc, centre: Point, far: number, fromEnd: boolean): number {
  const total = arc.lengths.at(-1) ?? 0;
  const distance = (s: number) => {
    const { point } = along(arc, fromEnd ? total - s : s);
    return Math.hypot(point.x - centre.x, point.y - centre.y);
  };
  let low = 0;
  let high = total;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (distance(mid) < far) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return fromEnd ? total - high : high;
}

/** A width x width square centred on a point, on whole pixels. */
function stampAt(width: number, { x, y }: Point): Rect {
  const corner = (centre: number) => Math.floor(centre - width / 2 + 0.5);
  return { height: width, width, x: corner(x), y: corner(y) };
}

/** A stamp along a leg, with its distance from the leg's start, for drawing it on in order. */
export interface Stamp extends Rect {
  readonly distance: number;
}

/** The squares that ink a leg between its trimmed ends, stamped every `step` px, each once. */
export function pathStamps(step: number, stroke: PathStroke, trim: number, curve: Curve): Stamp[] {
  const arc = arcOf(curve);
  const start = trimAt(arc, curve.from, trim, false);
  const end = trimAt(arc, curve.to, trim, true);
  const length = Math.max(0, end - start);
  const seen = new Set<string>();
  const stamps: Stamp[] = [];
  for (let i = 0; i * step <= length; i++) {
    const distance = i * step;
    if (stroke.kind === "dashes" && distance % (stroke.on + stroke.off) > stroke.on) {
      continue;
    }
    const rect = stampAt(stroke.width, along(arc, start + distance).point);
    const key = `${rect.x},${rect.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      stamps.push({ ...rect, distance });
    }
  }
  return stamps;
}

/** The five legs in play-view px: leg i runs from route position i + 1 to i + 2. */
export const ROUTE_LEGS: readonly Curve[] = ROUTE_MAP.centres
  .slice(1)
  .map((to, i) => bentCurve(ROUTE_MAP.path.bend, ROUTE_MAP.centres[i]!, to, i));

const ARCS = ROUTE_LEGS.map(arcOf);
const LEG_LENGTHS = ARCS.map((arc) => arc.lengths.at(-1) ?? 0);

/** The route's arc length from position 1's centre to a position's centre. */
export function routeDistance(position: RoutePosition): number {
  return LEG_LENGTHS.slice(0, position - 1).reduce((sum, length) => sum + length, 0);
}

/**
 * The point and direction of travel `distance` px along the route from position 1's centre,
 * in play-view px, at the marker centres' height (the ship draws ROUTE_MAP.ship.lift above it).
 */
export function routePoint(distance: number): { point: Point; tangent: Point } {
  let rest = Math.min(Math.max(0, distance), routeDistance(GALAXY_COUNT as RoutePosition));
  for (const [index, arc] of ARCS.entries()) {
    const length = LEG_LENGTHS[index]!;
    if (rest <= length || index === ARCS.length - 1) {
      return along(arc, rest);
    }
    rest -= length;
  }
  return along(ARCS[0]!, 0);
}

/** The ship's resting direction at a marker: the outgoing leg's, or the last leg's at its end. */
export function restingTangent(position: RoutePosition): Point {
  return position === GALAXY_COUNT
    ? routePoint(routeDistance(position)).tangent
    : along(ARCS[position - 1]!, 0).tangent;
}

/** easeInOutSine on [0, 1]. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;
}

/** A selection move's duration in seconds over `length` px of route. */
export function selectionSeconds(length: number): number {
  const { max, min, speed } = ROUTE_MOVE.selection;
  return Math.min(max, Math.max(min, length / speed));
}

/** An unlock's flight duration in seconds over `length` px, after the 400 ms departure. */
export function unlockFlightSeconds(length: number): number {
  const { depart, max, min, speed } = ROUTE_MOVE.unlock;
  return Math.min(max - depart, Math.max(min, length / speed));
}

/** An unlock from one route position to another, in seconds from the start to the arrival. */
export function unlockSeconds(from: RoutePosition, to: RoutePosition): number {
  return (
    ROUTE_MOVE.unlock.depart +
    unlockFlightSeconds(Math.abs(routeDistance(to) - routeDistance(from)))
  );
}

/** Each heading's nose angle from the frame's centre, in screen radians (ship-nose.json). */
const NOSE_ANGLES = SHIP_NOSE.noses.map(({ x, y }) =>
  Math.atan2(y - SHIP_NOSE.frame / 2, x - SHIP_NOSE.frame / 2),
);

/** Of the 32 headings, the one whose nose angle is nearest a direction on screen. */
export function routeHeading(direction: Point): number {
  const angle = Math.atan2(direction.y, direction.x);
  let best = 0;
  let nearest = Infinity;
  for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
    const off = Math.abs(
      Math.atan2(Math.sin(angle - NOSE_ANGLES[heading]!), Math.cos(angle - NOSE_ANGLES[heading]!)),
    );
    if (off < nearest) {
      nearest = off;
      best = heading;
    }
  }
  return best;
}
