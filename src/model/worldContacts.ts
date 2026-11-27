import type { Vec } from "./types.ts";
import { nearestImage, wrappedDelta, wrappedDistance } from "./worldGeometry.ts";

/** Only the flight owner supplies a side; omitted topology preserves legacy Euclidean operands. */
export interface WorldContext {
  readonly worldSide?: number;
}

export function worldDelta(context: WorldContext, from: Vec, to: Vec): Vec {
  return context.worldSide === undefined
    ? { x: to.x - from.x, y: to.y - from.y }
    : wrappedDelta(context.worldSide, from, to);
}

export function worldDistance(context: WorldContext, from: Vec, to: Vec): number {
  return context.worldSide === undefined
    ? Math.hypot(to.x - from.x, to.y - from.y)
    : wrappedDistance(context.worldSide, from, to);
}

/** A temporary point in the reference's local chart, never a new entity or saved position. */
export function worldPoint(context: WorldContext, reference: Vec, point: Vec): Vec {
  return context.worldSide === undefined
    ? point
    : nearestImage(context.worldSide, reference, point).point;
}

/** Distance to the nearest point on a segment in a single local chart. */
export function segmentDistance(point: Vec, start: Vec, end: Vec): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / square))
    : 0;
  const closest = { x: start.x + dx * t, y: start.y + dy * t };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}
