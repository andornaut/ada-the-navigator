import { GALAXY_ID } from "./galaxies.ts";
import type { HOSTILE_STATION_PLACEMENT } from "./hostileStationPlacement.ts";
import type { GalaxyNumber } from "./types.ts";

type HostileStationGalaxy = (typeof HOSTILE_STATION_PLACEMENT.galaxies)[number];

/** Station formations and first-outcome rewards, separate from ambient swarm group sizing. */
export const HOSTILE_STATION_POLICY = {
  defenders: 2,
  rewards: {
    andromeda: 100,
    cartwheel: 150,
    phantom: 200,
  } satisfies Readonly<Record<HostileStationGalaxy, number>>,
} as const;

/** Only the approved named galaxies carry a hostile station reward. */
export function hostileStationReward(galaxy: GalaxyNumber): number | undefined {
  const id = GALAXY_ID[galaxy];
  return Object.hasOwn(HOSTILE_STATION_POLICY.rewards, id)
    ? HOSTILE_STATION_POLICY.rewards[id as HostileStationGalaxy]
    : undefined;
}
