import { GALAXY_ID, ROUTE, ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";

/** Initial galaxies and the route through one position beyond the farthest actual unlock. */
export function galaxyDownloadGroups(unlocked: readonly GalaxyNumber[]): readonly string[] {
  const positions = unlocked.map((galaxy) => ROUTE_POSITION[galaxy] + 1);
  const count = Math.max(2, ...positions);
  return ROUTE.slice(0, count).map((galaxy) => GALAXY_ID[galaxy]);
}
