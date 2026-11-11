import { ECONOMY } from "../data/economy.ts";
import {
  LANDMARK_KINDS,
  LANDMARK_TUNING,
  type LandmarkKind,
  landmarkNameKey,
} from "../data/jobs.ts";
import type { SectorId } from "../data/types.ts";
import { dropRandom } from "./drops.ts";
import { stationsNear } from "./stations.ts";
import type { SectorProgress, Vec } from "./types.ts";

// Each galaxy's landmarks (gameplay/quests.md "Landmarks"): nebulae, wrecks and beacons placed by
// the galaxy's seed, so they stay in the same places on every flight like stations. Flying close
// charts one; charted landmarks are saved with the galaxy's progress. The pause map reads them
// through galaxyLandmarks.

export interface LandmarkSite extends Vec {
  readonly id: string;
  readonly kind: LandmarkKind;
  /** The player-string key of its name (landmarkNameKey). */
  readonly name: string;
}

/** Fixed per-galaxy seeds, so every flight places the same landmarks. */
const LANDMARK_SEEDS: Readonly<Record<SectorId, number>> = {
  1: 0x1a4d_0101,
  2: 0x1a4d_0202,
  3: 0x1a4d_0303,
};

const sites = new Map<SectorId, readonly LandmarkSite[]>();

/**
 * The galaxy's seeded kinds, a third of each in an order its seed shuffles. Their own stream keeps
 * the placement's positions unchanged.
 */
function seededKinds(sector: SectorId): LandmarkKind[] {
  const next = dropRandom(LANDMARK_SEEDS[sector], `landmark-kinds:${sector}`);
  const per = LANDMARK_TUNING.count / LANDMARK_KINDS.length;
  const kinds = LANDMARK_KINDS.flatMap((kind) => Array.from({ length: per }, () => kind));
  for (let index = kinds.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1));
    [kinds[index], kinds[swap]] = [kinds[swap]!, kinds[index]!];
  }
  return kinds;
}

/**
 * The galaxy's landmarks in id order: within LANDMARK_TUNING.radius of the world origin, spacing
 * apart and placeClearance from its stations. The seed assigns the kinds, and each kind's names
 * follow quests.md's table order in id order, so a landmark keeps its name on every flight.
 */
export function landmarkSites(sector: SectorId): readonly LandmarkSite[] {
  const cached = sites.get(sector);
  if (cached) {
    return cached;
  }
  const { count, placeClearance, radius, spacing } = LANDMARK_TUNING;
  const next = dropRandom(LANDMARK_SEEDS[sector], `landmarks:${sector}`);
  const kinds = seededKinds(sector);
  const named = { beacon: 0, nebula: 0, wreck: 0 };
  const placed: LandmarkSite[] = [];
  for (let attempt = 0; placed.length < count && attempt < 10000; attempt++) {
    // Uniform over the disc's area.
    const reach = Math.sqrt(next()) * radius;
    const angle = next() * Math.PI * 2;
    const at = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
    if (
      placed.some((site) => Math.hypot(site.x - at.x, site.y - at.y) < spacing) ||
      stationsNear(ECONOMY, sector, placeClearance, at).length > 0
    ) {
      continue;
    }
    const index = placed.length;
    const kind = kinds[index]!;
    placed.push({
      ...at,
      id: `landmark:${sector}:${index}`,
      kind,
      name: landmarkNameKey(sector, kind, ++named[kind]),
    });
  }
  sites.set(sector, placed);
  return placed;
}

/** A landmark by id in its galaxy, or undefined. */
export function landmarkById(sector: SectorId, id: string): LandmarkSite | undefined {
  return landmarkSites(sector).find((site) => site.id === id);
}

/** The galaxy's landmarks with whether each is charted: the pause map's landmark slot. */
export function galaxyLandmarks(
  sector: SectorId,
  progress: Pick<SectorProgress, "charted">,
): readonly (LandmarkSite & { readonly charted: boolean })[] {
  return landmarkSites(sector).map((site) => ({
    ...site,
    charted: progress.charted.includes(site.id),
  }));
}

/** Uncharted landmarks within range of a point. */
export function unchartedNear(
  sector: SectorId,
  progress: Pick<SectorProgress, "charted">,
  range: number,
  point: Vec,
): LandmarkSite[] {
  return landmarkSites(sector).filter(
    (site) =>
      !progress.charted.includes(site.id) &&
      Math.hypot(site.x - point.x, site.y - point.y) <= range,
  );
}

/** Charts every uncharted landmark within charting range of Ada; returns the newly charted. */
export function chartLandmarks(
  sector: SectorId,
  progress: Pick<SectorProgress, "charted">,
  player: Vec,
): string[] {
  const charted = unchartedNear(sector, progress, LANDMARK_TUNING.chart, player).map(
    (site) => site.id,
  );
  progress.charted.push(...charted);
  return charted;
}

/** Whether a saved id names one of the galaxy's landmarks. */
export function isLandmark(sector: SectorId, id: string): boolean {
  return landmarkSites(sector).some((site) => site.id === id);
}
