import type { EconomyCatalog } from "../data/economy.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { worldSettlementsNear } from "./legacySettlements.ts";
import {
  GALAXY_SEEDS,
  HUB_STATION,
  mix,
  stationDistance as distance,
  type StationSite,
  unit,
  worldLegacyStationById,
  worldLegacyStationsNear,
  worldStationInCell,
} from "./legacyStations.ts";
import { retainedLandmarkSites as landmarkSites } from "./retainedLandmarks.ts";
import type { FlightState, Vec } from "./types.ts";
import {
  worldCell,
  type WorldCellContext,
  worldCellKey,
  worldCellOrigin,
  worldCellsNear,
  worldGrid,
} from "./worldCells.ts";
import { wrapPoint } from "./worldGeometry.ts";
export {
  HUB_STATION,
  stationId,
  type StationSite,
  worldLegacyStationById,
  worldLegacyStationsNear,
  worldStationInCell,
} from "./legacyStations.ts";

export interface StationPlacementContext extends WorldCellContext {
  readonly stationExclusions?: readonly Vec[];
}

/** Retained destinations exclude only new sites, without changing their seeded coordinates. */
export function flightStationContext(flight: FlightState): StationPlacementContext {
  return {
    ...flightWorldContext(flight),
    stationExclusions: [
      ...flight.objects.filter((object) => object.kind === "destination"),
      ...Object.values(flight.world.notables).filter(
        (object): object is NonNullable<typeof object> => object?.kind === "destination",
      ),
    ],
  };
}

export function worldNamesStation(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): boolean {
  return (
    (galaxy === 2 && id === HUB_STATION) || worldStationById(context, catalog, galaxy, id) !== null
  );
}

/** An additional station near a grid vertex; original cell sites never move. */
export function worldInfillStationInCell(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  rawCell: Vec,
): StationSite | null {
  const grid = worldGrid(context, catalog.station.cellSize);
  const cell = worldCell(grid, rawCell);
  const seed = GALAXY_SEEDS[galaxy];
  if (seed === undefined || unit(mix(seed, cell.x, cell.y)) >= catalog.station.chance) {
    return null;
  }
  const origin = worldCellOrigin(grid, cell);
  const extent = Math.min(
    catalog.station.jitter / 2,
    (grid.pitch - catalog.station.minimumSpacing) / 2,
  );
  if (extent < 0) {
    return null;
  }
  const offsets = [0, -extent / 2, extent / 2, -extent, extent];
  for (const x of offsets) {
    for (const y of offsets) {
      const raw = { x: origin.x + x, y: origin.y + y };
      const point = context.worldSide === undefined ? raw : wrapPoint(context.worldSide, raw);
      if (distance(context, { x: 0, y: 0 }, point) < catalog.station.originClearance) {
        continue;
      }
      if (
        worldLegacyStationsNear(
          context,
          catalog,
          galaxy,
          catalog.station.minimumSpacing,
          point,
        ).some((site) => distance(context, site, point) < catalog.station.minimumSpacing)
      ) {
        continue;
      }
      if (
        landmarkSites(galaxy).some(
          (site) => distance(context, site, point) <= LANDMARK_TUNING.placeClearance,
        )
      ) {
        continue;
      }
      if (
        galaxy === 5 &&
        worldSettlementsNear(context, catalog, catalog.station.destinationClearance, point).length >
          0
      ) {
        continue;
      }
      if (
        context.stationExclusions?.some(
          (destination) =>
            distance(context, destination, point) < catalog.station.destinationClearance,
        )
      ) {
        return null;
      }
      return { ...point, id: `station:infill:${cell.x},${cell.y}` };
    }
  }
  return null;
}

/** Both placement layers share canonical lookup and reject aliases. */
export function worldStationById(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationSite | null {
  if (!id.startsWith("station:infill:")) {
    return worldLegacyStationById(context, catalog, galaxy, id);
  }
  const match = /^station:infill:(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.exec(id);
  if (!match || match[1] === "-0" || match[2] === "-0") {
    return null;
  }
  const cell = { x: Number(match[1]), y: Number(match[2]) };
  if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) {
    return null;
  }
  const grid = worldGrid(context, catalog.station.cellSize);
  if (worldCellKey(grid, cell) !== `${match[1]},${match[2]}`) {
    return null;
  }
  return worldInfillStationInCell(context, catalog, galaxy, cell);
}

/** Bounded local queries include vertex sites just outside the legacy cell envelope. */
export function worldStationsNear(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  radius: number,
  point: Vec,
): StationSite[] {
  const sites = worldLegacyStationsNear(context, catalog, galaxy, radius, point);
  const grid = worldGrid(context, catalog.station.cellSize);
  const extent = Math.min(
    catalog.station.jitter / 2,
    (grid.pitch - catalog.station.minimumSpacing) / 2,
  );
  // Every candidate lies within this disc of its cell origin, including wrapped cells.
  const candidateReach = radius + Math.SQRT2 * Math.max(0, extent);
  for (const cell of worldCellsNear(grid, radius + grid.pitch, point)) {
    if (distance(context, worldCellOrigin(grid, cell), point) > candidateReach) {
      continue;
    }
    const site = worldInfillStationInCell(context, catalog, galaxy, cell);
    if (site && distance(context, site, point) <= radius) {
      sites.push(site);
    }
  }
  return sites;
}

/**
 * The nearest undiscovered station within the catalog's indicator range of a point, which
 * the direction indicator marks; null when there is none.
 */
export function worldStationIndicatorTarget(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  discovered: readonly string[],
  point: Vec,
): StationSite | null {
  let nearest: StationSite | null = null;
  for (const site of worldStationsNear(
    context,
    catalog,
    galaxy,
    catalog.station.indicatorRange,
    point,
  )) {
    if (
      !discovered.includes(site.id) &&
      (!nearest || distance(context, site, point) < distance(context, nearest, point))
    ) {
      nearest = site;
    }
  }
  return nearest;
}

// Legacy entry points preserve the existing unbounded topology until callers explicitly opt in.
export function stationInCell(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  cell: Vec,
): StationSite | null {
  return worldStationInCell({}, catalog, galaxy, cell);
}
export function namesStation(catalog: EconomyCatalog, galaxy: GalaxyNumber, id: string): boolean {
  return worldNamesStation({}, catalog, galaxy, id);
}
export function stationById(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationSite | null {
  return worldStationById({}, catalog, galaxy, id);
}
export function stationsNear(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  radius: number,
  point: Vec,
): StationSite[] {
  return worldStationsNear({}, catalog, galaxy, radius, point);
}
export function stationIndicatorTarget(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  discovered: readonly string[],
  point: Vec,
): StationSite | null {
  return worldStationIndicatorTarget({}, catalog, galaxy, discovered, point);
}
