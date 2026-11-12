import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";

import { GALAXY_COUNT, type RoutePosition } from "../../data/galaxies.ts";
import {
  GALAXY_MAP_ACTIONS,
  GALAXY_MAP_ARC_POINTS,
  GALAXY_MAP_LAYOUT,
  GALAXY_MAP_MOVE,
  GALAXY_MAP_PANEL,
  SAFE_MARGIN,
  SPACING,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { SHIP_HEADINGS, SHIP_NOSE } from "../../model/nose.ts";
import { CARD_CLOSE } from "./cardFrame.ts";
import { hudRect, type Insets, playView, safeRect, type Size } from "./playView.ts";
export {
  GALAXY_MAP_ACTIONS,
  GALAXY_MAP_MOVE,
  GALAXY_MAP_PANEL,
  GALAXY_MAP_SKY,
  GALAXY_MAP_SKY_LEFT,
} from "../../data/layout.ts";

// Galaxy selection's route map (art/layout.md "Galaxy selector", art/route-sky.md), after Chibi's
// zone map: six markers left to right along one arc over the route sky, a panel for the chosen
// galaxy, and Earth and Jump below it. The chart is in play-view px from the game area's top-left;
// the panel and actions anchor to the available rect's bottom, so a taller view opens the gap.

export interface Point {
  readonly x: number;
  readonly y: number;
}

const HALF_CHORD = (GALAXY_MAP_ARC_POINTS.last.x - GALAXY_MAP_ARC_POINTS.first.x) / 2;
const RISE = GALAXY_MAP_ARC_POINTS.first.y - GALAXY_MAP_ARC_POINTS.top.y;
const RADIUS = (HALF_CHORD ** 2 + RISE ** 2) / (2 * RISE);
const HALF_ANGLE = Math.asin(HALF_CHORD / RADIUS);

export const GALAXY_MAP_ARC = {
  centre: { x: GALAXY_MAP_ARC_POINTS.top.x, y: GALAXY_MAP_ARC_POINTS.top.y + RADIUS },
  /** Route position 1's angle off vertical, in radians; position 6's is its negative. */
  first: -HALF_ANGLE,
  radius: RADIUS,
  /** The angle between consecutive markers. */
  step: (2 * HALF_ANGLE) / (GALAXY_COUNT - 1),
} as const;

/** The point on the route's circle at an angle off vertical, clockwise from its top. */
export function arcPoint(angle: number): Point {
  return {
    x: GALAXY_MAP_ARC.centre.x + GALAXY_MAP_ARC.radius * Math.sin(angle),
    y: GALAXY_MAP_ARC.centre.y - GALAXY_MAP_ARC.radius * Math.cos(angle),
  };
}

/** Each route position's angle off vertical, in route order. */
const MARKER_ANGLES = Array.from(
  { length: GALAXY_COUNT },
  (_, index) => GALAXY_MAP_ARC.first + index * GALAXY_MAP_ARC.step,
);

export const GALAXY_MAP = {
  ...GALAXY_MAP_LAYOUT,
  // Route positions 1 to 6 left to right along the arc (GALAXY_MAP_ARC).
  centres: MARKER_ANGLES.map(arcPoint),
} as const;

/** The view's route map rects, in logical px from the view's top-left. */
export interface GalaxyMapRects {
  readonly available: Rect;
  readonly capture: Rect;
  /** The close X's 24 face on the HUD rect's top-right corner, and its 48 press area. */
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
  const centre = GALAXY_MAP.centres[position - 1]!;
  return { x: playView(view).x + centre.x, y: centre.y };
}

/** Every route map rect at view with insets. */
export function galaxyMapRects(insets: Insets, view: Size): GalaxyMapRects {
  const x0 = playView(view).x;
  const available = safeRect(insets, SAFE_MARGIN.page, view);
  const actionsTop = available.y + available.height - GALAXY_MAP_ACTIONS.height;
  const panelTop = actionsTop - SPACING.gap - GALAXY_MAP_PANEL.height;
  const panelLeft = x0 + (SCREEN.width - GALAXY_MAP_PANEL.width) / 2;
  const inner = { x: panelLeft + GALAXY_MAP_PANEL.padding, y: panelTop + GALAXY_MAP_PANEL.padding };
  const hud = hudRect(insets, view);
  const face: Rect = {
    height: CARD_CLOSE.art.height,
    width: CARD_CLOSE.art.width,
    x: hud.x + hud.width - CARD_CLOSE.art.width,
    y: hud.y,
  };
  const action = (left: number): Rect => ({
    height: GALAXY_MAP_ACTIONS.height,
    width: GALAXY_MAP_ACTIONS.width,
    x: x0 + left,
    y: actionsTop,
  });
  return {
    available,
    capture: {
      height: GALAXY_MAP_PANEL.capture.height + 2 * GALAXY_MAP_PANEL.capture.frame,
      width: GALAXY_MAP_PANEL.capture.width + 2 * GALAXY_MAP_PANEL.capture.frame,
      ...inner,
    },
    close: { face, target: hitAround(HIT_RULE, face) },
    earth: action(GALAXY_MAP_ACTIONS.earth),
    jump: action(GALAXY_MAP_ACTIONS.jump),
    markers: GALAXY_MAP.centres.map(({ x, y }) => ({
      height: GALAXY_MAP.press,
      width: GALAXY_MAP.press,
      x: x0 + x - GALAXY_MAP.press / 2,
      y: y - GALAXY_MAP.press / 2,
    })),
    panel: {
      height: GALAXY_MAP_PANEL.height,
      width: GALAXY_MAP_PANEL.width,
      x: panelLeft,
      y: panelTop,
    },
    text: {
      height: GALAXY_MAP_PANEL.height - 2 * GALAXY_MAP_PANEL.padding,
      width: GALAXY_MAP_PANEL.text.width,
      x: panelLeft + GALAXY_MAP_PANEL.text.left,
      y: inner.y,
    },
  };
}

// The route's legs: each the arc of the route's circle from one centre to the next, inked by
// squares stamped along it as Chibi's map paths are (chibis-way-home src/ui/map/mapPath.ts).

/** A leg: the arc of a circle from one centre to the next, by angle off vertical. */
export interface Curve {
  readonly centre: Point;
  readonly from: Point;
  readonly fromAngle: number;
  readonly radius: number;
  readonly to: Point;
  readonly toAngle: number;
}

/** How a leg is inked: squares `width` wide, solid or dashed (on and off in px along it). */
export type PathStroke =
  | { readonly kind: "dashes"; readonly off: number; readonly on: number; readonly width: number }
  | { readonly kind: "solid"; readonly width: number };

const SAMPLES = 1024;

function pointAt({ centre, fromAngle, radius, toAngle }: Curve, t: number): Point {
  const angle = fromAngle + (toAngle - fromAngle) * t;
  return {
    x: centre.x + radius * Math.sin(angle),
    y: centre.y - radius * Math.cos(angle),
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
export const GALAXY_MAP_LEGS: readonly Curve[] = GALAXY_MAP.centres.slice(1).map((to, i) => ({
  centre: GALAXY_MAP_ARC.centre,
  from: GALAXY_MAP.centres[i]!,
  fromAngle: MARKER_ANGLES[i]!,
  radius: GALAXY_MAP_ARC.radius,
  to,
  toAngle: MARKER_ANGLES[i + 1]!,
}));

const ARCS = GALAXY_MAP_LEGS.map(arcOf);
const LEG_LENGTHS = ARCS.map((arc) => arc.lengths.at(-1) ?? 0);

/** The route's arc length from position 1's centre to a position's centre. */
export function routeDistance(position: RoutePosition): number {
  return LEG_LENGTHS.slice(0, position - 1).reduce((sum, length) => sum + length, 0);
}

/**
 * The point and direction of travel `distance` px along the route from position 1's centre,
 * in play-view px, at the marker centres' height (the ship draws GALAXY_MAP.ship.lift above it).
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
  const { max, min, speed } = GALAXY_MAP_MOVE.selection;
  return Math.min(max, Math.max(min, length / speed));
}

/** An unlock's flight duration in seconds over `length` px, after the 400 ms departure. */
export function unlockFlightSeconds(length: number): number {
  const { depart, max, min, speed } = GALAXY_MAP_MOVE.unlock;
  return Math.min(max - depart, Math.max(min, length / speed));
}

/** An unlock from one route position to another, in seconds from the start to the arrival. */
export function unlockSeconds(from: RoutePosition, to: RoutePosition): number {
  return (
    GALAXY_MAP_MOVE.unlock.depart +
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
