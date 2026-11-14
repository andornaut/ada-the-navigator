import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import {
  LANDMARK_KINDS,
  LANDMARK_NAME_FORMAT,
  LANDMARK_TUNING,
  landmarkNameKey,
} from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { flightDestinationSites } from "./destinationContext.ts";
import { dropRandom } from "./drops.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { settlementsNear } from "./legacySettlements.ts";
import { worldOreFieldsNear } from "./oreFields.ts";
import { LANDMARK_SEEDS, type LandmarkSite, retainedLandmarkSites } from "./retainedLandmarks.ts";
import { identityWords } from "./stationIdentity.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, GalaxyProgress, Vec } from "./types.ts";
import { worldDistance } from "./worldContacts.ts";
export type { LandmarkSite } from "./retainedLandmarks.ts";

const sites = new Map<GalaxyNumber, readonly LandmarkSite[]>();

export function landmarkSites(galaxy: GalaxyNumber): readonly LandmarkSite[] {
  const cached = sites.get(galaxy);
  if (cached) {
    return cached;
  }
  const retained = retainedLandmarkSites(galaxy);
  const seed = LANDMARK_SEEDS[galaxy];
  if (seed === undefined) {
    return retained;
  }
  const placed = [...retained];
  const { attempts, count, placeClearance, radius, spacing } = LANDMARK_TUNING;
  const kinds = Array.from(
    { length: Math.max(0, count - placed.length) },
    (_, index) => LANDMARK_KINDS[index % LANDMARK_KINDS.length]!,
  );
  const kindRoll = dropRandom(seed, `expanded-landmark-kinds:${galaxy}`);
  for (let index = kinds.length - 1; index > 0; index--) {
    const swap = Math.floor(kindRoll() * (index + 1));
    [kinds[index], kinds[swap]] = [kinds[swap]!, kinds[index]!];
  }
  const next = dropRandom(seed, `expanded-landmarks:${galaxy}`);
  for (let attempt = 0; placed.length < count && attempt < attempts; attempt++) {
    const reach = Math.sqrt(next()) * radius;
    const angle = next() * Math.PI * 2;
    const at = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
    if (placed.some((site) => Math.hypot(site.x - at.x, site.y - at.y) < spacing)) {
      continue;
    }
    if (stationsNear(ECONOMY, galaxy, placeClearance, at).length > 0) {
      continue;
    }
    if (galaxy === 5 && settlementsNear(ECONOMY, placeClearance, at).length > 0) {
      continue;
    }
    if (worldOreFieldsNear({}, galaxy, ORE_FIELDS.diameter / 2 + placeClearance, at).length > 0) {
      continue;
    }
    const index = placed.length;
    const kind = kinds[index - retained.length]!;
    placed.push({
      ...at,
      id: `landmark:${galaxy}:${index}`,
      kind,
      name: landmarkNameKey(galaxy, kind, (index % 4) + 1),
      nameWords: identityWords(BigInt(6 * index + galaxy - 1)),
    });
  }
  sites.set(galaxy, placed);
  return placed;
}

/** Legacy landmarks remain available; only additions yield to retained story destinations. */
export function flightLandmarkSites(flight: FlightState): readonly LandmarkSite[] {
  const context = flightWorldContext(flight);
  const destinations = flightDestinationSites(flight);
  const retained = new Set(retainedLandmarkSites(flight.galaxy).map(({ id }) => id));
  return landmarkSites(flight.galaxy).filter(
    (site) =>
      retained.has(site.id) ||
      destinations.every(
        (destination) =>
          worldDistance(context, destination, site) >= LANDMARK_TUNING.placeClearance,
      ),
  );
}

/** Existing label keys stay unchanged; new sites add their approved identity words. */
export function landmarkLabel(label: (key: string) => string, site: LandmarkSite): string {
  const base = label(site.name);
  return site.nameWords === undefined
    ? base
    : LANDMARK_NAME_FORMAT.replace("{baseName}", base).replace("{landmarkWords}", site.nameWords);
}

/** A landmark by id in its galaxy, or undefined. */
export function landmarkById(galaxy: GalaxyNumber, id: string): LandmarkSite | undefined {
  return landmarkSites(galaxy).find((site) => site.id === id);
}

/** The galaxy's landmarks with whether each is charted: the pause map's landmark slot. */
export function galaxyLandmarks(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
): readonly (LandmarkSite & { readonly charted: boolean })[] {
  return landmarkSites(galaxy).map((site) => ({
    ...site,
    charted: progress.charted.includes(site.id),
  }));
}

interface IndexedLandmark {
  readonly order: number;
  readonly site: LandmarkSite;
}
const NEARBY_INDEXES = new WeakMap<readonly LandmarkSite[], readonly IndexedLandmark[]>();

/** Uncharted landmarks within range of a point, in canonical catalog order. */
export function unchartedNear(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
  range: number,
  point: Vec,
): LandmarkSite[] {
  const catalog = landmarkSites(galaxy);
  if (![range, point.x, point.y].every(Number.isFinite)) {
    return catalog.filter(
      (site) =>
        !progress.charted.includes(site.id) &&
        Math.hypot(site.x - point.x, site.y - point.y) <= range,
    );
  }
  let index = NEARBY_INDEXES.get(catalog);
  if (!index) {
    index = catalog
      .map((site, order) => ({ order, site }))
      .sort((a, b) => a.site.x - b.site.x || a.order - b.order);
    NEARBY_INDEXES.set(catalog, index);
  }
  // The broad phase includes subtraction rounding; the exact distance test keeps its boundary.
  const padding = 2 * Number.EPSILON * (Math.abs(point.x) + Math.abs(range));
  const minimum = point.x - range - padding;
  const maximum = point.x + range + padding;
  let low = 0;
  let high = index.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (index[middle]!.site.x < minimum) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const nearby: IndexedLandmark[] = [];
  for (let cursor = low; cursor < index.length && index[cursor]!.site.x <= maximum; cursor++) {
    const entry = index[cursor]!;
    const { site } = entry;
    if (
      !progress.charted.includes(site.id) &&
      Math.hypot(site.x - point.x, site.y - point.y) <= range
    ) {
      nearby.push(entry);
    }
  }
  return nearby.sort((a, b) => a.order - b.order).map(({ site }) => site);
}

/** Charts every uncharted landmark within charting range of Ada; returns the newly charted. */
export function chartLandmarks(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
  player: Vec,
): string[] {
  const charted = unchartedNear(galaxy, progress, LANDMARK_TUNING.chart, player).map(
    (site) => site.id,
  );
  progress.charted.push(...charted);
  return charted;
}

/** Whether a saved id names one of the galaxy's landmarks. */
export function isLandmark(galaxy: GalaxyNumber, id: string): boolean {
  return landmarkSites(galaxy).some((site) => site.id === id);
}
