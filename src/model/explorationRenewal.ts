import { encounterQuiet } from "../data/enemyCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import type { Vec } from "./types.ts";
import { worldCellAt, type WorldCellContext, worldGrid } from "./worldCells.ts";
import { wrappedDelta } from "./worldGeometry.ts";

/** Retained after the final ordinary member disappears, until actual departure. */
export interface ExplorationRenewal {
  footprint: Vec;
  departed: boolean;
  seconds: number;
  distance: number;
}

export interface ExplorationRenewalContext extends WorldCellContext {
  readonly chunkSize: number;
  readonly galaxy: GalaxyNumber;
}

/** A canonical cell footprint, independent of the current live-object roster. */
export function explorationRenewal(
  context: ExplorationRenewalContext,
  point: Vec,
): ExplorationRenewal {
  return {
    departed: false,
    distance: 0,
    footprint: worldCellAt(worldGrid(context, context.chunkSize), point),
    seconds: 0,
  };
}

/** Call only for active physics slices; teleports and paused frames supply no samples. */
export function stepExplorationRenewal(
  context: ExplorationRenewalContext,
  sample: { readonly seconds: number; readonly from: Vec; readonly to: Vec },
  state: ExplorationRenewal,
): void {
  if (!Number.isFinite(sample.seconds) || sample.seconds <= 0) {
    return;
  }
  const grid = worldGrid(context, context.chunkSize);
  const at = worldCellAt(grid, sample.to);
  const delta =
    grid.periodCells === undefined
      ? { x: at.x - state.footprint.x, y: at.y - state.footprint.y }
      : wrappedDelta(grid.periodCells, state.footprint, at);
  if (!state.departed) {
    state.departed = Math.max(Math.abs(delta.x), Math.abs(delta.y)) > ACTIVE_CHUNK_RADIUS;
    // The crossing slice contains travel inside the retained footprint.
    return;
  }
  const travel =
    context.worldSide === undefined
      ? { x: sample.to.x - sample.from.x, y: sample.to.y - sample.from.y }
      : wrappedDelta(context.worldSide, sample.from, sample.to);
  state.seconds += sample.seconds;
  state.distance += Math.hypot(travel.x, travel.y);
}

export function explorationRenewalReady(
  context: ExplorationRenewalContext,
  state: ExplorationRenewal,
): boolean {
  const quiet = encounterQuiet(context.galaxy);
  return state.departed && state.seconds >= quiet.seconds && state.distance >= quiet.distance;
}
