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
