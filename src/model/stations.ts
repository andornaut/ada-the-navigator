import type { EconomyCatalog } from "../data/economy.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "./types.ts";

export interface StationSite extends Vec {
  id: string;
}

/** Fixed per-sector seeds, so station sites are the same on every flight. */
const SECTOR_SEEDS: Readonly<Record<SectorId, number>> = {
  1: 0x5eed_0101,
  2: 0x5eed_0202,
  3: 0x5eed_0303,
};

function mix(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n ^ (n >>> 13)) >>> 0;
}
const unit = (value: number) => value / 4294967296;

export function stationId(cell: Vec): string {
  return `station:${cell.x},${cell.y}`;
}

/**
 * The station in one placement cell, or null. A station sits inside the cell's central
 * band of side `jitter`, so stations in different cells are at least
 * `cellSize - jitter` apart.
 */
export function stationInCell(
  catalog: EconomyCatalog,
  sector: SectorId,
  cell: Vec,
): StationSite | null {
  const { cellSize, chance, jitter, originClearance } = catalog.station;
  const seed = SECTOR_SEEDS[sector];
  if (unit(mix(seed, cell.x, cell.y)) >= chance) {
    return null;
  }
  const margin = (cellSize - jitter) / 2;
  const x = cell.x * cellSize + margin + unit(mix(seed ^ 0x9e37, cell.x, cell.y)) * jitter;
  const y = cell.y * cellSize + margin + unit(mix(seed ^ 0x79b9, cell.x, cell.y)) * jitter;
  if (Math.hypot(x, y) < originClearance) {
    return null;
  }
  return { id: stationId(cell), x, y };
}

export function stationById(
  catalog: EconomyCatalog,
  sector: SectorId,
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
  return stationInCell(catalog, sector, cell);
}

/** Stations whose centres are within `radius` of a point. */
export function stationsNear(
  catalog: EconomyCatalog,
  sector: SectorId,
  radius: number,
  point: Vec,
): StationSite[] {
  const size = catalog.station.cellSize;
  const sites: StationSite[] = [];
  for (
    let x = Math.floor((point.x - radius) / size);
    x <= Math.floor((point.x + radius) / size);
    x++
  ) {
    for (
      let y = Math.floor((point.y - radius) / size);
      y <= Math.floor((point.y + radius) / size);
      y++
    ) {
      const site = stationInCell(catalog, sector, { x, y });
      if (site && Math.hypot(site.x - point.x, site.y - point.y) <= radius) {
        sites.push(site);
      }
    }
  }
  return sites;
}
