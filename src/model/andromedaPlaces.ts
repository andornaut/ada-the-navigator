import type { EconomyCatalog } from "../data/economy.ts";
import { settlementsNear } from "./legacySettlements.ts";
import { type StationPlacementContext, type StationSite, worldStationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";
import { worldDistance } from "./world/index.ts";
export { settlementById, settlementsNear } from "./legacySettlements.ts";

function nearest(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  sites: (radius: number, point: Vec) => readonly StationSite[],
  point: Vec,
): StationSite {
  if (catalog.station.cellSize <= 0 || catalog.station.chance <= 0) {
    throw new RangeError("The habitat catalog must generate places");
  }
  for (let radius = catalog.station.cellSize; ; radius += catalog.station.cellSize) {
    const found = [...sites(radius, point)].sort(
      (a, b) =>
        worldDistance(context, a, point) - worldDistance(context, b, point) ||
        a.id.localeCompare(b.id),
    )[0];
    if (found) {
      return found;
    }
  }
}

/** The actual closest settlers' station, never a duplicate story-station alias. */
export function nearestSettlerStation(catalog: EconomyCatalog, point: Vec): StationSite {
  return worldNearestSettlerStation({}, catalog, point);
}

export function worldNearestSettlerStation(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  point: Vec,
): StationSite {
  return nearest(
    context,
    catalog,
    (radius, from) => worldStationsNear(context, catalog, 5, radius, from),
    point,
  );
}

/** The closest separate settlement outpost, measured from the accepted trip's station. */
export function nearestSettlement(catalog: EconomyCatalog, point: Vec): StationSite {
  return nearest({}, catalog, (radius, from) => settlementsNear(catalog, radius, from), point);
}
