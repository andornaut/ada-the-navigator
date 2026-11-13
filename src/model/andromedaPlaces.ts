import type { EconomyCatalog } from "../data/economy.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { landmarkSites } from "./landmarks.ts";
import { stationById, type StationSite, stationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Settlements use the seeded habitat grid, shifted half a cell and clear of real stations. */
export function settlementById(catalog: EconomyCatalog, id: string): StationSite | null {
  if (!id.startsWith("settlement:")) {
    return null;
  }
  const source = stationById(catalog, 5, id.replace(/^settlement:/u, "station:"));
  if (!source) {
    return null;
  }
  const shift = catalog.station.cellSize / 2;
  const point = { x: source.x + shift, y: source.y + shift };
  if (
    Math.hypot(point.x, point.y) < catalog.station.originClearance ||
    stationsNear(catalog, 5, catalog.station.destinationClearance, point).length > 0 ||
    landmarkSites(5).some((site) => distance(site, point) < LANDMARK_TUNING.placeClearance)
  ) {
    return null;
  }
  return { ...point, id };
}

/** Outposts near a point, with ids and coordinates that rebind across flights and Continue. */
export function settlementsNear(
  catalog: EconomyCatalog,
  radius: number,
  point: Vec,
): StationSite[] {
  const shift = catalog.station.cellSize / 2;
  return stationsNear(catalog, 5, radius, { x: point.x - shift, y: point.y - shift })
    .map((site) => settlementById(catalog, site.id.replace(/^station:/u, "settlement:")))
    .filter((site): site is StationSite => site !== null && distance(site, point) <= radius);
}

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
