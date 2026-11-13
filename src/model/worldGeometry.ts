import type { Vec } from "./types.ts";

export interface WorldImage {
  /** World-unit translation added to the original point, not a count of periods. */
  readonly offset: Vec;
  readonly point: Vec;
}

function extent(side: number): void {
  if (!Number.isSafeInteger(side) || side <= 0) {
    throw new RangeError("World side must be a positive safe integer");
  }
}
function coordinate(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 2) {
    throw new RangeError("World coordinate exceeds finite save bounds");
  }
}

/** Canonical world coordinates occupy [-side / 2, side / 2), with one representation of zero. */
export function wrapCoordinate(side: number, value: number): number {
  extent(side);
  coordinate(value);
  let wrapped = value % side;
  if (wrapped >= side / 2) {
    wrapped -= side;
  }
  if (wrapped < -side / 2) {
    wrapped += side;
  }
  return wrapped === 0 ? 0 : wrapped;
}

export function wrapPoint(side: number, point: Vec): Vec {
  return { x: wrapCoordinate(side, point.x), y: wrapCoordinate(side, point.y) };
}

/** Exact half-period ties retain the sign of the canonical displacement, preserving reciprocity. */
export function wrappedDelta(side: number, from: Vec, to: Vec): Vec {
  const start = wrapPoint(side, from);
  const end = wrapPoint(side, to);
  const axis = (delta: number): number => {
    if (delta > side / 2) {
      return delta - side;
    }
    if (delta < -side / 2) {
      return delta + side;
    }
    return delta === 0 ? 0 : delta;
  };
  return { x: axis(end.x - start.x), y: axis(end.y - start.y) };
}

export function wrappedDistanceSquared(side: number, from: Vec, to: Vec): number {
  const delta = wrappedDelta(side, from, to);
  return delta.x * delta.x + delta.y * delta.y;
}

export function wrappedDistance(side: number, from: Vec, to: Vec): number {
  const delta = wrappedDelta(side, from, to);
  return Math.hypot(delta.x, delta.y);
}

/** An ephemeral nearby image, never a second entity or an independently wrapped authored shape. */
export function nearestImage(side: number, reference: Vec, point: Vec): WorldImage {
  const delta = wrappedDelta(side, reference, point);
  const periods = {
    x: Math.round((reference.x + delta.x - point.x) / side),
    y: Math.round((reference.y + delta.y - point.y) / side),
  };
  const offset = {
    x: periods.x === 0 ? 0 : periods.x * side,
    y: periods.y === 0 ? 0 : periods.y * side,
  };
  return { offset, point: { x: point.x + offset.x, y: point.y + offset.y } };
}

/** A sampler supplies its integer cell period explicitly; a non-dividing spatial pitch is not inferred. */
export function canonicalCell(periodCells: number, cell: Vec): Vec {
  extent(periodCells);
  const axis = (index: number): number => {
    if (!Number.isSafeInteger(index)) {
      throw new RangeError("Cell index must be a safe integer");
    }
    let wrapped = index % periodCells;
    if (wrapped < 0) {
      wrapped += periodCells;
    }
    if (wrapped >= Math.ceil(periodCells / 2)) {
      wrapped -= periodCells;
    }
    return wrapped === 0 ? 0 : wrapped;
  };
  return { x: axis(cell.x), y: axis(cell.y) };
}

export function canonicalCellKey(periodCells: number, cell: Vec): string {
  const canonical = canonicalCell(periodCells, cell);
  return `${canonical.x},${canonical.y}`;
}
