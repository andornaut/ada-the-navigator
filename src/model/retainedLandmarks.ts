import { ECONOMY } from "../data/economy.ts";
import {
  LANDMARK_KINDS,
  LANDMARK_TUNING,
  type LandmarkGalaxy,
  type LandmarkKind,
  landmarkNameKey,
} from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { dropRandom } from "./drops.ts";
import { worldLegacyStationsNear } from "./legacyStations.ts";
import type { Vec } from "./types.ts";

// Each galaxy's landmarks (gameplay/quests.md "Landmarks"): nebulae, wrecks and beacons placed by
// the galaxy's seed, so they stay in the same places on every flight like stations. Flying close
// charts one; charted landmarks are saved with the galaxy's progress. The pause map reads them
// through galaxyLandmarks.

export interface LandmarkSite extends Vec {
  readonly nameWords?: string;
  readonly id: string;
  readonly kind: LandmarkKind;
  /** The player-string key of its name (landmarkNameKey). */
  readonly name: string;
}

/**
 * Fixed per-galaxy seeds, so every flight places the same landmarks. A placeholder galaxy has
 * none, so no landmarks.
 */
export const LANDMARK_SEEDS: Readonly<Partial<Record<LandmarkGalaxy & GalaxyNumber, number>>> = {
  1: 0x1a4d_0101,
  2: 0x1a4d_0202,
  3: 0x1a4d_0303,
  4: 0x1a4d_0404,
  5: 0x1a4d_0505,
  6: 0x1a4d_0606,
};

const sites = new Map<GalaxyNumber, readonly LandmarkSite[]>();

/**
 * The galaxy's seeded kinds, a third of each in an order its seed shuffles. Their own stream keeps
 * the placement's positions unchanged.
 */
function seededKinds(galaxy: LandmarkGalaxy & GalaxyNumber, seed: number): LandmarkKind[] {
  const next = dropRandom(seed, `landmark-kinds:${galaxy}`);
  const per = LANDMARK_TUNING.retained.count / LANDMARK_KINDS.length;
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
export function retainedLandmarkSites(galaxy: GalaxyNumber): readonly LandmarkSite[] {
  const cached = sites.get(galaxy);
  if (cached) {
    return cached;
  }
  const seed = LANDMARK_SEEDS[galaxy as LandmarkGalaxy & GalaxyNumber];
  if (seed === undefined) {
    sites.set(galaxy, []);
    return [];
  }
  const landmarkGalaxy = galaxy as LandmarkGalaxy & GalaxyNumber;
  const { placeClearance, spacing } = LANDMARK_TUNING;
  const { count, radius } = LANDMARK_TUNING.retained;
  const next = dropRandom(seed, `landmarks:${galaxy}`);
  const kinds = seededKinds(landmarkGalaxy, seed);
  const named = { beacon: 0, nebula: 0, wreck: 0 };
  const placed: LandmarkSite[] = [];
  for (let attempt = 0; placed.length < count && attempt < 10000; attempt++) {
    // Uniform over the disc's area.
    const reach = Math.sqrt(next()) * radius;
    const angle = next() * Math.PI * 2;
    const at = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
    if (
      placed.some((site) => Math.hypot(site.x - at.x, site.y - at.y) < spacing) ||
      worldLegacyStationsNear({}, ECONOMY, galaxy, placeClearance, at).length > 0
    ) {
      continue;
    }
    const index = placed.length;
    const kind = kinds[index]!;
    placed.push({
      ...at,
      id: `landmark:${galaxy}:${index}`,
      kind,
      name: landmarkNameKey(landmarkGalaxy, kind, ++named[kind]),
    });
  }
  sites.set(galaxy, placed);
  return placed;
}
