import { GALAXY_ID } from "./galaxies.ts";
import type { GalaxyNumber } from "./types.ts";

/** Approved hostile geographic sites; combat admission remains a separate caller policy. */
export const HOSTILE_STATION_PLACEMENT = {
  densityArea: 625_000_000,
  galaxies: ["andromeda", "cartwheel", "phantom"],
  maximumCenterDistance: 100_000,
  minimumCenterDistance: 10_000,
} as const;

/** Whether the galaxy admits geographic hostile-station sites. */
export function hasHostileStationSites(galaxy: GalaxyNumber): boolean {
  return HOSTILE_STATION_PLACEMENT.galaxies.some((id) => id === GALAXY_ID[galaxy]);
}
