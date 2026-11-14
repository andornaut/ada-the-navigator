import { type EncounterEntry, encounterTable } from "./enemyCatalog.ts";
import type { GalaxyNumber } from "./types.ts";

export interface SpawnerStage {
  /** Existing fresh-chunk distance ledger, in world units. */
  freshDistance: number;
  localCap: number;
  maxNearbyArchetypes: number;
  roster: readonly EncounterEntry[];
}

export interface SpawnerPolicy {
  localRadius: number;
  memberSpacing: number;
  maxNearbyCapitals: number;
  stages: readonly SpawnerStage[];
}

const FRESH_DISTANCES = [0, 1800, 4200] as const;

const sunflower: SpawnerPolicy = {
  localRadius: 900,
  maxNearbyCapitals: 1,
  memberSpacing: 120,
  stages: [
    {
      freshDistance: FRESH_DISTANCES[0],
      localCap: 3,
      maxNearbyArchetypes: 1,
      roster: [
        { archetype: "swarm", groupSize: [1, 2], weight: 0.55 },
        { archetype: "fighter", groupSize: [1, 1], weight: 0.45 },
      ],
    },
    {
      freshDistance: FRESH_DISTANCES[1],
      localCap: 4,
      maxNearbyArchetypes: 2,
      roster: [
        { archetype: "swarm", groupSize: [2, 3], weight: 0.45 },
        { archetype: "fighter", groupSize: [1, 2], weight: 0.4 },
        { archetype: "retaliator", groupSize: [1, 1], weight: 0.15 },
      ],
    },
    {
      freshDistance: FRESH_DISTANCES[2],
      localCap: 5,
      maxNearbyArchetypes: 2,
      roster: [
        { archetype: "swarm", groupSize: [2, 3], weight: 0.4 },
        { archetype: "fighter", groupSize: [1, 2], weight: 0.35 },
        { archetype: "retaliator", groupSize: [1, 1], weight: 0.15 },
        { archetype: "interceptor", groupSize: [1, 1], weight: 0.1 },
      ],
    },
  ],
};

function laterStages(
  galaxy: GalaxyNumber,
  maxNearbyArchetypes: number,
  localCaps: readonly [number, number, number],
): readonly SpawnerStage[] {
  const roster = encounterTable(galaxy);
  return FRESH_DISTANCES.map((freshDistance, index) => ({
    freshDistance,
    localCap: localCaps[index]!,
    maxNearbyArchetypes,
    roster,
  }));
}

/** Explicit ambient budgets by galaxy; encounter frequency remains independently configured. */
export const SPAWNER_POLICIES: Readonly<Record<GalaxyNumber, SpawnerPolicy>> = {
  1: sunflower,
  2: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: laterStages(2, 4, [7, 8, 9]),
  },
  3: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 110,
    stages: laterStages(3, 2, [4, 5, 6]),
  },
  4: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 110,
    stages: laterStages(4, 3, [5, 6, 7]),
  },
  5: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: laterStages(5, 4, [6, 7, 8]),
  },
  6: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: laterStages(6, 4, [8, 9, 10]),
  },
};

/** Selects a stage using only the existing fresh exploration ledger. */
export function spawnerStage(galaxy: GalaxyNumber, freshDistance: number): SpawnerStage {
  const stages = SPAWNER_POLICIES[galaxy].stages;
  return stages.findLast((stage) => freshDistance >= stage.freshDistance) ?? stages[0]!;
}
