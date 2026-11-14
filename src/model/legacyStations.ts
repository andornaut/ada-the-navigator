import type { EconomyCatalog } from "../data/economy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { Vec } from "./types.ts";
import {
  worldCell,
  type WorldCellContext,
  worldCellKey,
  worldCellOrigin,
  worldCellsNear,
  worldGrid,
} from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

export const stationDistance = (context: WorldCellContext, a: Vec, b: Vec): number =>
  context.worldSide === undefined
    ? Math.hypot(a.x - b.x, a.y - b.y)
    : wrappedDistance(context.worldSide, a, b);

export interface StationSite extends Vec {
  id: string;
}

/** Fixed per-galaxy seeds, so station sites are the same on every flight. */
export const GALAXY_SEEDS: Readonly<Partial<Record<GalaxyNumber, number>>> = {
  1: 0x5eed_0101,
  2: 0x5eed_0202,
  3: 0x5eed_0303,
  4: 0x5eed_0404,
  5: 0x5eed_0505,
  6: 0x5eed_0606,
};

export function mix(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n ^ (n >>> 13)) >>> 0;
}
export const unit = (value: number) => value / 4294967296;

export function stationId(cell: Vec): string {
  return `station:${cell.x},${cell.y}`;
}

/**
 * The station in one placement cell, or null. A station sits inside the cell's central
 * band of side `jitter`, so stations in different cells are at least
 * `cellSize - jitter` apart.
 */
export function worldStationInCell(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  rawCell: Vec,
): StationSite | null {
  const { cellSize, chance, jitter, originClearance } = catalog.station;
  const grid = worldGrid(context, cellSize);
  const cell = worldCell(grid, rawCell);
  const origin = worldCellOrigin(grid, cell);
  const seed = GALAXY_SEEDS[galaxy];
  if (seed === undefined || unit(mix(seed, cell.x, cell.y)) >= chance) {
    return null;
  }
  const margin = (grid.pitch - jitter) / 2;
  const x = origin.x + margin + unit(mix(seed ^ 0x9e37, cell.x, cell.y)) * jitter;
  const y = origin.y + margin + unit(mix(seed ^ 0x79b9, cell.x, cell.y)) * jitter;
  if (stationDistance(context, { x: 0, y: 0 }, { x, y }) < originClearance) {
    return null;
  }
  return { id: stationId(cell), x, y };
}

/** Cartwheel's mining hub is its galaxy's station by this id (gameplay/rules.md). */
export const HUB_STATION = "hub";

export function worldLegacyStationById(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationSite | null {
  const match = /^station:(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.exec(id);
  if (!match) {
    return null;
  }
  const cell = { x: Number(match[1]), y: Number(match[2]) };
  if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) {
    return null;
  }
  if (
    context.worldSide !== undefined &&
    worldCellKey(worldGrid(context, catalog.station.cellSize), cell) !== `${match[1]},${match[2]}`
  ) {
    return null;
  }
  return worldStationInCell(context, catalog, galaxy, cell);
}

/** Stations whose centres are within `radius` of a point. */
export function worldLegacyStationsNear(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  radius: number,
  point: Vec,
): StationSite[] {
  const grid = worldGrid(context, catalog.station.cellSize);
  const sites: StationSite[] = [];
  for (const cell of worldCellsNear(grid, radius, point)) {
    const site = worldStationInCell(context, catalog, galaxy, cell);
    if (site && stationDistance(context, site, point) <= radius) {
      sites.push(site);
    }
  }
  return sites;
}
