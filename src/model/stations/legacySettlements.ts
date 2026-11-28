import type { EconomyCatalog } from "../../data/economy.ts";
import { LANDMARK_TUNING } from "../../data/jobs.ts";
import { retainedLandmarkSites as landmarkSites } from "../retainedLandmarks.ts";
import type { Vec } from "../types.ts";
import { type WorldCellContext, wrapPoint } from "../world/index.ts";
import {
  stationDistance as distance,
  type StationSite,
  worldLegacyStationById,
  worldLegacyStationsNear,
} from "./primary/index.ts";

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

/** Retained outposts keep their original sites when queried across a flight seam. */
export function retainedSettlementsNear(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  radius: number,
  point: Vec,
): StationSite[] {
  const side = context.worldSide;
  if (side === undefined) {
    return settlementsNear(catalog, radius, point);
  }
  const center = wrapPoint(side, point);
  const images = settlementImages(side, radius);
  const ys = images(center.y);
  const sites = images(center.x).flatMap((x) =>
    ys.flatMap((y) => settlementsNear(catalog, radius, { x, y })),
  );
  return [...new Map(sites.map((site) => [site.id, site])).values()].map((site) => ({
    ...wrapPoint(side, site),
    id: site.id,
  }));
}

export function retainedSettlementWithin(
  context: WorldCellContext,
  catalog: EconomyCatalog,
  radius: number,
  point: Vec,
): boolean {
  const side = context.worldSide;
  if (side === undefined) {
    return settlementsNear(catalog, radius, point).length > 0;
  }
  const center = wrapPoint(side, point);
  const images = settlementImages(side, radius);
  const ys = images(center.y);
  return images(center.x).some((x) =>
    ys.some((y) => settlementsNear(catalog, radius, { x, y }).length > 0),
  );
}

function settlementImages(side: number, radius: number): (coordinate: number) => number[] {
  return (coordinate: number) => {
    if (coordinate - radius < -side / 2) {
      return [coordinate, coordinate + side];
    }
    if (coordinate + radius >= side / 2) {
      return [coordinate, coordinate - side];
    }
    return [coordinate];
  };
}
