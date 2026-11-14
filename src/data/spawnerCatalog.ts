import { type EncounterEntry, encounterTable } from "./enemyCatalog.ts";
import type { GalaxyNumber } from "./types.ts";

export interface SpawnerStage {
  /** Galactic-center distance at which this discrete region begins, in world units. */
  centerDistance: number;
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

export const SPAWNER_REGIONS = {
  centerDistances: [0, 10000, 25000],
  transitionWidth: 2000,
} as const;
/** Ambient fighter groups target this size, then fit the available local budget. */
export const FIGHTER_GROUP_TARGET = 4;
const fighterGroup = [FIGHTER_GROUP_TARGET, FIGHTER_GROUP_TARGET] as const;

const sunflower: SpawnerPolicy = {
  localRadius: 900,
  maxNearbyCapitals: 1,
  memberSpacing: 120,
  stages: [
    {
      centerDistance: SPAWNER_REGIONS.centerDistances[0],
      localCap: 3,
      maxNearbyArchetypes: 1,
      roster: [
        { archetype: "swarm", groupSize: [1, 2], weight: 0.55 },
        { archetype: "fighter", groupSize: fighterGroup, weight: 0.45 },
      ],
    },
    {
      centerDistance: SPAWNER_REGIONS.centerDistances[1],
      localCap: 4,
      maxNearbyArchetypes: 2,
      roster: [
        { archetype: "swarm", groupSize: [2, 3], weight: 0.45 },
        { archetype: "fighter", groupSize: fighterGroup, weight: 0.4 },
        { archetype: "retaliator", groupSize: [1, 1], weight: 0.15 },
      ],
    },
    {
      centerDistance: SPAWNER_REGIONS.centerDistances[2],
      localCap: 5,
      maxNearbyArchetypes: 2,
      roster: [
        { archetype: "swarm", groupSize: [2, 3], weight: 0.4 },
        { archetype: "fighter", groupSize: fighterGroup, weight: 0.35 },
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
  const roster = encounterTable(galaxy).map((entry) =>
    entry.archetype === "fighter" ? { ...entry, groupSize: fighterGroup } : entry,
  );
  return SPAWNER_REGIONS.centerDistances.map((centerDistance, index) => ({
    centerDistance,
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
    stages: laterStages(2, 4, [5, 6, 7]),
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
    stages: laterStages(4, 3, [4, 5, 6]),
  },
  5: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: laterStages(5, 4, [5, 6, 7]),
  },
  6: {
    localRadius: 900,
    maxNearbyCapitals: 1,
    memberSpacing: 100,
    stages: laterStages(6, 4, [6, 7, 8]),
  },
};

/** Discrete numeric budgets with composition weights blended across centered transition bands. */
export function spawnerStageAtDistance(policy: SpawnerPolicy, distance: number): SpawnerStage {
  const active =
    policy.stages.findLast((stage) => distance >= stage.centerDistance) ?? policy.stages[0]!;
  const half = SPAWNER_REGIONS.transitionWidth / 2;
  for (let index = 1; index < policy.stages.length; index++) {
    const upper = policy.stages[index]!;
    const lower = policy.stages[index - 1]!;
    const start = upper.centerDistance - half;
    if (distance <= start || distance >= upper.centerDistance + half) {
      continue;
    }
    const mix = (distance - start) / SPAWNER_REGIONS.transitionWidth;
    const types = new Set([...lower.roster, ...upper.roster].map(({ archetype }) => archetype));
    const roster = [...types].flatMap((archetype) => {
      const from = lower.roster.find((entry) => entry.archetype === archetype);
      const to = upper.roster.find((entry) => entry.archetype === archetype);
      const weight = (from?.weight ?? 0) * (1 - mix) + (to?.weight ?? 0) * mix;
      const entry = active.roster.find((entry) => entry.archetype === archetype) ?? from ?? to!;
      return weight > 0 ? [{ ...entry, weight }] : [];
    });
    return { ...active, roster };
  }
  return active;
}

/** The numeric argument is center distance, independent of fresh exploration or lifetime state. */
export function spawnerStage(galaxy: GalaxyNumber, centerDistance: number): SpawnerStage {
  return spawnerStageAtDistance(SPAWNER_POLICIES[galaxy], centerDistance);
}
