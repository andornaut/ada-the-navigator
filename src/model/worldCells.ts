import type { Vec } from "./types.ts";
import { canonicalCell, wrapCoordinate, wrapPoint } from "./worldGeometry.ts";

/** Absence explicitly preserves a legacy flight's unbounded placement grids. */
export interface WorldCellContext {
  readonly worldSide?: number;
}

export interface WorldGrid extends WorldCellContext {
  readonly nominalPitch: number;
  readonly periodCells?: number;
  readonly phase: number;
  readonly pitch: number;
}

function pitchSize(pitch: number): void {
  if (!Number.isFinite(pitch) || pitch <= 0) {
    throw new RangeError("Invalid placement cell pitch");
  }
}

function grid(context: WorldCellContext, nominalPitch: number, periodic: boolean): WorldGrid {
  pitchSize(nominalPitch);
  const side = context.worldSide;
  if (side === undefined) {
    return { nominalPitch, phase: 0, pitch: nominalPitch };
  }
  wrapCoordinate(side, 0);
  const count = periodic ? Math.floor(side / nominalPitch) : side / nominalPitch;
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError("World side must contain a whole placement grid");
  }
  const pitch = side / count;
  return {
    nominalPitch,
    periodCells: count,
    phase: count % 2 ? -pitch / 2 : 0,
    pitch,
    worldSide: side,
  };
}

/** Exact grids preserve their configured pitch and signed near-origin identities. */
export function worldGrid(context: WorldCellContext, nominalPitch: number): WorldGrid {
  return grid(context, nominalPitch, false);
}

/** Uniform periodic cells fill the world without a shortened final cell or a seam gap. */
export function periodicWorldGrid(context: WorldCellContext, nominalPitch: number): WorldGrid {
  return grid(context, nominalPitch, true);
}

/** Occupancy is derived from the configured area density, not the galaxy's total population. */
export function worldCellChance(grid: WorldGrid, nominalChance: number): number {
  if (!Number.isFinite(nominalChance) || nominalChance < 0 || nominalChance > 1) {
    throw new RangeError("Invalid placement density");
  }
  const chance = nominalChance * (grid.pitch / grid.nominalPitch) ** 2;
  if (chance > 1) {
    throw new RangeError("Placement density exceeds periodic cell capacity");
  }
  return chance;
}

export function worldCell(grid: WorldGrid, cell: Vec): Vec {
  if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) {
    throw new RangeError("Invalid placement cell identity");
  }
  return grid.periodCells === undefined ? { ...cell } : canonicalCell(grid.periodCells, cell);
}

export function worldCellKey(grid: WorldGrid, cell: Vec): string {
  const at = worldCell(grid, cell);
  return `${at.x},${at.y}`;
}

export function worldCellAt(grid: WorldGrid, point: Vec): Vec {
  const at = grid.worldSide === undefined ? point : wrapPoint(grid.worldSide, point);
  return worldCell(grid, {
    x: Math.floor((at.x - grid.phase) / grid.pitch),
    y: Math.floor((at.y - grid.phase) / grid.pitch),
  });
}

export function worldCellOrigin(grid: WorldGrid, cell: Vec): Vec {
  const at = worldCell(grid, cell);
  return { x: at.x * grid.pitch + grid.phase, y: at.y * grid.pitch + grid.phase };
}

/** Lazy local candidates, with each canonical cell yielded once even across both seams. */
export function* worldCellsNear(grid: WorldGrid, radius: number, point: Vec): Iterable<Vec> {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError("Invalid placement query radius");
  }
  const at = grid.worldSide === undefined ? point : wrapPoint(grid.worldSide, point);
  const first = {
    x: Math.floor((at.x - radius - grid.phase) / grid.pitch),
    y: Math.floor((at.y - radius - grid.phase) / grid.pitch),
  };
  const last = {
    x: Math.floor((at.x + radius - grid.phase) / grid.pitch),
    y: Math.floor((at.y + radius - grid.phase) / grid.pitch),
  };
  if (![first.x, first.y, last.x, last.y].every(Number.isSafeInteger)) {
    throw new RangeError("Placement query exceeds safe cell bounds");
  }
  const width = Math.min(last.x - first.x + 1, grid.periodCells ?? Infinity);
  const height = Math.min(last.y - first.y + 1, grid.periodCells ?? Infinity);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      yield worldCell(grid, { x: first.x + x, y: first.y + y });
    }
  }
}
