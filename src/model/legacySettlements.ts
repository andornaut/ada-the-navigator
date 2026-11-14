import type { EconomyCatalog } from "../data/economy.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { landmarkSites } from "./landmarks.ts";
import {
  stationDistance as distance,
  type StationSite,
  worldLegacyStationById,
  worldLegacyStationsNear,
} from "./legacyStations.ts";
import type { Vec } from "./types.ts";
import type { WorldCellContext } from "./worldCells.ts";
import { wrapPoint } from "./worldGeometry.ts";

/** Settlements use the seeded habitat grid, shifted half a cell and clear of real stations. */
export function worldSettlementById(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  id: string,
): StationSite | null {
  if (!id.startsWith("settlement:")) {
    return null;
  }
  const source = worldLegacyStationById(
    context,
    catalog,
    5,
    id.replace(/^settlement:/u, "station:"),
  );
  if (!source) {
    return null;
  }
  const shift = catalog.station.cellSize / 2;
  const raw = { x: source.x + shift, y: source.y + shift };
  const point = context.worldSide === undefined ? raw : wrapPoint(context.worldSide, raw);
  if (
    distance(context, { x: 0, y: 0 }, point) < catalog.station.originClearance ||
    worldLegacyStationsNear(context, catalog, 5, catalog.station.destinationClearance, point)
      .length > 0 ||
    landmarkSites(5).some((site) => distance(context, site, point) < LANDMARK_TUNING.placeClearance)
  ) {
    return null;
  }
  return { ...point, id };
}

/** Outposts near a point, with ids and coordinates that rebind across flights and Continue. */
export function worldSettlementsNear(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  radius: number,
  point: Vec,
): StationSite[] {
  const shift = catalog.station.cellSize / 2;
  return worldLegacyStationsNear(context, catalog, 5, radius, {
    x: point.x - shift,
    y: point.y - shift,
  })
    .map((site) =>
      worldSettlementById(context, catalog, site.id.replace(/^station:/u, "settlement:")),
    )
    .filter(
      (site): site is StationSite => site !== null && distance(context, site, point) <= radius,
    );
}

export function settlementById(catalog: EconomyCatalog, id: string): StationSite | null {
  return worldSettlementById({}, catalog, id);
}
export function settlementsNear(
  catalog: EconomyCatalog,
  radius: number,
  point: Vec,
): StationSite[] {
  return worldSettlementsNear({}, catalog, radius, point);
}
