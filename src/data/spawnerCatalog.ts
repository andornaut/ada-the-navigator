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

const sunflower: SpawnerPolicy = {
  localRadius: 900,
  maxNearbyCapitals: 1,
  memberSpacing: 120,
  stages: [
    {
      freshDistance: 0,
      localCap: 3,
      maxNearbyArchetypes: 1,
      roster: [
        { archetype: "swarm", groupSize: [1, 2], weight: 0.55 },
        { archetype: "fighter", groupSize: [1, 1], weight: 0.45 },
      ],
    },
    {
      freshDistance: 1800,
      localCap: 4,
      maxNearbyArchetypes: 2,
      roster: [
        { archetype: "swarm", groupSize: [2, 3], weight: 0.45 },
        { archetype: "fighter", groupSize: [1, 2], weight: 0.4 },
        { archetype: "retaliator", groupSize: [1, 1], weight: 0.15 },
      ],
    },
    {
      freshDistance: 4200,
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

/** Explicit ambient budgets by galaxy; encounter frequency remains independently configured. */
export const SPAWNER_POLICIES: Readonly<Record<GalaxyNumber, SpawnerPolicy>> = {
  1: sunflower,
  2: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: [{ freshDistance: 0, localCap: 9, maxNearbyArchetypes: 4, roster: encounterTable(2) }],
  },
  3: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 110,
    stages: [{ freshDistance: 0, localCap: 6, maxNearbyArchetypes: 2, roster: encounterTable(3) }],
  },
  4: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 110,
    stages: [{ freshDistance: 0, localCap: 7, maxNearbyArchetypes: 3, roster: encounterTable(4) }],
  },
  5: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: [{ freshDistance: 0, localCap: 8, maxNearbyArchetypes: 4, roster: encounterTable(5) }],
  },
  6: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: [{ freshDistance: 0, localCap: 10, maxNearbyArchetypes: 4, roster: encounterTable(6) }],
  },
};

/** Selects a stage using only the existing fresh exploration ledger. */
export function spawnerStage(galaxy: GalaxyNumber, freshDistance: number): SpawnerStage {
  const stages = SPAWNER_POLICIES[galaxy].stages;
  return stages.findLast((stage) => freshDistance >= stage.freshDistance) ?? stages[0]!;
}
