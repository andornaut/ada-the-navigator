import type { EconomyCatalog } from "../data/economy.ts";
import { settlementsNear } from "./legacySettlements.ts";
import { type StationSite, stationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";
export { settlementById, settlementsNear } from "./legacySettlements.ts";
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(
  catalog: EconomyCatalog,
  sites: (radius: number, point: Vec) => readonly StationSite[],
  point: Vec,
): StationSite {
  if (catalog.station.cellSize <= 0 || catalog.station.chance <= 0) {
    throw new RangeError("The habitat catalog must generate places");
  }
  for (let radius = catalog.station.cellSize; ; radius += catalog.station.cellSize) {
    const found = [...sites(radius, point)].sort(
      (a, b) => distance(a, point) - distance(b, point) || a.id.localeCompare(b.id),
    )[0];
    if (found) {
      return found;
    }
  }
}

/** The actual closest settlers' station, never a duplicate story-station alias. */
export function nearestSettlerStation(catalog: EconomyCatalog, point: Vec): StationSite {
  return nearest(catalog, (radius, from) => stationsNear(catalog, 5, radius, from), point);
}

/** The closest separate settlement outpost, measured from the accepted trip's station. */
export function nearestSettlement(catalog: EconomyCatalog, point: Vec): StationSite {
  return nearest(catalog, (radius, from) => settlementsNear(catalog, radius, from), point);
}
