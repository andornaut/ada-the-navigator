import type { SpacePalette } from "../art/index.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import { phantomBlockadeSignal, type PhantomContext } from "../model/phantom.ts";
import type { Vec } from "../model/types.ts";
import { worldPoint } from "../model/worldContacts.ts";
import { LIGHT_FIELD } from "./lightField.ts";

interface EncounterOverlay {
  readonly overlay: {
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    lineStyle(width: number, colour: number, alpha?: number): unknown;
  };
  readonly palette: SpacePalette;
  project(point: Vec): Vec;
}

type Segment = readonly [Vec, Vec];

const EDGE_INSET = 16;

function edgePoint(origin: Vec, site: Vec): Vec {
  const dx = site.x - origin.x;
  const dy = site.y - origin.y;
  const reach = (offset: number, start: number, limit: number): number =>
    offset === 0 ? Infinity : ((offset > 0 ? limit - EDGE_INSET : EDGE_INSET) - start) / offset;
  const share = Math.min(1, reach(dx, origin.x, SCREEN.width), reach(dy, origin.y, SCREEN.height));
  return { x: origin.x + dx * share, y: origin.y + dy * share };
}

function warningMark(origin: Vec, site: Vec): Segment[] {
  const { x, y } = edgePoint(origin, site);
  const a = { x: x - 10, y: y + 8 };
  const b = { x, y: y - 10 };
  const c = { x: x + 10, y: y + 8 };
  return [
    [a, b],
    [b, c],
    [c, a],
    [
      { x, y: y - 3 },
      { x, y: y + 2 },
    ],
    [
      { x: x - 0.5, y: y + 5 },
      { x: x + 0.5, y: y + 5 },
    ],
  ];
}

/** Intersect a forward path with the viewport, optionally allowing room for its marks. */
export function visibleDistances(
  from: Vec,
  direction: Vec,
  length: number,
  inset = 0,
): readonly [number, number] | null {
  let start = 0;
  let end = length;
  for (const [axis, limit] of [
    ["x", SCREEN.width],
    ["y", SCREEN.height],
  ] as const) {
    const slope = direction[axis];
    const origin = from[axis];
    if (slope === 0) {
      if (origin < -inset || origin > limit + inset) {
        return null;
      }
      continue;
    }
    const a = (-inset - origin) / slope;
    const b = (limit + inset - origin) / slope;
    start = Math.max(start, Math.min(a, b));
    end = Math.min(end, Math.max(a, b));
  }
  return start <= end ? [start, end] : null;
}

function withdrawalMarks(from: Vec, to: Vec): Segment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return [];
  }
  const x = dx / length;
  const y = dy / length;
  const visible = visibleDistances(from, { x, y }, length, EDGE_INSET);
  if (!visible) {
    return [];
  }
  const [start, end] = visible;
  const at = (along: number, across = 0): Vec => ({
    x: from.x + x * along - y * across,
    y: from.y + y * along + x * across,
  });
  const segments: Segment[] = [];
  const first = 24 + Math.max(0, Math.ceil((start - 24) / 32)) * 32;
  for (let along = first; along <= end && along < length; along += 32) {
    const tip = at(along);
    segments.push([at(along - 10, -6), tip], [at(along - 10, 6), tip]);
  }
  if (end === length) {
    segments.push([at(length - 10, -6), to], [at(length - 10, 6), to]);
  }
  return segments;
}

function stroke(scene: EncounterOverlay, colour: number, segments: readonly Segment[]): void {
  if (!segments.length) {
    return;
  }
  for (const [width, ink] of [
    [4, LIGHT_FIELD.ink],
    [2, colour],
  ] as const) {
    scene.overlay.lineStyle(width, ink, 0.95);
    for (const [from, to] of segments) {
      scene.overlay.lineBetween(from.x, from.y, to.x, to.y);
    }
  }
}

/** Mark verified route geometry, or point at its entrance while it is outside the view. */
export function drawEncounterRoute(
  scene: EncounterOverlay,
  player: Vec,
  [from, to]: Segment,
): void {
  const projected = scene.project(player);
  const start = scene.project(from);
  const marks = withdrawalMarks(start, scene.project(to));
  if (!marks.length) {
    const tip = edgePoint(projected, start);
    const dx = tip.x - projected.x;
    const dy = tip.y - projected.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      const x = dx / distance;
      const y = dy / distance;
      for (const side of [-1, 1]) {
        marks.push([{ x: tip.x - 10 * x - side * 6 * y, y: tip.y - 10 * y + side * 6 * x }, tip]);
      }
    }
  }
  stroke(scene, scene.palette.active, marks);
}

/** Draw steady shapes on the existing world overlay, including with reduced motion. */
export function drawPhantomBlockades(scene: EncounterOverlay, context: PhantomContext): void {
  const flight = context.flight;
  if (!flight.phantom?.blockadePhases) {
    return;
  }
  const world = flightWorldContext(flight);
  for (const id of PHANTOM_DESTINATIONS) {
    const signal = phantomBlockadeSignal(context, id);
    if (!signal) {
      continue;
    }
    const site = worldPoint(world, flight.player, signal.site);
    const origin = scene.project(site);
    if (signal.phase === "warning") {
      stroke(scene, scene.palette.threat, warningMark(scene.project(flight.player), origin));
    } else {
      const exit = scene.project(worldPoint(world, site, signal.withdrawal));
      stroke(scene, scene.palette.active, withdrawalMarks(origin, exit));
    }
  }
}
