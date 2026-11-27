import type { SpacePalette } from "../art/spacePalette.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import { phantomBlockadeSignal, type PhantomContext } from "../model/phantom.ts";
import type { Vec } from "../model/types.ts";
import { worldPoint } from "../model/worldContacts.ts";
import { LIGHT_FIELD } from "./lightField.ts";

interface BlockadeScene {
  readonly overlay: {
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    lineStyle(width: number, colour: number, alpha?: number): unknown;
  };
  readonly palette: SpacePalette;
  project(point: Vec): Vec;
}

type Segment = readonly [Vec, Vec];

const EDGE_INSET = 16;

function warningMark(origin: Vec, site: Vec): Segment[] {
  const dx = site.x - origin.x;
  const dy = site.y - origin.y;
  const reach = (offset: number, start: number, limit: number): number =>
    offset === 0 ? Infinity : ((offset > 0 ? limit - EDGE_INSET : EDGE_INSET) - start) / offset;
  const share = Math.min(1, reach(dx, origin.x, SCREEN.width), reach(dy, origin.y, SCREEN.height));
  const x = origin.x + dx * share;
  const y = origin.y + dy * share;
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

/** Bound drawing to the portion whose arrows can touch the viewport. */
function visibleDistances(
  from: Vec,
  direction: Vec,
  length: number,
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
      if (origin < -EDGE_INSET || origin > limit + EDGE_INSET) {
        return null;
      }
      continue;
    }
    const a = (-EDGE_INSET - origin) / slope;
    const b = (limit + EDGE_INSET - origin) / slope;
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
  const visible = visibleDistances(from, { x, y }, length);
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

function stroke(scene: BlockadeScene, colour: number, segments: readonly Segment[]): void {
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

/** Draw steady shapes on the existing world overlay, including with reduced motion. */
export function drawPhantomBlockades(scene: BlockadeScene, context: PhantomContext): void {
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
